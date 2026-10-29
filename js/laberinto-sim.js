/**
 * PIAR - Simulador Interactivo "El Laberinto Mágico" (Proyecto 3)
 * Reproduce el juego de Scratch 3.0 con:
 *   - Sensor de color REAL: se leen los píxeles del fondo bajo el disfraz del mago
 *   - Cambio de nivel mediante fondos (Nivel 1 → Nivel 2 → Nivel 3 → Victoria)
 *   - Difusión de mensajes ("enviar" / "al recibir") visible en una consola
 *   - Fantasmas que patrullan rebotando en las paredes con su propio sensor de color
 *
 * Necesita js/laberinto-niveles.js (window.LABERINTO) cargado antes.
 */

(function () {
  const canvas = document.getElementById('laberintoCanvas');
  if (!canvas || !window.LABERINTO) return;

  const ctx = canvas.getContext('2d');
  const DATA = window.LABERINTO;
  const COLORES = DATA.colores;
  const SALIDA = DATA.salida;
  const ASSETS = '../../../assets/scratch/laberinto/';

  // Escenario canónico de Scratch
  const SCRATCH_W = 480;
  const SCRATCH_H = 360;
  const K = canvas.width / SCRATCH_W; // factor de escala Scratch → canvas

  // Radios aproximados de los disfraces (24 x 24 px en Scratch)
  const RADIO_MAGO = 10;
  const RADIO_FANTASMA = 9;
  const PASOS_MAGO = 4; // "mover (4) pasos" en Scratch (30 fotogramas/s)

  // ---------------------------------------------------------------------
  // Referencias a la interfaz
  // ---------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const ui = {
    nivel: $('telNivel'), vidas: $('telVidas'), x: $('telX'), y: $('telY'),
    sensor: $('telSensor'), tiempo: $('telTiempo'), status: $('telStatus'),
    log: $('messageLog'),
    play: $('btnSimPlay'), stop: $('btnSimStop'), pause: $('btnSimPause'), reset: $('btnSimReset'),
    up: $('btnUp'), down: $('btnDown'), left: $('btnLeft'), right: $('btnRight'),
    chkSensors: $('chkSensors'), chkGrid: $('chkGrid'), chkSound: $('chkSound'),
    selWall: $('selWallMode'), selFondo: $('selFondo'), speed: $('speedRange')
  };

  // ---------------------------------------------------------------------
  // Imágenes (los mismos SVG que se descargan para Scratch)
  // ---------------------------------------------------------------------
  function cargarImagen(nombre) {
    const img = new Image();
    img.src = ASSETS + nombre;
    return img;
  }
  const imgMago = cargarImagen('mago.svg');
  const imgFantasma = cargarImagen('fantasma.svg');
  const imgFondos = ['nivel-1.svg', 'nivel-2.svg', 'nivel-3.svg', 'victoria.svg'].map(cargarImagen);
  const listo = (img) => img.complete && img.naturalWidth > 0;

  // ---------------------------------------------------------------------
  // Capa del sensor de color: cada fondo se pinta en un lienzo oculto de
  // 480 x 360 px y se guardan sus píxeles. Así "¿tocando el color?" consulta
  // el color real que hay debajo del objeto, igual que hace Scratch.
  // ---------------------------------------------------------------------
  function hexARgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const RGB_PARED = hexARgb(COLORES.pared);
  const RGB_META = hexARgb(COLORES.meta);

  const niveles = DATA.niveles.map((nv) => {
    const rects = DATA.mapaARectangulos(nv.mapa);
    const off = document.createElement('canvas');
    off.width = SCRATCH_W;
    off.height = SCRATCH_H;
    const octx = off.getContext('2d');
    octx.fillStyle = COLORES.suelo;
    octx.fillRect(0, 0, SCRATCH_W, SCRATCH_H);
    octx.fillStyle = COLORES.pared;
    rects.paredes.forEach((r) => octx.fillRect(r.x, r.y, r.w, r.h));
    octx.fillStyle = COLORES.meta;
    rects.metas.forEach((r) => octx.fillRect(r.x, r.y, r.w, r.h));
    return {
      info: nv,
      rects,
      pixels: octx.getImageData(0, 0, SCRATCH_W, SCRATCH_H).data
    };
  });

  /** Devuelve 'pared' | 'meta' | 'suelo' según el color del píxel en (sx, sy) de Scratch */
  function colorEn(sx, sy) {
    const nv = niveles[state.nivel];
    if (!nv) return 'suelo';
    const px = Math.round(sx + SCRATCH_W / 2);
    const py = Math.round(SCRATCH_H / 2 - sy);
    if (px < 0 || py < 0 || px >= SCRATCH_W || py >= SCRATCH_H) return 'pared';
    const i = (py * SCRATCH_W + px) * 4;
    const d = nv.pixels;
    const parecido = (rgb) =>
      Math.abs(d[i] - rgb[0]) < 12 && Math.abs(d[i + 1] - rgb[1]) < 12 && Math.abs(d[i + 2] - rgb[2]) < 12;
    if (parecido(RGB_PARED)) return 'pared';
    if (parecido(RGB_META)) return 'meta';
    return 'suelo';
  }

  /** Puntos de muestreo alrededor del disfraz (contorno circular) */
  const ANGULOS = Array.from({ length: 16 }, (_, k) => (k / 16) * Math.PI * 2);
  function puntosSensor(x, y, r) {
    return ANGULOS.map((a) => ({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r }));
  }

  /** Equivalente a <¿tocando el color [color]?> */
  function tocandoColor(x, y, r, tipo) {
    return puntosSensor(x, y, r).some((p) => colorEn(p.x, p.y) === tipo);
  }

  // ---------------------------------------------------------------------
  // Audio sintetizado (Web Audio API)
  // ---------------------------------------------------------------------
  let audioCtx = null;
  function getAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function tono(freqIni, freqFin, dur, tipo, vol, retardo) {
    if (!ui.chkSound || !ui.chkSound.checked) return;
    try {
      const a = getAudio();
      if (!a) return;
      const t0 = a.currentTime + (retardo || 0);
      const osc = a.createOscillator();
      const gain = a.createGain();
      osc.type = tipo;
      osc.frequency.setValueAtTime(freqIni, t0);
      osc.frequency.exponentialRampToValueAtTime(freqFin, t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(a.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (e) { /* audio no disponible */ }
  }

  const sonidos = {
    golpe: () => tono(160, 50, 0.2, 'sine', 0.35),
    fantasma: () => { tono(520, 230, 0.55, 'triangle', 0.2); tono(530, 240, 0.55, 'sine', 0.08, 0.03); },
    hechizo: () => [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tono(f, f * 1.01, 0.35, 'sine', 0.14, i * 0.09)),
    victoria: () => [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, i) => tono(f, f, 0.3, 'triangle', 0.16, i * 0.12)),
    derrota: () => [392, 330, 262].forEach((f, i) => tono(f, f * 0.97, 0.35, 'sawtooth', 0.09, i * 0.2))
  };

  // ---------------------------------------------------------------------
  // Estado del juego
  // ---------------------------------------------------------------------
  const state = {
    running: false,
    paused: false,
    nivel: 0,            // 0..2 = niveles, 3 = Victoria
    vidas: 3,
    tiempo: 0,
    mago: { x: SALIDA.x, y: SALIDA.y, dir: 90 },
    fantasmas: [],
    keys: { up: false, down: false, left: false, right: false },
    bocadillo: null,     // { texto, hasta }
    destello: 0,         // flash rojo al tocar pared
    particulas: [],
    sensor: 'suelo',
    fin: null,           // null | 'victoria' | 'derrota'
    statusText: 'Pulsa la Bandera Verde para empezar'
  };

  // ---------------------------------------------------------------------
  // Consola de mensajes (difusión de mensajes visible)
  // ---------------------------------------------------------------------
  function reloj() {
    const s = Math.floor(state.tiempo);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  /**
   * Añade una línea a la consola.
   * tipo: 'events' | 'looks' | 'sensing' | 'control' | 'data'
   */
  function log(icono, texto, bloque, tipo) {
    if (!ui.log) return;
    const li = document.createElement('li');
    li.className = 'log-entry';
    const t = document.createElement('span');
    t.className = 'log-time';
    t.textContent = reloj();
    const ic = document.createElement('span');
    ic.className = 'log-icon';
    ic.textContent = icono;
    const tx = document.createElement('span');
    tx.className = 'log-text';
    tx.textContent = texto + ' ';
    li.append(t, ic, tx);
    if (bloque) {
      const pill = document.createElement('span');
      pill.className = `log-pill pill-${tipo || 'events'}`;
      pill.textContent = bloque;
      li.appendChild(pill);
    }
    ui.log.prepend(li);
    while (ui.log.children.length > 8) ui.log.removeChild(ui.log.lastChild);
  }

  // ---------------------------------------------------------------------
  // Lógica: fondos, mensajes y reinicios
  // ---------------------------------------------------------------------
  function nombreFondo(i) {
    return i < niveles.length ? niveles[i].info.nombre : 'Victoria';
  }

  function irASalida() {
    state.mago.x = SALIDA.x;
    state.mago.y = SALIDA.y;
  }

  /** "cuando el fondo cambie a [...]": cada objeto reacciona al nuevo fondo */
  function alCambiarFondo() {
    const nombre = nombreFondo(state.nivel);
    if (ui.selFondo) ui.selFondo.value = String(state.nivel);

    if (state.nivel >= niveles.length) {
      // Fondo Victoria
      state.fantasmas = [];
      state.mago.x = 0;
      state.mago.y = -110;
      state.bocadillo = { texto: '¡Lo he conseguido!', hasta: performance.now() + 2500 };
      state.fin = 'victoria';
      state.running = false;
      state.statusText = `¡Victoria! Laberinto superado en ${reloj()}`;
      log('🏆', 'Mago: cuando el fondo cambie a «Victoria» →', 'detener [todos]', 'control');
      sonidos.victoria();
      lluviaEstrellas(0, 0, 40);
      return;
    }

    const lista = niveles[state.nivel].info.fantasmas;
    state.fantasmas = lista.map((f) => ({ nombre: f.nombre, x: f.x, y: f.y, dir: f.direccion, pasos: f.pasos }));
    if (lista.length) {
      lista.forEach((f) => {
        log('👻', `${f.nombre}: cuando el fondo cambie a «${nombre}» →`, `ir a x: (${f.x}) y: (${f.y}) · mostrar`, 'looks');
      });
    } else {
      log('🖼️', `Fondo actual: «${nombre}» · los fantasmas siguen escondidos`, '', 'looks');
    }
  }

  /** Equivalente a "cambiar fondo a [Nivel N]" */
  function cambiarFondo(i, origen) {
    state.nivel = Math.max(0, Math.min(niveles.length, i));
    if (origen) log('🎨', origen, `cambiar fondo a [${nombreFondo(state.nivel)}]`, 'looks');
    alCambiarFondo();
  }

  /** Mensaje "nivel superado": un emisor, varios receptores */
  function enviarNivelSuperado() {
    log('📣', 'Mago:', 'enviar [nivel superado]', 'events');
    // Receptor 1: Escenario
    sonidos.hechizo();
    log('📥', 'Escenario: al recibir «nivel superado» →', 'siguiente fondo', 'looks');
    // Receptor 2: Mago
    state.bocadillo = { texto: '¡Abracadabra!', hasta: performance.now() + 1000 };
    log('📥', 'Mago: al recibir «nivel superado» →', 'decir [¡Abracadabra!] durante (1) segundos', 'looks');
    state.nivel += 1;
    alCambiarFondo();
    if (state.nivel < niveles.length) {
      state.statusText = `¡Nivel superado! Ahora: ${nombreFondo(state.nivel)}`;
    }
  }

  /** Bandera verde: guion del Escenario */
  function banderaVerde() {
    getAudio();
    if (ui.log) ui.log.innerHTML = '';
    state.vidas = 3;
    state.tiempo = 0;
    state.fin = null;
    state.particulas = [];
    state.bocadillo = null;
    state.mago.dir = 90;
    irASalida();
    log('🏁', 'Bandera verde → Escenario:', 'cambiar fondo a [Nivel 1] · dar a [Vidas] el valor (3)', 'looks');
    state.nivel = 0;
    alCambiarFondo();
    state.running = true;
    state.paused = false;
    state.statusText = 'En juego: usa las flechas para guiar al mago';
    actualizarTelemetria();
  }

  function reiniciar() {
    state.running = false;
    state.paused = false;
    state.vidas = 3;
    state.tiempo = 0;
    state.fin = null;
    state.particulas = [];
    state.bocadillo = null;
    state.nivel = 0;
    irASalida();
    if (ui.log) ui.log.innerHTML = '';
    alCambiarFondo();
    state.statusText = 'Reiniciado. Pulsa la Bandera Verde para jugar';
    actualizarTelemetria();
  }

  // ---------------------------------------------------------------------
  // Bucle principal (equivale al "por siempre" de cada objeto)
  // ---------------------------------------------------------------------
  function factorVelocidad() {
    // Scratch ejecuta 30 vueltas/s; el simulador 60 → la mitad de pasos por vuelta
    return 0.5 * (ui.speed ? parseFloat(ui.speed.value) : 1);
  }

  function mover(obj, pasos) {
    const rad = (obj.dir * Math.PI) / 180;
    obj.x += Math.sin(rad) * pasos;
    obj.y += Math.cos(rad) * pasos;
  }

  function actualizarMago() {
    const m = state.mago;
    const pasos = PASOS_MAGO * factorVelocidad();
    const modoRebote = ui.selWall && ui.selWall.value === 'rebote';
    const teclas = [
      ['up', 0], ['down', 180], ['left', -90], ['right', 90]
    ];

    let golpe = false;
    for (const [tecla, dir] of teclas) {
      if (!state.keys[tecla]) continue;
      m.dir = dir;          // apuntar en dirección (dir)
      mover(m, pasos);      // mover (4) pasos
      if (tocandoColor(m.x, m.y, RADIO_MAGO, 'pared')) {
        golpe = true;
        if (modoRebote) mover(m, -pasos); // mover (-4) pasos
      }
    }

    if (golpe && !modoRebote) {
      sonidos.golpe();
      state.destello = 1;
      log('💥', `Mago: ¿tocando el color ${COLORES.pared}? → sí →`, `ir a x: (${SALIDA.x}) y: (${SALIDA.y})`, 'sensing');
      state.statusText = '¡Has tocado la pared! Vuelves a la salida';
      irASalida();
    } else if (golpe && modoRebote) {
      state.destello = Math.max(state.destello, 0.35);
    }

    // Meta verde → mensaje
    if (tocandoColor(m.x, m.y, RADIO_MAGO, 'meta')) {
      lluviaEstrellas(m.x, m.y, 18);
      irASalida();            // primero volver a la salida…
      enviarNivelSuperado();  // …y después avisar (evita saltar dos niveles)
      return;
    }

    // Fantasmas
    const tocado = state.fantasmas.find((f) => Math.hypot(f.x - m.x, f.y - m.y) < RADIO_MAGO + RADIO_FANTASMA);
    if (tocado) {
      state.vidas -= 1;
      sonidos.fantasma();
      state.destello = 1;
      log('👻', `Mago: ¿tocando ${tocado.nombre}? → sí →`, 'sumar a [Vidas] (-1)', 'data');
      irASalida();
      if (state.vidas <= 0) {
        state.vidas = 0;
        state.fin = 'derrota';
        state.running = false;
        state.bocadillo = { texto: '¡Oh, no! Fin del juego', hasta: performance.now() + 2500 };
        state.statusText = '¡Fin del juego! Pulsa la Bandera Verde para reintentarlo';
        log('🛑', 'Mago: si <(Vidas) = (0)> →', 'detener [todos]', 'control');
        sonidos.derrota();
      } else {
        state.statusText = `¡Un fantasma te ha atrapado! Quedan ${state.vidas} vidas`;
      }
    }
  }

  function actualizarFantasmas() {
    const f = factorVelocidad();
    state.fantasmas.forEach((g) => {
      const pasos = g.pasos * f;
      mover(g, pasos);                                         // mover (2) pasos
      if (tocandoColor(g.x, g.y, RADIO_FANTASMA, 'pared')) {   // si ¿tocando el color pared?
        mover(g, -pasos);                                      //   mover (-2) pasos
        g.dir = g.dir + 180;                                   //   girar 180 grados
        if (g.dir > 180) g.dir -= 360;
      }
    });
  }

  function lluviaEstrellas(sx, sy, n) {
    const colores = ['#facc15', '#22c55e', '#a78bfa', '#f0abfc', '#ffffff'];
    for (let i = 0; i < n; i++) {
      state.particulas.push({
        x: sx, y: sy,
        vx: (Math.random() - 0.5) * 7,
        vy: (Math.random() - 0.3) * 7,
        vida: 1,
        color: colores[i % colores.length]
      });
    }
  }

  let ultimo = performance.now();
  function update(ahora) {
    const dt = Math.min(0.1, (ahora - ultimo) / 1000);
    ultimo = ahora;

    if (state.running && !state.paused) {
      state.tiempo += dt;
      actualizarFantasmas();
      actualizarMago();
    }

    // Lectura del sensor para la telemetría
    const m = state.mago;
    state.sensor = tocandoColor(m.x, m.y, RADIO_MAGO, 'pared') ? 'pared'
      : tocandoColor(m.x, m.y, RADIO_MAGO, 'meta') ? 'meta' : 'suelo';

    state.destello = Math.max(0, state.destello - dt * 2.5);
    for (let i = state.particulas.length - 1; i >= 0; i--) {
      const p = state.particulas[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy -= 0.15;
      p.vida -= 0.025;
      if (p.vida <= 0) state.particulas.splice(i, 1);
    }
    actualizarTelemetria();
  }

  // ---------------------------------------------------------------------
  // Telemetría
  // ---------------------------------------------------------------------
  const SENSOR_INFO = {
    suelo: { txt: 'Suelo', color: COLORES.suelo },
    pared: { txt: '¡Pared!', color: COLORES.pared },
    meta: { txt: '¡Meta!', color: COLORES.meta }
  };
  let ultimoSensor = '';

  function actualizarTelemetria() {
    if (ui.nivel) ui.nivel.textContent = state.nivel < niveles.length ? state.nivel + 1 : '★';
    if (ui.vidas) ui.vidas.textContent = '❤'.repeat(state.vidas) || '0';
    if (ui.x) ui.x.textContent = Math.round(state.mago.x);
    if (ui.y) ui.y.textContent = Math.round(state.mago.y);
    if (ui.tiempo) ui.tiempo.textContent = reloj();
    if (ui.status) ui.status.textContent = state.statusText;
    if (ui.sensor && ultimoSensor !== state.sensor) {
      ultimoSensor = state.sensor;
      const s = SENSOR_INFO[state.sensor];
      ui.sensor.innerHTML = '';
      const sw = document.createElement('span');
      sw.className = 'sensor-swatch';
      sw.style.background = s.color;
      ui.sensor.append(sw, document.createTextNode(s.txt));
    }
  }

  // ---------------------------------------------------------------------
  // Dibujo
  // ---------------------------------------------------------------------
  function aCanvas(sx, sy) {
    return { x: (sx + SCRATCH_W / 2) * K, y: (SCRATCH_H / 2 - sy) * K };
  }

  function dibujarFondo() {
    const img = imgFondos[state.nivel];
    if (img && listo(img)) {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return;
    }
    // Respaldo: dibujar desde los datos si el SVG aún no ha cargado
    ctx.fillStyle = COLORES.suelo;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const nv = niveles[state.nivel];
    if (!nv) return;
    ctx.fillStyle = COLORES.pared;
    nv.rects.paredes.forEach((r) => ctx.fillRect(r.x * K, r.y * K, r.w * K, r.h * K));
    ctx.fillStyle = COLORES.meta;
    nv.rects.metas.forEach((r) => ctx.fillRect(r.x * K, r.y * K, r.w * K, r.h * K));
  }

  function dibujarBrilloMeta(t) {
    const nv = niveles[state.nivel];
    if (!nv) return;
    nv.rects.metas.forEach((r) => {
      const a = 0.25 + 0.2 * Math.sin(t / 250);
      ctx.save();
      ctx.shadowColor = '#4ade80';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = `rgba(187, 247, 208, ${a + 0.3})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x * K + 1, r.y * K + 1, r.w * K - 2, r.h * K - 2);
      ctx.restore();
    });
  }

  function dibujarSprite(img, sx, sy, voltear, respaldo) {
    const p = aCanvas(sx, sy);
    const tam = 24 * K;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (voltear) ctx.scale(-1, 1);
    if (listo(img)) {
      ctx.drawImage(img, -tam / 2, -tam / 2, tam, tam);
    } else {
      ctx.fillStyle = respaldo;
      ctx.beginPath();
      ctx.arc(0, 0, tam / 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function dibujarFantasmas(t) {
    state.fantasmas.forEach((g, i) => {
      ctx.save();
      ctx.globalAlpha = 0.88 + 0.1 * Math.sin(t / 200 + i);
      // Estilo de rotación izquierda-derecha: solo se voltea en horizontal
      dibujarSprite(imgFantasma, g.x, g.y + Math.sin(t / 180 + i) * 1.2, g.dir < 0, '#e0e7ff');
      ctx.restore();
    });
  }

  function dibujarSensores() {
    const m = state.mago;
    puntosSensor(m.x, m.y, RADIO_MAGO).forEach((p) => {
      const c = colorEn(p.x, p.y);
      const q = aCanvas(p.x, p.y);
      ctx.beginPath();
      ctx.arc(q.x, q.y, c === 'suelo' ? 1.8 : 3, 0, Math.PI * 2);
      ctx.fillStyle = c === 'pared' ? '#f43f5e' : c === 'meta' ? '#4ade80' : '#67e8f9';
      ctx.fill();
    });
    state.fantasmas.forEach((g) => {
      const q = aCanvas(g.x, g.y);
      ctx.save();
      ctx.strokeStyle = 'rgba(244, 114, 182, 0.85)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(q.x, q.y, RADIO_FANTASMA * K, 0, Math.PI * 2);
      ctx.stroke();
      // Flecha de dirección de patrulla
      const rad = (g.dir * Math.PI) / 180;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(q.x + Math.sin(rad) * 20 * K, q.y - Math.cos(rad) * 20 * K);
      ctx.stroke();
      ctx.restore();
    });
  }

  function dibujarEjes() {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.18)';
    ctx.fillStyle = 'rgba(226, 232, 240, 0.75)';
    ctx.font = '10px ui-monospace, monospace';
    for (let sx = -180; sx <= 180; sx += 60) {
      const p = aCanvas(sx, 0);
      ctx.beginPath();
      ctx.moveTo(p.x, 0);
      ctx.lineTo(p.x, canvas.height);
      ctx.stroke();
      ctx.fillText(sx, p.x + 3, canvas.height - 6);
    }
    for (let sy = -120; sy <= 120; sy += 60) {
      const p = aCanvas(0, sy);
      ctx.beginPath();
      ctx.moveTo(0, p.y);
      ctx.lineTo(canvas.width, p.y);
      ctx.stroke();
      ctx.fillText(sy, 4, p.y - 3);
    }
    ctx.restore();
  }

  function dibujarBocadillo() {
    const b = state.bocadillo;
    if (!b) return;
    if (performance.now() > b.hasta && !state.fin) {
      state.bocadillo = null;
      return;
    }
    const p = aCanvas(state.mago.x, state.mago.y);
    ctx.save();
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const w = ctx.measureText(b.texto).width + 20;
    const h = 28;
    let x = p.x + 10;
    if (x + w > canvas.width - 4) x = canvas.width - 4 - w;
    const y = Math.max(4, p.y - 22 * K - h);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0f1d2e';
    ctx.textAlign = 'left';
    ctx.fillText(b.texto, x + 10, y + 18);
    ctx.restore();
  }

  function dibujarParticulas() {
    state.particulas.forEach((p) => {
      const q = aCanvas(p.x, p.y);
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.vida);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function dibujarCapaFinal() {
    if (state.fin === 'derrota') {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 12, 41, 0.78)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('¡FIN DEL JUEGO!', canvas.width / 2, canvas.height / 2 - 12);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '15px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(`Has llegado hasta el ${nombreFondo(state.nivel)}`, canvas.width / 2, canvas.height / 2 + 20);
      ctx.fillStyle = '#c4b5fd';
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillText('Pulsa la Bandera Verde para volver a intentarlo', canvas.width / 2, canvas.height / 2 + 50);
      ctx.restore();
    } else if (state.fin === 'victoria') {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(15, 12, 41, 0.6)';
      ctx.fillRect(canvas.width / 2 - 170, canvas.height - 92, 340, 52);
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(`Tiempo: ${reloj()} · Vidas restantes: ${state.vidas}`, canvas.width / 2, canvas.height - 61);
      ctx.restore();
    } else if (!state.running) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 12, 41, 0.55)';
      ctx.fillRect(canvas.width / 2 - 165, canvas.height / 2 - 26, 330, 52);
      ctx.fillStyle = '#ede9fe';
      ctx.textAlign = 'center';
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(state.paused ? 'Pausa' : '🏁 Pulsa la Bandera Verde para jugar', canvas.width / 2, canvas.height / 2 + 5);
      ctx.restore();
    }
    if (state.paused) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 12, 41, 0.45)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('⏸ PAUSA', canvas.width / 2, canvas.height / 2);
      ctx.restore();
    }
  }

  function render(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dibujarFondo();
    if (state.nivel < niveles.length) dibujarBrilloMeta(t);
    if (ui.chkGrid && ui.chkGrid.checked) dibujarEjes();
    dibujarFantasmas(t);
    dibujarSprite(imgMago, state.mago.x, state.mago.y, false, '#2563eb');
    if (ui.chkSensors && ui.chkSensors.checked && state.nivel < niveles.length) dibujarSensores();
    dibujarParticulas();
    dibujarBocadillo();
    if (state.destello > 0) {
      ctx.fillStyle = `rgba(244, 63, 94, ${state.destello * 0.28})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    dibujarCapaFinal();
  }

  function loop(t) {
    update(t);
    render(t);
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------------
  // Controles
  // ---------------------------------------------------------------------
  const MAPA_TECLAS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right'
  };

  window.addEventListener('keydown', (e) => {
    const k = MAPA_TECLAS[e.key];
    if (!k) return;
    const enFormulario = e.target && /input|select|textarea/i.test(e.target.tagName);
    if (enFormulario && !e.key.startsWith('Arrow')) return;
    state.keys[k] = true;
    if (state.running && !state.paused) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    const k = MAPA_TECLAS[e.key];
    if (k) state.keys[k] = false;
  });
  window.addEventListener('blur', () => {
    Object.keys(state.keys).forEach((k) => { state.keys[k] = false; });
  });

  function botonDireccion(btn, k) {
    if (!btn) return;
    const on = (e) => { e.preventDefault(); state.keys[k] = true; };
    const off = () => { state.keys[k] = false; };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointerleave', off);
    btn.addEventListener('pointercancel', off);
  }
  botonDireccion(ui.up, 'up');
  botonDireccion(ui.down, 'down');
  botonDireccion(ui.left, 'left');
  botonDireccion(ui.right, 'right');

  if (ui.play) ui.play.addEventListener('click', banderaVerde);
  if (ui.stop) ui.stop.addEventListener('click', () => {
    state.running = false;
    state.paused = false;
    state.statusText = 'Detenido. Pulsa la Bandera Verde para empezar de nuevo';
    log('⏹️', 'Botón rojo:', 'detener [todos]', 'control');
  });
  if (ui.pause) ui.pause.addEventListener('click', () => {
    if (!state.running) return;
    state.paused = !state.paused;
    state.statusText = state.paused ? 'Juego en pausa' : 'Reanudado';
  });
  if (ui.reset) ui.reset.addEventListener('click', reiniciar);
  if (ui.selFondo) ui.selFondo.addEventListener('change', () => {
    const i = parseInt(ui.selFondo.value, 10);
    irASalida();
    state.fin = null;
    cambiarFondo(i, 'Profesor/a:');
    if (i < niveles.length) {
      state.statusText = `Fondo cambiado a ${nombreFondo(i)}. ${state.running ? '¡Sigue jugando!' : 'Pulsa la Bandera Verde o continúa con ▶'}`;
    }
    ui.selFondo.blur();
  });
  if (ui.selWall) ui.selWall.addEventListener('change', () => {
    log('⚙️', ui.selWall.value === 'rebote'
      ? 'Modo pared: rebotar →' : 'Modo pared: volver a la salida →',
    ui.selWall.value === 'rebote' ? 'mover (-4) pasos' : `ir a x: (${SALIDA.x}) y: (${SALIDA.y})`, 'motion');
    ui.selWall.blur();
  });

  // Arranque
  alCambiarFondo();
  actualizarTelemetria();
  requestAnimationFrame(loop);
})();
