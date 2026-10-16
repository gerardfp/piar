/**
 * PIAR - Simulador Interactivo "Robot Recolector / Atrapa Objetos con Marcador"
 * Simula el videojuego de Scratch 3.0 con bucle de juego, físicas, colisiones y variables
 */

(function () {
  const canvas = document.getElementById('atrapaCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Dimensiones canónicas de Scratch (480 x 360)
  const SCRATCH_W = 480;
  const SCRATCH_H = 360;

  // Elementos de telemetría y controles
  const valScore = document.getElementById('telemetryScore');
  const valLives = document.getElementById('telemetryLives');
  const valRobotX = document.getElementById('telemetryRobotX');
  const valItemY = document.getElementById('telemetryItemY');
  const valStatus = document.getElementById('telemetryStatus');

  const btnPlay = document.getElementById('btnSimPlay');
  const btnStop = document.getElementById('btnSimStop');
  const btnPause = document.getElementById('btnSimPause');
  const btnReset = document.getElementById('btnSimReset');

  const btnMoveLeft = document.getElementById('btnMoveLeft');
  const btnMoveRight = document.getElementById('btnMoveRight');

  const chkHitboxes = document.getElementById('chkHitboxes');
  const chkGrid = document.getElementById('chkGrid');
  const chkSound = document.getElementById('chkSound');
  const speedRange = document.getElementById('speedRange');

  // Audio sintetizado mediante Web Audio API (100% autónomo y nítido)
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playCatchSound() {
    if (!chkSound || !chkSound.checked) return;
    try {
      const actx = getAudioContext();
      if (!actx) return;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, actx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, actx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.18, actx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start();
      osc.stop(actx.currentTime + 0.15);
    } catch (e) {}
  }

  function playMissSound() {
    if (!chkSound || !chkSound.checked) return;
    try {
      const actx = getAudioContext();
      if (!actx) return;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, actx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, actx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.15, actx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start();
      osc.stop(actx.currentTime + 0.22);
    } catch (e) {}
  }

  // Estado del simulador
  const state = {
    isRunning: false,
    isPaused: false,
    score: 0,
    lives: 3,
    robot: {
      x: 0,
      y: -135,
      width: 76,
      height: 36,
      speed: 8
    },
    item: {
      x: 0,
      y: 165,
      radius: 14,
      fallSpeed: 4.2
    },
    particles: [],
    keys: {
      left: false,
      right: false
    },
    statusText: 'Pulsa Bandera Verde o las flechas para jugar'
  };

  // Conversor de coordenadas Scratch a Canvas
  function scratchToCanvas(sx, sy) {
    const cx = (sx + SCRATCH_W / 2) * (canvas.width / SCRATCH_W);
    const cy = (SCRATCH_H / 2 - sy) * (canvas.height / SCRATCH_H);
    return { x: cx, y: cy };
  }

  function randomRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function resetItem() {
    state.item.x = randomRange(-190, 190);
    state.item.y = 170;
  }

  function addCatchParticles(sx, sy) {
    for (let i = 0; i < 8; i++) {
      state.particles.push({
        x: sx,
        y: sy,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.2) * 5,
        alpha: 1,
        color: Math.random() > 0.5 ? '#22d3ee' : '#38bdf8'
      });
    }
  }

  function resetGame() {
    state.score = 0;
    state.lives = 3;
    state.robot.x = 0;
    state.robot.y = -135;
    state.particles = [];
    resetItem();
    state.statusText = 'Juego reiniciado. ¡Atrapa las baterías!';
    updateTelemetry();
    render();
  }

  function updateTelemetry() {
    if (valScore) valScore.textContent = state.score;
    if (valLives) valLives.textContent = state.lives;
    if (valRobotX) valRobotX.textContent = Math.round(state.robot.x);
    if (valItemY) valItemY.textContent = Math.round(state.item.y);
    if (valStatus) valStatus.textContent = state.statusText;
  }

  function updateGame() {
    if (!state.isRunning || state.isPaused) return;

    const speedMultiplier = speedRange ? parseFloat(speedRange.value) : 1;

    // 1. Mover Robot
    if (state.keys.left) {
      state.robot.x -= state.robot.speed * speedMultiplier;
    }
    if (state.keys.right) {
      state.robot.x += state.robot.speed * speedMultiplier;
    }

    // Límites de pantalla en X
    const maxX = 240 - state.robot.width / 2;
    if (state.robot.x < -maxX) state.robot.x = -maxX;
    if (state.robot.x > maxX) state.robot.x = maxX;

    // 2. Caída del objeto
    state.item.y -= state.item.fallSpeed * speedMultiplier;

    // 3. Sensor de colisión (¿Tocando el Robot?)
    const halfW = state.robot.width / 2 + 8;
    const isTouchingX = Math.abs(state.item.x - state.robot.x) < halfW;
    const isTouchingY = state.item.y <= (state.robot.y + 20) && state.item.y >= (state.robot.y - 15);

    if (isTouchingX && isTouchingY) {
      // ¡Atrapado!
      state.score += 1;
      addCatchParticles(state.item.x, state.item.y);
      playCatchSound();
      state.statusText = `¡Atrapado! +1 Punto (Total: ${state.score})`;
      resetItem();
    } else if (state.item.y < -160) {
      // Tocó el suelo
      state.lives -= 1;
      playMissSound();
      state.statusText = `¡Se cayó! -1 Vida (Quedan: ${state.lives})`;
      resetItem();

      if (state.lives <= 0) {
        state.isRunning = false;
        state.statusText = '¡Fin de la partida! Pulsa Bandera Verde para reiniciar.';
      }
    }

    // 4. Actualizar partículas
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.04;
      if (p.alpha <= 0) {
        state.particles.splice(i, 1);
      }
    }

    updateTelemetry();
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fondo: Laboratorio tecnológico futurista
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#0c1825');
    bgGrad.addColorStop(0.7, '#0f2438');
    bgGrad.addColorStop(1, '#132c44');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Líneas de perspectiva en el suelo (plataforma de laboratorio)
    const floorY = canvas.height * 0.88;
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(canvas.width, floorY);
    ctx.stroke();

    // Cuadrícula / Ejes Scratch (si está activado)
    if (chkGrid && chkGrid.checked) {
      drawCoordinateGrid();
    }

    // Dibujar Suelo de advertencia / Láser inferior
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.fillRect(0, floorY, canvas.width, canvas.height - floorY);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ZONA LÍMITE (y < -160) · RESTA 1 VIDA', canvas.width / 2, floorY + 18);

    // Dibujar Partículas
    state.particles.forEach(p => {
      const pos = scratchToCanvas(p.x, p.y);
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Dibujar Objeto que cae (Batería de Energía Tecnológica)
    drawFallingItem(state.item.x, state.item.y);

    // Dibujar Robot Recolector
    drawRobot(state.robot.x, state.robot.y);

    // Dibujar Hitboxes de colisión si está activado
    if (chkHitboxes && chkHitboxes.checked) {
      drawHitboxes();
    }

    // Mensaje de Game Over en Canvas
    if (state.lives <= 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(12, 24, 37, 0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('¡FIN DE LA PARTIDA!', canvas.width / 2, canvas.height / 2 - 15);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(`Puntuación final: ${state.score} puntos`, canvas.width / 2, canvas.height / 2 + 18);

      ctx.fillStyle = '#22d3ee';
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillText('Pulsa "Bandera Verde" para volver a intentarlo', canvas.width / 2, canvas.height / 2 + 48);
      ctx.restore();
    }
  }

  function drawRobot(sx, sy) {
    const pos = scratchToCanvas(sx, sy);
    const w = (state.robot.width * canvas.width) / SCRATCH_W;
    const h = (state.robot.height * canvas.height) / SCRATCH_H;

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Chasis blanco perla / robot friendly
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cbd8e6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 8);
    ctx.fill();
    ctx.stroke();

    // Receptáculo / Cesta superior cian
    ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 4, -h / 2 - 6, w - 8, 8, 4);
    ctx.fill();
    ctx.stroke();

    // Ojos luminosos LED (estética robot de animación)
    ctx.fillStyle = '#06b6d4';
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(-14, 0, 4.5, 0, Math.PI * 2);
    ctx.arc(14, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Sonrisa tecnológica
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 3, 6, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    // Ruedas / Orugas inferiores
    ctx.fillStyle = '#334155';
    ctx.fillRect(-w / 2 + 6, h / 2 - 2, 14, 4);
    ctx.fillRect(w / 2 - 20, h / 2 - 2, 14, 4);

    ctx.restore();
  }

  function drawFallingItem(sx, sy) {
    const pos = scratchToCanvas(sx, sy);
    const r = (state.item.radius * canvas.width) / SCRATCH_W;

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Brillo / Halo exterior
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 12;

    // Cuerpo de la batería / gema de energía
    const grad = ctx.createLinearGradient(-r, -r, r, r);
    grad.addColorStop(0, '#22d3ee');
    grad.addColorStop(1, '#0284c7');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.roundRect(-r, -r * 1.3, r * 2, r * 2.6, 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Terminal superior
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-r * 0.4, -r * 1.6, r * 0.8, r * 0.35);

    // Icono de rayo / energía central
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(1, -r * 0.6);
    ctx.lineTo(-r * 0.5, 1);
    ctx.lineTo(0, 1);
    ctx.lineTo(-1, r * 0.6);
    ctx.lineTo(r * 0.5, -1);
    ctx.lineTo(0, -1);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawHitboxes() {
    ctx.save();
    // Hitbox del objeto
    const itemPos = scratchToCanvas(state.item.x, state.item.y);
    const itemR = (state.item.radius * canvas.width) / SCRATCH_W;
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(itemPos.x, itemPos.y, itemR + 2, 0, Math.PI * 2);
    ctx.stroke();

    // Hitbox del robot
    const robotPos = scratchToCanvas(state.robot.x, state.robot.y);
    const rw = (state.robot.width * canvas.width) / SCRATCH_W;
    const rh = (state.robot.height * canvas.height) / SCRATCH_H;
    ctx.strokeStyle = '#10b981';
    ctx.strokeRect(robotPos.x - rw / 2 - 4, robotPos.y - rh / 2 - 8, rw + 8, rh + 12);
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawCoordinateGrid() {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.font = '9px monospace';

    for (let sx = -240; sx <= 240; sx += 60) {
      const p = scratchToCanvas(sx, 0);
      ctx.beginPath();
      ctx.moveTo(p.x, 0);
      ctx.lineTo(p.x, canvas.height);
      ctx.stroke();
      if (sx !== 0) ctx.fillText(sx, p.x + 3, canvas.height / 2 - 4);
    }

    for (let sy = -180; sy <= 180; sy += 60) {
      const p = scratchToCanvas(0, sy);
      ctx.beginPath();
      ctx.moveTo(0, p.y);
      ctx.lineTo(canvas.width, p.y);
      ctx.stroke();
      if (sy !== 0) ctx.fillText(sy, canvas.width / 2 + 5, p.y - 3);
    }

    const center = scratchToCanvas(0, 0);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.beginPath();
    ctx.moveTo(0, center.y);
    ctx.lineTo(canvas.width, center.y);
    ctx.moveTo(center.x, 0);
    ctx.lineTo(center.x, canvas.height);
    ctx.stroke();

    ctx.restore();
  }

  // Bucle de animación (Game Loop continuo a 60 FPS)
  function loop() {
    updateGame();
    render();
    requestAnimationFrame(loop);
  }

  // Controles
  function startSim() {
    getAudioContext();
    if (state.lives <= 0) {
      resetGame();
    }
    state.isRunning = true;
    state.isPaused = false;
    state.statusText = 'En juego: usa las flechas ⬅️ y ➡️ para recolectar';
    updateTelemetry();
  }

  function pauseSim() {
    state.isPaused = !state.isPaused;
    state.statusText = state.isPaused ? 'Juego pausado' : 'Reanudado';
    updateTelemetry();
  }

  function stopSim() {
    state.isRunning = false;
    state.isPaused = false;
    state.statusText = 'Detenido. Pulsa Bandera Verde para iniciar.';
    updateTelemetry();
  }

  // Teclado
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      state.keys.left = true;
      if (state.isRunning) e.preventDefault();
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      state.keys.right = true;
      if (state.isRunning) e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      state.keys.left = false;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      state.keys.right = false;
    }
  });

  // Botones táctiles / click en pantalla
  if (btnMoveLeft) {
    btnMoveLeft.addEventListener('mousedown', () => { state.keys.left = true; });
    btnMoveLeft.addEventListener('mouseup', () => { state.keys.left = false; });
    btnMoveLeft.addEventListener('mouseleave', () => { state.keys.left = false; });
    btnMoveLeft.addEventListener('touchstart', (e) => { e.preventDefault(); state.keys.left = true; }, { passive: false });
    btnMoveLeft.addEventListener('touchend', (e) => { e.preventDefault(); state.keys.left = false; }, { passive: false });
  }

  if (btnMoveRight) {
    btnMoveRight.addEventListener('mousedown', () => { state.keys.right = true; });
    btnMoveRight.addEventListener('mouseup', () => { state.keys.right = false; });
    btnMoveRight.addEventListener('mouseleave', () => { state.keys.right = false; });
    btnMoveRight.addEventListener('touchstart', (e) => { e.preventDefault(); state.keys.right = true; }, { passive: false });
    btnMoveRight.addEventListener('touchend', (e) => { e.preventDefault(); state.keys.right = false; }, { passive: false });
  }

  if (btnPlay) btnPlay.addEventListener('click', startSim);
  if (btnStop) btnStop.addEventListener('click', stopSim);
  if (btnPause) btnPause.addEventListener('click', pauseSim);
  if (btnReset) btnReset.addEventListener('click', resetGame);

  resetGame();
  requestAnimationFrame(loop);
})();
