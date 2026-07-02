(function(){
  // ---- State ----
  let elapsedMs = 0;        // total accumulated elapsed time
  let startTimestamp = null; // performance.now() when current run started
  let running = false;
  let rafId = null;
  let laps = []; // { totalMs, splitMs }

  // ---- Elements ----
  const timeMainEl = document.getElementById('timeMain');
  const timeMsEl = document.getElementById('timeMs');
  const startPauseBtn = document.getElementById('startPauseBtn');
  const lapBtn = document.getElementById('lapBtn');
  const resetBtn = document.getElementById('resetBtn');
  const lapList = document.getElementById('lapList');
  const lapCountEl = document.getElementById('lapCount');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const sweepHand = document.getElementById('sweepHand');
  const ticksGroup = document.getElementById('ticks');

  // ---- Build dial ticks (60 marks) ----
  const cx = 160, cy = 160, rOuter = 150, rInnerMinor = 140, rInnerMajor = 132;
  for(let i = 0; i < 60; i++){
    const angle = (i / 60) * 2 * Math.PI - Math.PI / 2;
    const isMajor = i % 5 === 0;
    const rInner = isMajor ? rInnerMajor : rInnerMinor;
    const x1 = cx + rOuter * Math.cos(angle);
    const y1 = cy + rOuter * Math.sin(angle);
    const x2 = cx + rInner * Math.cos(angle);
    const y2 = cy + rInner * Math.sin(angle);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1.toFixed(2));
    line.setAttribute('y1', y1.toFixed(2));
    line.setAttribute('x2', x2.toFixed(2));
    line.setAttribute('y2', y2.toFixed(2));
    line.setAttribute('class', 'tick' + (isMajor ? ' major' : ''));
    ticksGroup.appendChild(line);
  }

  // ---- Formatting ----
  function formatTime(ms){
    const totalCentis = Math.floor(ms / 10);
    const centis = totalCentis % 100;
    const totalSeconds = Math.floor(ms / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    const pad = (n, len) => String(n).padStart(len || 2, '0');
    const main = hours > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`;
    return { main, ms: '.' + pad(centis) };
  }

  function render(currentElapsed){
    const t = formatTime(currentElapsed);
    timeMainEl.textContent = t.main;
    timeMsEl.textContent = t.ms;

    // sweep hand: one full rotation per 60 seconds
    const secondsIntoMinute = (currentElapsed / 1000) % 60;
    const degrees = (secondsIntoMinute / 60) * 360;
    sweepHand.style.transform = `rotate(${degrees}deg)`;
  }

  function currentElapsed(){
    if(running){
      return elapsedMs + (performance.now() - startTimestamp);
    }
    return elapsedMs;
  }

  function tick(){
    render(currentElapsed());
    rafId = requestAnimationFrame(tick);
  }

  // ---- Status indicator ----
  function setStatus(state){
    statusIndicator.classList.remove('running', 'paused');
    if(state === 'running'){
      statusIndicator.classList.add('running');
      statusText.textContent = 'Running';
    } else if(state === 'paused'){
      statusIndicator.classList.add('paused');
      statusText.textContent = 'Paused';
    } else {
      statusText.textContent = 'Ready';
    }
  }

  // ---- Controls ----
  function start(){
    running = true;
    startTimestamp = performance.now();
    startPauseBtn.textContent = 'Pause';
    startPauseBtn.classList.add('running');
    lapBtn.disabled = false;
    resetBtn.disabled = false;
    setStatus('running');
    rafId = requestAnimationFrame(tick);
  }

  function pause(){
    running = false;
    elapsedMs = currentElapsed();
    cancelAnimationFrame(rafId);
    startPauseBtn.textContent = 'Start';
    startPauseBtn.classList.remove('running');
    lapBtn.disabled = true;
    setStatus('paused');
    render(elapsedMs);
  }

  function reset(){
    running = false;
    cancelAnimationFrame(rafId);
    elapsedMs = 0;
    startTimestamp = null;
    laps = [];
    renderLaps();
    startPauseBtn.textContent = 'Start';
    startPauseBtn.classList.remove('running');
    lapBtn.disabled = true;
    resetBtn.disabled = true;
    setStatus('ready');
    render(0);
  }

  function recordLap(){
    const total = currentElapsed();
    const prevTotal = laps.length ? laps[laps.length - 1].totalMs : 0;
    const split = total - prevTotal;
    laps.push({ totalMs: total, splitMs: split });
    renderLaps();
  }

  function renderLaps(){
    lapList.innerHTML = '';
    lapCountEl.textContent = laps.length;

    if(laps.length === 0){
      const li = document.createElement('li');
      li.className = 'empty-state';
      li.id = 'emptyState';
      li.textContent = 'No laps recorded yet';
      lapList.appendChild(li);
      return;
    }

    // find best/worst split among laps (only meaningful with 2+ laps)
    let bestIdx = -1, worstIdx = -1;
    if(laps.length > 1){
      let best = Infinity, worst = -Infinity;
      laps.forEach((l, i) => {
        if(l.splitMs < best){ best = l.splitMs; bestIdx = i; }
        if(l.splitMs > worst){ worst = l.splitMs; worstIdx = i; }
      });
    }

    // show most recent lap first
    for(let i = laps.length - 1; i >= 0; i--){
      const lap = laps[i];
      const li = document.createElement('li');
      li.className = 'lap-item';
      if(i === bestIdx) li.classList.add('best');
      if(i === worstIdx) li.classList.add('worst');

      const idxSpan = document.createElement('span');
      idxSpan.className = 'idx';
      idxSpan.textContent = 'Lap ' + (i + 1);

      const splitFormatted = formatTime(lap.splitMs);
      const splitSpan = document.createElement('span');
      splitSpan.className = 'split';
      splitSpan.textContent = '+' + splitFormatted.main + splitFormatted.ms;

      const totalFormatted = formatTime(lap.totalMs);
      const absSpan = document.createElement('span');
      absSpan.className = 'abs';
      absSpan.textContent = totalFormatted.main + totalFormatted.ms;

      li.appendChild(idxSpan);
      li.appendChild(splitSpan);
      li.appendChild(absSpan);
      lapList.appendChild(li);
    }
  }

  // ---- Event bindings ----
  startPauseBtn.addEventListener('click', () => {
    if(running) pause(); else start();
  });
  lapBtn.addEventListener('click', recordLap);
  resetBtn.addEventListener('click', reset);

  // Keyboard shortcuts: Space = start/pause, L = lap, R = reset
  document.addEventListener('keydown', (e) => {
    if(e.code === 'Space'){
      e.preventDefault();
      startPauseBtn.click();
    } else if(e.key.toLowerCase() === 'l' && !lapBtn.disabled){
      recordLap();
    } else if(e.key.toLowerCase() === 'r' && !resetBtn.disabled){
      reset();
    }
  });

  // initial paint
  render(0);
})();