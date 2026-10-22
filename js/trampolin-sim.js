/**
 * PIAR - Simulador Interactivo "Acrobacias en el Trampolín" (Scratch 3.0)
 * Reproduce paso a paso el proyecto de Scratch
 */

(function () {
  const canvas = document.getElementById('trampolinCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Coordenadas canónicas de Scratch
  const SCRATCH_W = 480;
  const SCRATCH_H = 360;

  // Elementos de la interfaz de telemetría y controles
  const valX = document.getElementById('telemetryX');
  const valY = document.getElementById('telemetryY');
  const valDir = document.getElementById('telemetryDir');
  const valStatus = document.getElementById('telemetryStatus');

  const btnPlay = document.getElementById('btnSimPlay');
  const btnPause = document.getElementById('btnSimPause');
  const btnStep = document.getElementById('btnSimStep');
  const btnReset = document.getElementById('btnSimReset');

  const chkTrajectory = document.getElementById('chkTrajectory');
  const chkGrid = document.getElementById('chkGrid');
  const chkSound = document.getElementById('chkSound');
  const speedRange = document.getElementById('speedRange');

  // Carga de recursos
  const trampolineImg = new Image();
  // Usar ruta relativa adecuada según la ubicación del HTML
  const basePath = canvas.dataset.basepath || '../../';
  trampolineImg.src = basePath + 'assets/scratch/trampolin/trampoline.png';

  const cat1Img = new Image();
  cat1Img.src = basePath + 'assets/scratch/trampolin/cat1.svg';

  const cat2Img = new Image();
  cat2Img.src = basePath + 'assets/scratch/trampolin/cat2.svg';

  // Sonidos opcionales
  let audioPop = null;
  try {
    audioPop = new Audio(basePath + 'assets/scratch/trampolin/pop.wav');
  } catch (e) {
    console.warn('Audio no disponible', e);
  }

  // Estado del simulador
  const state = {
    x: -132,
    y: -57,
    direction: 90, // En Scratch 90° es apuntar a la derecha
    costume: 1,
    isRunning: false,
    isPaused: false,
    speed: 1,
    currentStepIndex: 0,
    trajectory: [],
    statusText: 'Listo para comenzar (pulsa Bandera Verde)',
    activeBlockId: null
  };

  // Posiciones de los trampolines (según el sb3)
  const trampolines = [
    { x: -150, y: -153, width: 140, height: 58 },
    { x: 109, y: -152, width: 140, height: 58 }
  ];

  // Conversión de coordenadas de Scratch a Canvas
  function scratchToCanvas(sx, sy) {
    const cx = (sx + SCRATCH_W / 2) * (canvas.width / SCRATCH_W);
    const cy = (SCRATCH_H / 2 - sy) * (canvas.height / SCRATCH_H);
    return { x: cx, y: cy };
  }

  // Generador de la secuencia completa de pasos del proyecto Scratch
  function buildProgramSteps() {
    const steps = [];

    // 1. Inicio y posicionamiento
    steps.push({
      action: 'init',
      x: -132,
      y: -57,
      dir: 90,
      desc: 'Inicialización: ir a x: -132, y: -57, apuntar en 90°',
      block: 'block-init'
    });

    // 2. Trampolín 1: Repetir 3 veces bote vertical
    for (let r = 1; r <= 3; r++) {
      // Subir 10 veces +10 en Y
      for (let i = 0; i < 10; i++) {
        steps.push({
          action: 'move',
          dy: 10,
          sound: false,
          costume: 1,
          desc: `Trampolín 1 (Bote ${r}/3): Impulso hacia arriba (+Y)`,
          block: 'block-bounce-up-1'
        });
      }
      // Bajar 10 veces -10 en Y
      for (let i = 0; i < 10; i++) {
        steps.push({
          action: 'move',
          dy: -10,
          sound: i === 9, // Pop al tocar fondo
          costume: 2,
          desc: `Trampolín 1 (Bote ${r}/3): Descenso hacia la lona (-Y)`,
          block: 'block-bounce-down-1'
        });
      }
    }

    // 3. Salto acrobático parabólico al Trampolín 2 (Derecha)
    // Subida con giro hacia adelante (+X, +Y, giro horario)
    for (let i = 0; i < 10; i++) {
      steps.push({
        action: 'acrobatics',
        dx: 12.5,
        dy: 10,
        ddir: 24, // Dos giros de 12° en el sb3 = 24°
        sound: false,
        costume: 1,
        desc: `Salto parabólico a trampolín 2: Elevación y giro (+X, +Y)`,
        block: 'block-jump-curve-up'
      });
    }
    // Bajada con avance (+X, -Y, completando giro)
    for (let i = 0; i < 10; i++) {
      steps.push({
        action: 'acrobatics',
        dx: 12.5,
        dy: -10,
        ddir: 12,
        sound: i === 9,
        costume: 2,
        desc: `Salto parabólico a trampolín 2: Aterrizaje (+X, -Y)`,
        block: 'block-jump-curve-down'
      });
    }

    // Estabilización en Trampolín 2
    steps.push({
      action: 'init',
      x: 118,
      y: -57,
      dir: 90,
      costume: 1,
      desc: 'Aterrizaje en Trampolín 2: estabilizar x: 118, y: -57, dir: 90°',
      block: 'block-land-2'
    });

    // 4. Trampolín 2: Repetir 3 veces bote vertical
    for (let r = 1; r <= 3; r++) {
      for (let i = 0; i < 10; i++) {
        steps.push({
          action: 'move',
          dy: 10,
          sound: false,
          costume: 1,
          desc: `Trampolín 2 (Bote ${r}/3): Impulso hacia arriba (+Y)`,
          block: 'block-bounce-up-2'
        });
      }
      for (let i = 0; i < 10; i++) {
        steps.push({
          action: 'move',
          dy: -10,
          sound: i === 9,
          costume: 2,
          desc: `Trampolín 2 (Bote ${r}/3): Descenso hacia la lona (-Y)`,
          block: 'block-bounce-down-2'
        });
      }
    }

    // 5. Salto acrobático parabólico de regreso a Trampolín 1 (Izquierda)
    for (let i = 0; i < 10; i++) {
      steps.push({
        action: 'acrobatics',
        dx: -12.5,
        dy: 10,
        ddir: -24, // Giro antihorario para regresar
        sound: false,
        costume: 1,
        desc: `Salto de regreso a trampolín 1: Elevación invertida (-X, +Y)`,
        block: 'block-return-curve-up'
      });
    }
    for (let i = 0; i < 10; i++) {
      steps.push({
        action: 'acrobatics',
        dx: -12.5,
        dy: -10,
        ddir: -12,
        sound: i === 9,
        costume: 2,
        desc: `Salto de regreso a trampolín 1: Aterrizaje final (-X, -Y)`,
        block: 'block-return-curve-down'
      });
    }

    // Finalización
    steps.push({
      action: 'init',
      x: -132,
      y: -57,
      dir: 90,
      costume: 1,
      desc: '¡Reto completado con éxito! Posición inicial restaurada.',
      block: null
    });

    return steps;
  }

  let programSteps = buildProgramSteps();

  function playPopSound() {
    if (chkSound && chkSound.checked && audioPop) {
      try {
        audioPop.currentTime = 0;
        audioPop.play();
      } catch (e) {}
    }
  }

  function resetSim() {
    state.isRunning = false;
    state.isPaused = false;
    state.currentStepIndex = 0;
    state.x = -132;
    state.y = -57;
    state.direction = 90;
    state.costume = 1;
    state.trajectory = [{ x: -132, y: -57 }];
    state.statusText = 'Listo. Pulsa Bandera Verde o "Paso a paso".';
    state.activeBlockId = null;
    highlightBlock(null);
    updateTelemetry();
    render();
  }

  function updateTelemetry() {
    if (valX) valX.textContent = Math.round(state.x);
    if (valY) valY.textContent = Math.round(state.y);
    if (valDir) valDir.textContent = `${Math.round(state.direction)}°`;
    if (valStatus) valStatus.textContent = state.statusText;
  }

  function highlightBlock(blockId) {
    document.querySelectorAll('.code-highlight').forEach(el => el.classList.remove('code-highlight'));
    if (blockId) {
      const el = document.getElementById(blockId);
      if (el) el.classList.add('code-highlight');
    }
  }

  function executeCurrentStep() {
    if (state.currentStepIndex >= programSteps.length) {
      state.isRunning = false;
      state.statusText = '¡Animación finalizada!';
      highlightBlock(null);
      updateTelemetry();
      return false;
    }

    const step = programSteps[state.currentStepIndex];

    if (step.action === 'init') {
      state.x = step.x;
      state.y = step.y;
      state.direction = step.dir;
    } else if (step.action === 'move') {
      if (step.dx !== undefined) state.x += step.dx;
      if (step.dy !== undefined) state.y += step.dy;
    } else if (step.action === 'acrobatics') {
      if (step.dx !== undefined) state.x += step.dx;
      if (step.dy !== undefined) state.y += step.dy;
      if (step.ddir !== undefined) state.direction = (state.direction + step.ddir) % 360;
    }

    if (step.costume) state.costume = step.costume;
    if (step.sound) playPopSound();

    state.statusText = step.desc;
    state.activeBlockId = step.block;
    highlightBlock(step.block);

    state.trajectory.push({ x: state.x, y: state.y });
    if (state.trajectory.length > 250) state.trajectory.shift();

    state.currentStepIndex++;
    updateTelemetry();
    render();

    return true;
  }

  let animationTimer = null;

  function runLoop() {
    if (!state.isRunning || state.isPaused) return;

    const hasMore = executeCurrentStep();
    if (hasMore) {
      const speedVal = speedRange ? parseFloat(speedRange.value) : 1;
      const baseDelay = 50; // 50ms igual que esperar 0.05s en Scratch
      const delay = Math.max(10, baseDelay / speedVal);
      animationTimer = setTimeout(runLoop, delay);
    }
  }

  function startSim() {
    if (state.currentStepIndex >= programSteps.length) {
      resetSim();
    }
    state.isRunning = true;
    state.isPaused = false;
    clearTimeout(animationTimer);
    runLoop();
  }

  function pauseSim() {
    state.isPaused = true;
    state.isRunning = false;
    clearTimeout(animationTimer);
    state.statusText = 'Pausado. Puedes usar "Paso a paso" para inspeccionar.';
    updateTelemetry();
  }

  function stepSim() {
    pauseSim();
    if (state.currentStepIndex >= programSteps.length) {
      resetSim();
    }
    executeCurrentStep();
  }

  // Renderizado gráfico en Canvas
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fondo: cielo y césped
    const groundY = canvas.height * 0.72;
    // Cielo
    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0, '#bae6fd');
    skyGrad.addColorStop(1, '#e0f2fe');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, groundY);

    // Suelo
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, canvas.height);
    groundGrad.addColorStop(0, '#4ade80');
    groundGrad.addColorStop(1, '#16a34a');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

    // Cuadrícula / Eje de coordenadas (si está activado)
    if (chkGrid && chkGrid.checked) {
      drawCoordinateGrid();
    }

    // Dibujar trampolines
    trampolines.forEach((t, idx) => {
      const pos = scratchToCanvas(t.x, t.y);
      if (trampolineImg.complete && trampolineImg.naturalWidth > 0) {
        ctx.drawImage(trampolineImg, pos.x - t.width / 2, pos.y - t.height / 2, t.width, t.height);
      } else {
        // Fallback vectorial
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(pos.x - 60, pos.y - 10, 120, 14);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(pos.x - 55, pos.y - 18, 110, 8);
      }

      // Etiqueta del trampolín
      ctx.fillStyle = '#065f46';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Trampolín ${idx + 1} (x: ${t.x})`, pos.x, pos.y + 40);
    });

    // Dibujar trayectoria / parábola
    if (chkTrajectory && chkTrajectory.checked && state.trajectory.length > 1) {
      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
      ctx.setLineDash([5, 4]);

      const start = scratchToCanvas(state.trajectory[0].x, state.trajectory[0].y);
      ctx.moveTo(start.x, start.y);

      for (let i = 1; i < state.trajectory.length; i++) {
        const pt = scratchToCanvas(state.trajectory[i].x, state.trajectory[i].y);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Dibujar al Gato de Scratch
    const catPos = scratchToCanvas(state.x, state.y);
    ctx.save();
    ctx.translate(catPos.x, catPos.y);

    // En Scratch, dirección 90° es horizontal mirando a la derecha (rotación 0 rad)
    const angleRad = (state.direction - 90) * (Math.PI / 180);
    ctx.rotate(angleRad);

    const activeCat = state.costume === 2 && cat2Img.complete ? cat2Img : cat1Img;
    const catSize = 65;

    if (activeCat.complete && activeCat.naturalWidth > 0) {
      ctx.drawImage(activeCat, -catSize / 2, -catSize / 2, catSize, catSize);
    } else {
      // Fallback si no ha cargado el SVG
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Marcador de coordenadas actual sobre el personaje
    if (chkGrid && chkGrid.checked) {
      ctx.fillStyle = '#0f172a';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`(${Math.round(state.x)}, ${Math.round(state.y)})`, catPos.x, catPos.y - 42);
    }
  }

  function drawCoordinateGrid() {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
    ctx.fillStyle = 'rgba(71, 85, 105, 0.7)';
    ctx.font = '10px monospace';

    // Líneas verticales (cada 60 unidades Scratch)
    for (let sx = -240; sx <= 240; sx += 60) {
      const p = scratchToCanvas(sx, 0);
      ctx.beginPath();
      ctx.moveTo(p.x, 0);
      ctx.lineTo(p.x, canvas.height);
      ctx.stroke();
      if (sx !== 0) {
        ctx.fillText(sx, p.x + 3, canvas.height / 2 - 4);
      }
    }

    // Líneas horizontales (cada 60 unidades Scratch)
    for (let sy = -180; sy <= 180; sy += 60) {
      const p = scratchToCanvas(0, sy);
      ctx.beginPath();
      ctx.moveTo(0, p.y);
      ctx.lineTo(canvas.width, p.y);
      ctx.stroke();
      if (sy !== 0) {
        ctx.fillText(sy, canvas.width / 2 + 5, p.y - 3);
      }
    }

    // Ejes principales X e Y destacados
    const center = scratchToCanvas(0, 0);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';

    // Eje X
    ctx.beginPath();
    ctx.moveTo(0, center.y);
    ctx.lineTo(canvas.width, center.y);
    ctx.stroke();

    // Eje Y
    ctx.beginPath();
    ctx.moveTo(center.x, 0);
    ctx.lineTo(center.x, canvas.height);
    ctx.stroke();

    // Etiqueta origen (0,0)
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('(0, 0)', center.x + 6, center.y - 6);

    ctx.restore();
  }

  // Event Listeners de Controles
  if (btnPlay) btnPlay.addEventListener('click', startSim);
  if (btnPause) btnPause.addEventListener('click', pauseSim);
  if (btnStep) btnStep.addEventListener('click', stepSim);
  if (btnReset) btnReset.addEventListener('click', resetSim);

  if (chkTrajectory) chkTrajectory.addEventListener('change', render);
  if (chkGrid) chkGrid.addEventListener('change', render);

  // Inicialización al cargar recursos
  let loadedCount = 0;
  function onAssetLoad() {
    loadedCount++;
    render();
  }
  trampolineImg.onload = onAssetLoad;
  cat1Img.onload = onAssetLoad;
  cat2Img.onload = onAssetLoad;

  resetSim();
})();
