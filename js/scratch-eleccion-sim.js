(() => {
  const game = document.querySelector('[data-scratch-game]');
  const start = game.querySelector('[data-start]');
  const stop = game.querySelector('[data-stop]');
  const status = game.querySelector('[data-status]');
  const score = game.querySelector('[data-score]');

  if (game.dataset.scratchGame === 'escape-room') {
    const key = game.querySelector('[data-key]');
    const note = game.querySelector('[data-note]');
    const door = game.querySelector('[data-door]');
    const form = game.querySelector('form');
    const code = form.elements.codigo;
    const inventory = [];
    let active = false;

    function setActive(value) {
      active = value;
      key.disabled = !active || inventory.includes('llave');
      note.disabled = !active;
      door.disabled = !active;
      form.hidden = true;
    }

    start.addEventListener('click', () => {
      inventory.length = 0;
      score.textContent = 'Vacío';
      code.value = '';
      setActive(true);
      status.textContent = 'Revisa los objetos de la habitación para encontrar la salida.';
    });
    stop.addEventListener('click', () => {
      setActive(false);
      status.textContent = 'Partida detenida.';
    });
    key.addEventListener('click', () => {
      if (!active || inventory.includes('llave')) return;
      inventory.push('llave');
      score.textContent = 'Llave';
      key.disabled = true;
      status.textContent = 'Has guardado la llave en el inventario.';
    });
    note.addEventListener('click', () => {
      status.textContent = 'La nota dice: «Dos círculos, tres triángulos, un cuadrado». Escribe las cantidades en ese orden.';
    });
    door.addEventListener('click', () => {
      if (!inventory.includes('llave')) {
        status.textContent = 'La puerta tiene cerradura. Busca una llave.';
        return;
      }
      form.hidden = false;
      code.focus();
      status.textContent = 'La llave encaja. Introduce el código de tres cifras.';
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!active || form.hidden) return;
      if (code.value.trim() === '231') {
        setActive(false);
        start.focus();
        status.textContent = '¡Puerta abierta! Has escapado.';
      } else {
        status.textContent = 'Ese código no abre la puerta. Revisa la pista e inténtalo otra vez.';
        code.select();
      }
    });
    return;
  }

  const canvas = game.querySelector('canvas');
  const context = canvas.getContext('2d');
  const mode = game.dataset.scratchGame;
  const width = canvas.width;
  const height = canvas.height;
  const held = new Map();
  const keys = {ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'action', ' ': 'action'};
  let running = false;
  let action = false;
  let pendingMove = 0;
  let frame;
  let player;
  let stage;
  let surfaces;
  let enemies;
  let lasers;
  let cooldown;
  let obstacles;
  let distance;
  let countdown;
  let tickTime;
  let accumulator;
  const step = 1000 / 60;
  const courses = [
    [[0, 315, 480, 45], [145, 265, 105, 50], [320, 226, 125, 89]],
    [[0, 315, 480, 45], [105, 265, 110, 50], [272, 220, 110, 95], [384, 175, 86, 140]],
  ];

  function collides(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function rect(x, y, w, h) {
    return {x, y, w, h};
  }

  function constrainedX(x, size) {
    return Math.max(0, Math.min(width - size, x));
  }

  function loadCourse(index) {
    player = {...rect(26, 285, 24, 28), vy: 0};
    surfaces = courses[index].map(([x, y, w, h]) => rect(x, y, w, h));
    stage = index + 1;
    score.textContent = `${stage} / ${courses.length}`;
  }

  function portal() {
    const last = surfaces.at(-1);
    return rect(last.x + last.w - 40, last.y - 42, 29, 42);
  }

  function reset() {
    if (mode === 'plataformas') {
      loadCourse(0);
    } else if (mode === 'shooter-espacial') {
      player = rect(224, 310, 32, 22);
      enemies = Array.from({length: 6}, (_, index) => rect(116 + (index % 3) * 90, 45 + Math.floor(index / 3) * 45, 32, 22));
      lasers = [];
      cooldown = 0;
      score.textContent = '0 / 6';
    } else {
      player = {...rect(86, 283, 28, 32), vy: 0};
      obstacles = [];
      distance = 0;
      countdown = 65;
      score.textContent = '0';
    }
  }

  function finish(message) {
    running = false;
    cancelAnimationFrame(frame);
    held.clear();
    action = false;
    pendingMove = 0;
    status.textContent = message;
  }

  function movePlayer() {
    const directions = [...held.values()];
    const left = directions.includes('left');
    const right = directions.includes('right');
    const move = left || right ? Number(right) - Number(left) : pendingMove;
    pendingMove = 0;
    return move;
  }

  function platformTick() {
    const oldX = player.x;
    player.x = constrainedX(oldX + movePlayer() * 4, player.w);
    if (surfaces.some(surface => collides(player, surface))) player.x = oldX;
    const grounded = surfaces.some(surface => collides({...player, y: player.y + 1}, surface));
    if (action && grounded) player.vy = -12;
    action = false;
    player.vy = Math.min(player.vy + 1, 12);
    const direction = Math.sign(player.vy);
    for (let index = 0, pixels = Math.abs(player.vy); index < pixels; index++) {
      player.y += direction;
      if (surfaces.some(surface => collides(player, surface))) {
        player.y -= direction;
        player.vy = 0;
        break;
      }
    }
    if (collides(player, portal())) {
      if (stage === courses.length) {
        finish('¡Llegaste a la última meta!');
      } else {
        loadCourse(stage);
        status.textContent = 'Nivel 2. Sube por los bloques hasta la meta.';
      }
    }
  }

  function shooterTick() {
    player.x = constrainedX(player.x + movePlayer() * 5, player.w);
    cooldown = Math.max(0, cooldown - 1);
    if ((action || [...held.values()].includes('action')) && cooldown === 0) {
      lasers.push(rect(player.x + 14, player.y - 10, 4, 12));
      cooldown = 12;
    }
    action = false;
    enemies.forEach(enemy => enemy.y += 0.36);
    lasers.forEach(laser => laser.y -= 8);
    enemies = enemies.filter(enemy => !lasers.some(laser => collides(laser, enemy)));
    lasers = lasers.filter(laser => laser.y + laser.h > 0);
    score.textContent = `${6 - enemies.length} / 6`;
    if (enemies.length === 0) finish('¡Oleada despejada!');
    else if (enemies.some(enemy => enemy.y + enemy.h >= 310)) finish('Una nave llegó a tu zona. Pulsa la bandera para reintentar.');
  }

  function runnerTick() {
    distance++;
    score.textContent = Math.floor(distance / 30);
    const speed = Math.min(9, 4 + Math.floor(distance / 300));
    if (action && player.y === 283) player.vy = -13;
    action = false;
    player.vy += 1;
    player.y = Math.min(283, player.y + player.vy);
    if (player.y === 283) player.vy = 0;
    countdown--;
    if (countdown === 0) {
      obstacles.push(rect(width, 289, 26, 26));
      countdown = 55 + Math.floor(Math.random() * 51);
    }
    obstacles.forEach(obstacle => obstacle.x -= speed);
    obstacles = obstacles.filter(obstacle => obstacle.x + obstacle.w > 0);
    if (obstacles.some(obstacle => collides(player, obstacle))) {
      finish('Choque. Pulsa la bandera para volver a correr.');
    }
  }

  function drawRect(shape, color) {
    context.fillStyle = color;
    context.fillRect(shape.x, shape.y, shape.w, shape.h);
  }

  function draw() {
    const backgrounds = {'plataformas': '#172c43', 'shooter-espacial': '#10182e', 'endless-runner': '#243541'};
    drawRect(rect(0, 0, width, height), backgrounds[mode]);
    if (mode === 'shooter-espacial') {
      for (let index = 0; index < 54; index++) {
        drawRect(rect((index * 173) % width, (index * 97) % height, 2, 2), '#8195bf');
      }
      drawRect(rect(0, 332, width, 2), '#46658b');
      enemies.forEach(enemy => {
        drawRect(enemy, '#ad8cf5');
        drawRect(rect(enemy.x + 7, enemy.y + 8, 18, 5), '#342359');
      });
      lasers.forEach(laser => drawRect(laser, '#fef08a'));
    } else if (mode === 'plataformas') {
      surfaces.forEach(surface => {
        drawRect(surface, '#356485');
        drawRect(rect(surface.x, surface.y, surface.w, 4), '#7dd3fc');
      });
      drawRect(portal(), '#86efac');
    } else {
      drawRect(rect(0, 315, width, 45), '#233844');
      drawRect(rect(0, 315, width, 3), '#a7ceca');
      for (let x = -(distance * 2 % 48); x < width; x += 48) {
        drawRect(rect(x, 333, 24, 3), '#4d6c71');
      }
      obstacles.forEach(obstacle => drawRect(obstacle, '#fbad81'));
    }
    drawRect(player, '#5eead4');
    drawRect(rect(player.x + player.w - 8, player.y + 5, 4, 4), '#123c46');
  }

  function animate(time) {
    accumulator += Math.min(time - (tickTime ?? time), 100);
    tickTime = time;
    while (accumulator >= step && running) {
      if (mode === 'plataformas') platformTick();
      else if (mode === 'shooter-espacial') shooterTick();
      else runnerTick();
      accumulator -= step;
    }
    draw();
    if (running) frame = requestAnimationFrame(animate);
  }

  function press(source, command) {
    if (!running) return;
    held.set(source, command);
    queueCommand(command);
  }

  function queueCommand(command) {
    if (!running) return;
    if (command === 'action') action = true;
    else pendingMove = command === 'left' ? -1 : 1;
  }

  start.addEventListener('click', () => {
    cancelAnimationFrame(frame);
    held.clear();
    action = false;
    pendingMove = 0;
    reset();
    running = true;
    tickTime = undefined;
    accumulator = 0;
    status.textContent = mode === 'plataformas' ? 'Nivel 1. Llega a la meta verde.' :
      mode === 'shooter-espacial' ? 'Despeja la oleada antes de que las naves lleguen abajo.' : 'Salta cuando se acerque un obstáculo.';
    game.focus();
    draw();
    frame = requestAnimationFrame(animate);
  });
  stop.addEventListener('click', () => finish('Partida detenida.'));
  game.addEventListener('keydown', event => {
    const command = keys[event.key];
    if (!command || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('button')) return;
    if (mode === 'endless-runner' && command !== 'action') return;
    event.preventDefault();
    if (!event.repeat) press(event.code, command);
  });
  game.addEventListener('keyup', event => held.delete(event.code));
  game.addEventListener('focusout', event => {
    if (!game.contains(event.relatedTarget)) held.clear();
  });
  window.addEventListener('blur', () => held.clear());
  game.querySelectorAll('[data-command]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      button.setPointerCapture(event.pointerId);
      press(event.pointerId, button.dataset.command);
    });
    button.addEventListener('lostpointercapture', event => held.delete(event.pointerId));
    button.addEventListener('keydown', event => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      if (!event.repeat) press(button, button.dataset.command);
    });
    button.addEventListener('click', event => {
      if (event.detail === 0) queueCommand(button.dataset.command);
    });
    button.addEventListener('keyup', () => held.delete(button));
    button.addEventListener('blur', () => held.delete(button));
  });
  reset();
  draw();
})();
