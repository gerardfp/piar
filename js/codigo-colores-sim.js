(() => {
  const game = document.querySelector('#codigo-juego');
  const start = game.querySelector('#codigo-iniciar');
  const stop = game.querySelector('#codigo-detener');
  const sound = game.querySelector('#codigo-sonido');
  const status = game.querySelector('#codigo-estado');
  const score = game.querySelector('#codigo-rondas');
  const pads = [...game.querySelectorAll('[data-note]')];
  const notes = [262, 330, 392, 523];
  const sequence = [];
  let position = 0;
  let phase = 'idle';
  let timer;
  let audio;
  let voice;

  function tone(index) {
    if (!audio || audio.state !== 'running' || !sound.checked) return;
    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = notes[index];
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.18);
    voice = oscillator;
  }

  function flash(index, duration, after) {
    const pad = pads[index];
    pad.classList.add('is-lit');
    tone(index);
    timer = setTimeout(() => {
      pad.classList.remove('is-lit');
      after();
    }, duration);
  }

  function setPhase(next, message) {
    phase = next;
    const available = next === 'player';
    pads.forEach(pad => pad.setAttribute('aria-disabled', String(!available)));
    if (message) status.textContent = message;
  }

  function showItem(index) {
    if (index === sequence.length) {
      position = 0;
      setPhase('player', 'Tu turno. Repite la secuencia.');
      return;
    }
    flash(sequence[index], 420, () => {
      timer = setTimeout(() => showItem(index + 1), 180);
    });
  }

  function nextRound() {
    sequence.push(Math.floor(Math.random() * pads.length));
    setPhase('show', `Ronda ${sequence.length}. Observa la secuencia.`);
    timer = setTimeout(() => showItem(0), 650);
  }

  function choose(index) {
    if (phase !== 'player') return;
    setPhase('feedback');
    flash(index, 190, () => {
      if (index !== sequence[position]) {
        setPhase('over', `Fin de la partida. En el paso ${position + 1} tocaba ${pads[sequence[position]].dataset.color}.`);
        return;
      }
      position += 1;
      if (position === sequence.length) {
        score.textContent = sequence.length;
        setPhase('show', 'Secuencia correcta. Prepárate para la siguiente ronda.');
        timer = setTimeout(nextRound, 500);
        return;
      }
      setPhase('player');
    });
  }

  function cancelPlayback() {
    clearTimeout(timer);
    pads.forEach(pad => pad.classList.remove('is-lit'));
    voice?.stop();
    voice = undefined;
  }

  function enableAudio() {
    if (!sound.checked || !window.AudioContext) return;
    audio ??= new AudioContext();
    audio.resume().catch(() => {});
  }

  start.addEventListener('click', () => {
    cancelPlayback();
    enableAudio();
    sequence.length = 0;
    score.textContent = '0';
    nextRound();
  });

  stop.addEventListener('click', () => {
    cancelPlayback();
    setPhase('idle', 'Partida detenida. Pulsa la bandera verde para volver a jugar.');
  });

  sound.addEventListener('change', () => {
    if (sound.checked) enableAudio();
    else voice?.stop();
  });

  pads.forEach((pad, index) => pad.addEventListener('click', () => choose(index)));
  game.addEventListener('keydown', event => {
    if (!/^[1-4]$/.test(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (!event.repeat) choose(Number(event.key) - 1);
  });
})();
