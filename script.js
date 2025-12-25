(() => {
  const BIRTH = '1977-04-28';
    const CHRISTMAS = { month: 3, day: 28 }; // April 28th
    // Device detection & responsive helpers
    function getStoredDeviceMode(){
      // stored values: 'phone', 'desktop', 'auto'
      try{ return localStorage.getItem('device_mode') || 'phone'; }catch(e){ return 'phone'; }
    }
    function setStoredDeviceMode(mode){
      try{ localStorage.setItem('device_mode', mode); }catch(e){}
    }
    function isMobileDevice(){
      const mode = getStoredDeviceMode();
      if(mode === 'phone') return true;
      if(mode === 'desktop') return false;
      // auto: use simple checks: userAgent or touch + width
      return (typeof navigator !== 'undefined' && (/Mobi|Android|iPhone|iPad|iPod|Windows Phone/i).test(navigator.userAgent)) || ('ontouchstart' in window && innerWidth < 800);
    }
    // convert millimeters to CSS pixels (approx. using 96dpi)
    function mmToPx(mm){ return Math.round(mm * 96 / 25.4); }
    // target physical device dimensions (mm)
    const PHONE_DIM = { widthMm: 77.6, heightMm: 162.8, depthMm: 8.2 };
    function getContainerInnerWidth(){
      const container = document.querySelector('.container');
      if(!container) return Math.max(320, innerWidth - 48);
        const cont = document.querySelector('.container') || document.body;
        const style = getComputedStyle(cont);
        const paddingL = parseFloat(style.paddingLeft) || 0;
        const paddingR = parseFloat(style.paddingRight) || 0;
        const w = cont.clientWidth - paddingL - paddingR;
        // ensure we never return ridiculous values
        return Math.max(160, Math.min(w, window.innerWidth));
    }

    function getGameWidth(){
      const containerW = getContainerInnerWidth();
      const mode = getStoredDeviceMode();
      if(mode === 'phone'){
        const presetW = 360; // use user-provided 360px phone width
        // prefer provided phone width but never exceed container
        return Math.max(140, Math.min(presetW, containerW));
      }
      if(mode === 'desktop') return Math.max(480, Math.min(800, containerW));
      // auto: choose smaller of container and a reasonable percentage
      return Math.max(320, Math.min(640, containerW));
    }
    function applyResponsiveSizes(){
      // bgCanvas
      const bg = document.getElementById('bgCanvas'); if(bg){ bg.width = innerWidth; bg.height = innerHeight; bg.style.width = '100%'; bg.style.height = '100%'; }
      // container-constrained widths
      const containerW = getContainerInnerWidth();
      // hero canvas: keep it comfortably smaller than container
      const hc = document.getElementById('heroCanvas'); if(hc){ const desired = isMobileDevice() ? Math.min(320, containerW) : Math.min(320, containerW); hc.width = desired; hc.height = 200; hc.style.maxWidth = '100%'; }
      // visualizer
      const vis = document.getElementById('visualizer'); if(vis){ const desiredVis = Math.min(300, containerW); vis.width = Math.max(200, desiredVis); vis.height = 60; vis.style.maxWidth = '100%'; }
      // game canvas: sized in initGame via getGameWidth but ensure max is container
      const game = document.getElementById('gameCanvas'); if(game){ const gw = Math.min(getGameWidth(), containerW); game.width = gw; game.style.maxWidth = '100%';
        // set canvas height: if phone mode, follow 360x800 preset aspect; otherwise use proportional height
        const mode = getStoredDeviceMode();
        if(mode === 'phone'){
          const presetW = 360, presetH = 800;
          const h = Math.min(presetH, Math.max(200, Math.floor(gw * (presetH / presetW))));
          game.height = h;
        } else {
          game.height = Math.max(240, Math.floor(gw * 0.6));
        }
      }
      // game canvas sizing handled in initGame via getGameWidth()
    }
  const ageEl = document.getElementById('age');
  const birthEl = document.getElementById('birthdate');
  const vhsBtn = document.getElementById('vhsToggle');
  const confBtn = document.getElementById('confettiBtn');
  const themeBtn = document.getElementById('themeBtn');
  const player = document.getElementById('player');
  const audioFile = document.getElementById('audioFile');
  const visualizer = document.getElementById('visualizer');
  const heroCanvas = document.getElementById('heroCanvas');
  const countdownValue = document.getElementById('countdownValue');

  function calcAge(birth){
    const b = new Date(birth);
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if(m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
    return age;
  }

  function init(){
    ageEl.textContent = calcAge(BIRTH);
    birthEl.textContent = '28/04/1977';

    vhsBtn.addEventListener('click', toggleVHS);
    confBtn.addEventListener('click', () => runConfetti(200));
    themeBtn.addEventListener('click', toggleTheme);

    document.getElementById('guestForm').addEventListener('submit', addMessage);
    document.getElementById('exportMessages').addEventListener('click', exportMessages);
    document.getElementById('clearMessages').addEventListener('click', clearMessages);
    document.getElementById('addTimeline').addEventListener('click', addTimelineItem);
    document.getElementById('saveAbout').addEventListener('click', saveAbout);
    document.getElementById('addPhoto').addEventListener('change', addPhoto);

    // Phase 1 initializations
    try { initVisualizer(); } catch(e){ /* ignore */ }
    try { initHeroAnimation(); } catch(e){ /* ignore */ }
    try { initRecorder(); } catch(e){ /* ignore */ }
    try { initBackground(); } catch(e){ /* ignore */ }
    try { applyResponsiveSizes(); } catch(e){ /* ignore */ }

    loadMessages();
    restoreAbout();
    setupCursor();
    checkBirthdayConfetti();
    renderMemoryCards();

    // Library bindings
    const libUpload = document.getElementById('libUpload'); if(libUpload) libUpload.addEventListener('change', handleLibUpload);
    document.querySelectorAll('.libFilter').forEach(b=>b.addEventListener('click', ()=>{ renderLibrary(b.dataset.filter); }));
    const libClear = document.getElementById('libClear'); if(libClear) libClear.addEventListener('click', ()=>{ if(confirm('Clear library?')){ localStorage.removeItem('photo_library'); renderLibrary(); } });

    const copyBtn = document.getElementById('copyPlaylist'); if(copyBtn) copyBtn.addEventListener('click', copySuggestedPlaylist);

    renderLibrary();

    // responsive adjustments on resize/orientation change
    window.addEventListener('resize', ()=>{ try{ applyResponsiveSizes(); }catch(e){} });
    window.addEventListener('orientationchange', ()=>{ try{ applyResponsiveSizes(); }catch(e){} });

    // device mode selector wiring (Phone / Auto / Desktop)
    try{
      const deviceSelect = document.getElementById('deviceSwitch');
      if(deviceSelect){
        // set initial value from storage
        const m = getStoredDeviceMode(); deviceSelect.value = m;
        deviceSelect.addEventListener('change', (e)=>{
          const v = e.target.value || 'phone';
          setStoredDeviceMode(v);
          // re-apply sizes and fire a resize so in-game resize handlers run
          try{ applyResponsiveSizes(); }catch(err){}
          try{ window.dispatchEvent(new Event('resize')); }catch(err){}
        });
      }
    }catch(e){}

    updateCountdown();
    setInterval(updateCountdown, 1000);
  }

  function toggleVHS(){
    document.body.classList.toggle('vhs');
    vhsBtn.textContent = document.body.classList.contains('vhs') ? 'VHS: On' : 'VHS: Off';
  }

  function toggleTheme(){
    document.documentElement.classList.toggle('light');
  }

  /* Guestbook */
  function addMessage(e){
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const message = document.getElementById('message').value.trim();
    if(!name || !message) return;
    const msgs = JSON.parse(localStorage.getItem('gb_msgs')||'[]');
    msgs.unshift({name, message, date:new Date().toISOString()});
    localStorage.setItem('gb_msgs', JSON.stringify(msgs));
    document.getElementById('guestForm').reset();
    renderMessages(msgs);
  }

  function loadMessages(){
    const msgs = JSON.parse(localStorage.getItem('gb_msgs')||'[]');
    renderMessages(msgs);
  }

  function renderMessages(msgs){
    const out = document.getElementById('messages');
    out.innerHTML = '';
    msgs.forEach(m=>{
      const el = document.createElement('div'); el.className='msg';
      el.innerHTML = `<strong>${escapeHtml(m.name)}</strong> <small>${new Date(m.date).toLocaleString()}</small><p>${escapeHtml(m.message)}</p>`;
      out.appendChild(el);
    });
  }

  function exportMessages(){
    const data = localStorage.getItem('gb_msgs') || '[]';
    const blob = new Blob([data], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download='guestbook-messages.json'; a.click();
    URL.revokeObjectURL(url);
  }

  function clearMessages(){
    if(!confirm('Clear all guestbook messages?')) return;
    localStorage.removeItem('gb_msgs');
    renderMessages([]);
  }

  function escapeHtml(s){return s.replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}

  /* Timeline */
  function addTimelineItem(){
    const ol = document.getElementById('timelineList');
    const li = document.createElement('li'); li.contentEditable = true; li.textContent='New event';
    ol.appendChild(li);
  }

  /* About */
  function saveAbout(){
    const v = document.getElementById('aboutText').value;
    localStorage.setItem('dad_about', v);
    alert('Saved');
  }
  function restoreAbout(){
    const v = localStorage.getItem('dad_about'); if(v) document.getElementById('aboutText').value=v;
  }

  /* Gallery */
  function addPhoto(e){
    const f = e.target.files[0]; if(!f) return;
    const reader = new FileReader();
    reader.onload = function(){
      const grid = document.getElementById('galleryGrid');
      const div = document.createElement('div'); div.className='photo';
      const img = document.createElement('img'); img.src = reader.result;
      div.appendChild(img); grid.prepend(div);
    };
    reader.readAsDataURL(f);
  }

  /* Cursor */
  function setupCursor(){
    const cur = document.getElementById('cursor');
    window.addEventListener('mousemove', e=>{cur.style.left = e.clientX+'px'; cur.style.top = e.clientY+'px';});
  }

  /* Confetti (simple) */
  function runConfetti(count=100){
    const c = document.createElement('canvas');
    c.style.position='fixed'; c.style.left=0; c.style.top=0; c.style.pointerEvents='none'; c.width=innerWidth; c.height=innerHeight; document.body.appendChild(c);
    const ctx = c.getContext('2d');
    const pieces = [];
    for(let i=0;i<count;i++) pieces.push({x:Math.random()*c.width,y:Math.random()*-c.height,vx:(Math.random()-0.5)*6,vy:Math.random()*4+2, color:`hsl(${Math.random()*360} 90% 60%)`, r:Math.random()*6+4});
    let t=0;
    function frame(){ ctx.clearRect(0,0,c.width,c.height); pieces.forEach(p=>{p.x+=p.vx; p.y+=p.vy; p.vy+=0.05; ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,p.r, p.r*0.6)}); t++; if(t<400) requestAnimationFrame(frame); else c.remove(); }
    frame();
  }

  function checkBirthdayConfetti(){
    const now = new Date();
    if(now.getDate()===28 && now.getMonth()===3){ /* April is month 3 */
      runConfetti(300);
    }
  }

  /* Visualizer (simple analyser) */
  let audioCtx, analyser, dataArray, sourceNode;
  function initVisualizer(){
    if(!visualizer) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser(); analyser.fftSize = 256;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    sourceNode = audioCtx.createMediaElementSource(player);
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);
    function draw(){
      requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      const ctx = visualizer.getContext('2d');
      ctx.clearRect(0,0,visualizer.width, visualizer.height);
      const barWidth = visualizer.width / dataArray.length;
      for(let i=0;i<dataArray.length;i++){
        const v = dataArray[i]/255; const h = v*visualizer.height;
        ctx.fillStyle = `rgba(255,77,210,${v})`;
        ctx.fillRect(i*barWidth, visualizer.height - h, barWidth-1, h);
      }
    }
    player.addEventListener('play', ()=>{ if(audioCtx.state === 'suspended') audioCtx.resume(); draw(); });
  }

  /* Hero Canvas animation hooks */
  let heroAnimId = null;
  function initHeroAnimation(){
    if(!heroCanvas) return;
    const ctx = heroCanvas.getContext('2d');
    const w = heroCanvas.width, h = heroCanvas.height;
    let t = 0;
    function frame(){
      heroAnimId = requestAnimationFrame(frame);
      t += 0.02;
      ctx.clearRect(0,0,w,h);
      const g = ctx.createLinearGradient(0,0,w,0);
      g.addColorStop(0, `rgba(255,77,210,${0.6+Math.sin(t)*0.15})`);
      g.addColorStop(0.5, `rgba(0,240,255,${0.6+Math.cos(t)*0.15})`);
      g.addColorStop(1, `rgba(255,200,70,${0.5+Math.sin(t*0.7)*0.12})`);
      ctx.fillStyle = g;
      ctx.fillRect(0,0,w,h);
      ctx.fillStyle = 'rgba(0,0,0,0.03)';
      for(let y=0;y<h;y+=4) ctx.fillRect(0,y,w,1);
    }
    frame();
  }
  function stopHeroAnimation(){ if(heroAnimId) cancelAnimationFrame(heroAnimId); }

  /* Simple Recorder using MediaRecorder */
  let mediaRecorder, recordedChunks = [];
  function initRecorder(){
    const recBtn = document.getElementById('recBtn');
    const recordingsList = document.getElementById('recordingsList');
    if(!recBtn) return;
    recBtn.addEventListener('click', async ()=>{
      if(recBtn.dataset.state === 'recording'){
        mediaRecorder.stop();
        recBtn.dataset.state = 'stopped'; recBtn.textContent = 'Start Recording'; recBtn.setAttribute('aria-pressed','false');
        return;
      }
      try{
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        recordedChunks = [];
        mediaRecorder.ondataavailable = e=>{ if(e.data.size>0) recordedChunks.push(e.data); };
        mediaRecorder.onstop = ()=>{
          const blob = new Blob(recordedChunks, {type:'audio/webm'});
          const url = URL.createObjectURL(blob);
          const div = document.createElement('div');
          div.innerHTML = `<audio controls src="${url}"></audio> <a href="${url}" download="voice.webm">Download</a>`;
          recordingsList.prepend(div);
        };
        mediaRecorder.start();
        recBtn.dataset.state = 'recording'; recBtn.textContent = 'Stop Recording'; recBtn.setAttribute('aria-pressed','true');
      }catch(err){ alert('Microphone access denied or unavailable'); }
    });
  }

  /* Memory cards */
  function loadMemoryCards(){
    const html = localStorage.getItem('memory_cards') || '[]';
    try{ return JSON.parse(html); }catch(e){ return []; }
  }
  function saveMemoryCards(cards){ localStorage.setItem('memory_cards', JSON.stringify(cards)); }
  function renderMemoryCards(){
    const container = document.getElementById('memoryCards'); if(!container) return;
    const cards = loadMemoryCards(); container.innerHTML = '';
    cards.forEach((c, idx)=>{
      const el = document.createElement('div'); el.className='memory-card';
      el.innerHTML = `<div class="inner"><div class="face front"><h4>${escapeHtml(c.title)}</h4><p>${escapeHtml(c.text)}</p></div><div class="face back"><small>${new Date(c.created).toLocaleString()}</small></div></div>`;
      el.addEventListener('click', ()=>{ el.classList.toggle('flipped'); });
      container.appendChild(el);
    });
  }
  document.addEventListener('click', (e)=>{
    if(e.target && e.target.id === 'addCard'){
      const t = document.getElementById('newCardTitle').value.trim();
      const txt = document.getElementById('newCardText').value.trim();
      if(!txt) return alert('Please write a memory');
      const cards = loadMemoryCards(); cards.unshift({title:t||'Memory', text:txt, created:new Date().toISOString()});
      saveMemoryCards(cards); renderMemoryCards();
      document.getElementById('newCardTitle').value=''; document.getElementById('newCardText').value='';
    }
  });

  /* Lightbox (simple) */
  function openLightbox(src){
    let lb = document.getElementById('lightbox');
    if(!lb){ lb = document.createElement('div'); lb.id='lightbox'; lb.tabIndex=0; lb.innerHTML = `<button class="close" aria-label="Close">✕</button><div class="nav"><button class="prev" aria-label="Previous">◀</button><button class="next" aria-label="Next">▶</button></div><img id="lbImg" src="" alt="Expanded photo">`;
      document.body.appendChild(lb);
      lb.querySelector('.close').addEventListener('click', ()=>{ lb.style.display='none'; });
      lb.addEventListener('click', (ev)=>{ if(ev.target === lb) lb.style.display='none'; });
    }
    const img = lb.querySelector('#lbImg'); img.src = src; lb.style.display='flex'; img.focus?.();
  }
  document.addEventListener('click', (e)=>{
    const p = e.target.closest('.photo'); if(p){ const src = p.querySelector('img')?.src; if(src) openLightbox(src); }
  });

  /* Countdown & confetti scheduling */
  let scheduledConfetti = null;
  function updateCountdown(){
    // Countdown to next Christmas (Dec 25)
    const now = new Date();
    let target = new Date(now.getFullYear(), CHRISTMAS.month, CHRISTMAS.day);
    if(target <= now) target = new Date(now.getFullYear()+1, CHRISTMAS.month, CHRISTMAS.day);
    const diff = target - now;
    const days = Math.floor(diff/86400000);
    const hrs = Math.floor((diff%86400000)/3600000);
    const mins = Math.floor((diff%3600000)/60000);
    const secs = Math.floor((diff%60000)/1000);
    if(countdownValue) countdownValue.textContent = `${days}d ${hrs}h ${mins}m ${secs}s`;
  }
  function scheduleConfettiAt(date){
    if(scheduledConfetti) clearTimeout(scheduledConfetti);
    const ms = date - new Date(); if(ms<=0) return runConfetti(200);
    scheduledConfetti = setTimeout(()=> runConfetti(300), ms);
  }

  /* audio input */
  audioFile.addEventListener('change', e=>{
    const f = e.target.files[0]; if(!f) return;
    player.src = URL.createObjectURL(f);
    player.play();
  });

  /* Background canvas (snow/stars) */
  function initBackground(){
    const c = document.getElementById('bgCanvas'); if(!c) return;
    const ctx = c.getContext('2d');
    let W = c.width = innerWidth, H = c.height = innerHeight;
    const stars = [];
    for(let i=0;i<120;i++) stars.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.6,dx:(Math.random()-0.5)*0.2,dy:(Math.random()*0.3+0.1)});
    function resize(){ W = c.width = innerWidth; H = c.height = innerHeight; }
    window.addEventListener('resize', resize);
    function draw(){ ctx.clearRect(0,0,W,H); ctx.fillStyle='rgba(255,255,255,0.9)'; stars.forEach(s=>{ s.y += s.dy; s.x += s.dx; if(s.y>H){ s.y = -10; s.x = Math.random()*W; } ctx.globalAlpha = 0.6*Math.random(); ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill(); }); requestAnimationFrame(draw); }
    draw();
  }

  /* Photo Library functionality */
  function loadLibrary(){
    try{ return JSON.parse(localStorage.getItem('photo_library')||'[]'); }catch(e){ return []; }
  }
  function saveLibrary(items){ localStorage.setItem('photo_library', JSON.stringify(items)); }
  async function handleLibUpload(e){
    const files = Array.from(e.target.files||[]);
    const category = document.getElementById('libCategory')?.value || 'other';
    const items = loadLibrary();
    for(const f of files){
      const data = await fileToDataURL(f);
      items.unshift({id:Date.now()+Math.random(), name:f.name, data, category, added:new Date().toISOString()});
    }
    saveLibrary(items); renderLibrary(); e.target.value='';
  }
  function fileToDataURL(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }
  function renderLibrary(filter='all'){
    const grid = document.getElementById('libraryGrid'); if(!grid) return; const items = loadLibrary(); grid.innerHTML='';
    items.filter(it=> filter==='all' ? true : it.category===filter).forEach(it=>{
      const d = document.createElement('div'); d.className='photo'; d.innerHTML = `<img src="${it.data}" alt="${escapeHtml(it.name)}"><div class="meta"><small>${escapeHtml(it.name)}</small><div class="meta-actions"><button class="addToGallery">Add to Gallery</button><button class="removeLib">Remove</button></div></div>`;
      d.querySelector('.addToGallery').addEventListener('click', ()=>{ addToGallery(it); });
      d.querySelector('.removeLib').addEventListener('click', ()=>{ removeFromLibrary(it.id); });
      grid.appendChild(d);
    });
  }
  function removeFromLibrary(id){ const items = loadLibrary().filter(i=>i.id!==id); saveLibrary(items); renderLibrary(); }
  function addToGallery(item){ const grid = document.getElementById('galleryGrid'); if(!grid) return; const div = document.createElement('div'); div.className='photo'; div.innerHTML = `<img src="${item.data}" alt="${escapeHtml(item.name)}">`; grid.prepend(div); }

  /* Suggested playlist copy helper */
  function copySuggestedPlaylist(){
    const list = Array.from(document.querySelectorAll('#suggestedList li')).map(li=>li.textContent.trim()).join('\n');
    navigator.clipboard?.writeText(list).then(()=> alert('Playlist copied to clipboard'), ()=> alert('Copy failed — you can manually select the list'));
  }

  init();
  /* --- Mini game: bouncing balls reveal letters ("Jimmy") --- */
  function initGame(){
    const canvas = document.getElementById('gameCanvas'); if(!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = canvas.width = getGameWidth(); let H = canvas.height = 220;
    window.addEventListener('resize', ()=>{ W = canvas.width = getGameWidth(); H = canvas.height = 220; setupPads(); applyResponsiveSizes(); });
    const letters = ['J','i','m','m','y'];
    const pads = [];
    const revealed = [false,false,false,false,false];
    const balls = [];
    let t = 0;
    let score = 0; let lives = 100000; let nextIndex = 0; let gameOver = false; let difficulty = 1;

    const scoreEl = document.getElementById('gameScore');
    const livesEl = document.getElementById('gameLives');
    function updateGameUI(){ if(scoreEl) scoreEl.textContent = String(score); if(livesEl) livesEl.textContent = String(lives); }

    // create pads across bottom, with motion parameters
    function setupPads(){ pads.length = 0; const padW = Math.floor(W / letters.length); for(let i=0;i<letters.length;i++){ const baseX = i*padW + padW*0.1; pads.push({baseX, x:baseX, y:H-56, w:padW*0.8, h:40, letter:letters[i], amp: Math.max(6, padW*0.06), phase: Math.random()*Math.PI*2, speed:0.6 + Math.random()*0.6}); } }
    setupPads();

    function spawnBall(x,y){
      if(gameOver) return;
      const speed = 1 + Math.random()*1.2 + difficulty*0.15;
      balls.push({
        x: x||W/2,
        y: y||40,
        vx: (Math.random()*4-2)*speed,
        vy: (Math.random()*2+1)*speed,
        r: 12,
        color: `hsl(${Math.random()*360} 80% 60%)`,
        created: performance.now()
      });
    }

    function reset(){ balls.length=0; for(let i=0;i<revealed.length;i++) revealed[i]=false; nextIndex = 0; score = 0; lives = 3; difficulty = 1; gameOver=false; setupPads(); updateGameUI(); }

    function step(){
      t += 0.02; difficulty += 0.0008; // slowly increase difficulty
      ctx.clearRect(0,0,W,H);
      // move and draw pads
      pads.forEach((p,idx)=>{
        p.x = p.baseX + Math.sin(t * p.speed + p.phase) * p.amp;
        ctx.fillStyle = revealed[idx] ? 'rgba(0,240,255,0.12)' : 'rgba(255,255,255,0.03)';
        ctx.fillRect(p.x,p.y,p.w,p.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.strokeRect(p.x,p.y,p.w,p.h);
        ctx.fillStyle = 'var(--fg)'; ctx.font = 'bold 36px Rubik, Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
        const show = revealed[idx] ? p.letter : (idx === nextIndex ? '?' : '');
        ctx.fillText(show, p.x + p.w/2, p.y + p.h/2 - 4);
      });
      // update balls
      for(let i=0;i<balls.length;i++){
        const b = balls[i]; b.vy += 0.16 * difficulty; b.x += b.vx; b.y += b.vy;
        // walls
        if(b.x - b.r < 0){ b.x = b.r; b.vx *= -0.8 }
        if(b.x + b.r > W){ b.x = W - b.r; b.vx *= -0.8 }
        if(b.y - b.r < 0){ b.y = b.r; b.vy *= -0.8 }
        if(b.y + b.r > H){ b.y = H - b.r; b.vy *= -0.6; b.vx *= 0.98; }
        // pad collisions (ordered)
        pads.forEach((p,idx)=>{
          if(b.x > p.x && b.x < p.x + p.w && b.y + b.r > p.y && b.y - b.r < p.y + p.h){
            if(performance.now() - (b.created || 0) < 150) return; // ignore immediate collisions after spawn
            // bounce
            b.y = p.y - b.r - 1; b.vy = -Math.abs(b.vy)*0.8;
            if(idx === nextIndex){
              revealed[idx] = true; score += 10 + Math.floor(difficulty*5); nextIndex++;
              // small speed boost
              b.vx *= 1.05; b.vy *= 0.95;
              if(nextIndex >= pads.length){ score += 100; gameOver = true; try{ runConfetti(200); }catch(e){} }
            } else {
              // penalty for hitting wrong pad
              lives -= 1; score = Math.max(0, score - 5);
              // reset a revealed pad (make it slightly harder)
              if(nextIndex>0) { nextIndex = Math.max(0, nextIndex-1); revealed[nextIndex] = false; }
              // nudge ball away
              b.vy = -Math.abs(b.vy)*0.9; b.vx *= -0.6;
            }
            updateGameUI();
          }
        });
        // draw ball
        ctx.beginPath(); ctx.fillStyle = b.color; ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill(); ctx.closePath();
      }
      // game over
      if(lives <= 0 && !gameOver){ gameOver = true; }
      if(gameOver){ ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0,0,W,H); ctx.fillStyle='var(--fg)'; ctx.font='bold 28px Rubik, Arial'; ctx.textAlign='center'; ctx.fillText('Game Over — press Reset to try again', W/2, H/2); }
      // win
      if(nextIndex >= pads.length){ ctx.fillStyle = 'var(--fg)'; ctx.font = 'bold 28px Rubik, Arial'; ctx.textAlign='center'; ctx.fillText('You spelled J i m m y! Merry Christmas!', W/2, 36); }
      requestAnimationFrame(step);
    }
    step();

    // spawn ball on pointer/touch (works for mouse, stylus, touch)
    const pointerHandler = (e) => {
      if(gameOver) return;
      if(e.preventDefault) e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const clientX = (e.clientX !== undefined) ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
      const clientY = (e.clientY !== undefined) ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
      spawnBall(clientX - rect.left, clientY - rect.top);
    };
    if (window.PointerEvent) {
      canvas.addEventListener('pointerdown', (e)=>{
        // ignore non-primary pointers to avoid duplicates (e.g., pen + touch)
        if (e.isPrimary === false) return;
        pointerHandler(e);
      }, {passive:false});
    } else {
      // older browsers: listen to touchstart and mousedown, dedupe by time
      let lastTouch = 0;
      canvas.addEventListener('touchstart', (e)=>{ lastTouch = performance.now(); pointerHandler(e); }, {passive:false});
      canvas.addEventListener('mousedown', (e)=>{ if(performance.now() - lastTouch < 300) return; pointerHandler(e); });
    }
    document.getElementById('gameReset')?.addEventListener('click', reset);
    document.getElementById('gameAdd')?.addEventListener('click', ()=>spawnBall());
    updateGameUI();
  }

  /* compute inverted foreground color from CSS variables */
  function updateForegroundColor(){
    const root = getComputedStyle(document.documentElement);
    const bg1 = root.getPropertyValue('--bg1').trim() || '#071129';
    const bg2 = root.getPropertyValue('--bg2').trim() || '#2b0036';
    function hexToRgb(hex){ hex = hex.replace('#',''); if(hex.length===3) hex = hex.split('').map(s=>s+s).join(''); return {r:parseInt(hex.substr(0,2),16), g:parseInt(hex.substr(2,2),16), b:parseInt(hex.substr(4,2),16)} }
    try{
      const a = hexToRgb(bg1); const b = hexToRgb(bg2);
      const avg = { r: Math.round((a.r + b.r)/2), g: Math.round((a.g + b.g)/2), b: Math.round((a.b + b.b)/2) };
      const inv = { r:255-avg.r, g:255-avg.g, b:255-avg.b };
      document.documentElement.style.setProperty('--fg', `rgb(${inv.r}, ${inv.g}, ${inv.b})`);
    }catch(e){ /* fallback */ document.documentElement.style.setProperty('--fg', '#eaeaea'); }
  }

  // run game and fg update after small delay (ensure DOM)
  setTimeout(()=>{ try{ updateForegroundColor(); initGame(); }catch(e){ console.warn('game init error', e) } }, 300);
})();
