(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- toast + save helpers ---------- */
  const toastEl = $('.toast');
  let toastT;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 1800); }
  function save(name, blob) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
  }

  /* ---------- split mega headings into chars ---------- */
  $$('[data-split]').forEach(h => {
    h.innerHTML = [...h.textContent].map((c, i) => `<span class="ch" style="transition-delay:${i * 35}ms">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  });

  /* ---------- switch thumb ---------- */
  const thumb = $('.switch-thumb');
  function placeThumb() {
    const on = $('.switch a.on'); if (!on) return;
    thumb.style.width = on.offsetWidth + 'px';
    thumb.style.transform = `translateX(${on.offsetLeft - 4}px)`;
  }
  addEventListener('resize', placeThumb);
  if (window.ResizeObserver) { const ro = new ResizeObserver(placeThumb); $$('.switch a').forEach(a => ro.observe(a)); }
  addEventListener('load', placeThumb);

  /* ---------- router: #/inspiration, #/direction, #/direction/<panel> ---------- */
  const curtain = $('.curtain'), cWord = $('.curtain-word');
  const panels = $$('.panel'), panelIds = panels.map(p => p.dataset.panel);
  let view = null, panel = null, busy = false;

  function parse() {
    const [, v, p] = (location.hash || '#/inspiration').split('/');
    return { v: v === 'direction' ? 'direction' : 'inspiration', p: panelIds.includes(p) ? p : null };
  }

  function setView(v) {
    view = v;
    root.dataset.view = v;
    $$('.switch a').forEach(a => a.classList.toggle('on', a.dataset.route === v));
    placeThumb();
    const sec = $('#' + v);
    sec.classList.remove('ready');
    requestAnimationFrame(() => requestAnimationFrame(() => sec.classList.add('ready')));
    scrollTo({ top: 0, behavior: 'instant' });
    document.title = `BACO Studio — ${v === 'direction' ? 'Dirección de marca' : 'Inspiración'} · Manual de marca`;
    v === 'inspiration' ? reel.resume() : reel.pause(true);
  }

  function changeView(v, after) {
    if (view === null || reduce) { setView(v); after && after(); return; }
    if (busy) return; busy = true;
    
    curtain.className = 'curtain in';
    setTimeout(() => {
      setView(v);
      curtain.className = 'curtain out';
      setTimeout(() => { curtain.className = 'curtain'; busy = false; after && after(); }, 460);
    }, 360);
  }

  function openPanel(id) {
    panel = id;
    panels.forEach(p => p.classList.toggle('on', p.dataset.panel === id));
    const p = panels.find(x => x.dataset.panel === id);
    $('#sheetCrumb').textContent = 'Dirección · ' + p.dataset.name;
    $('.sheet-body').scrollTop = 0;
    document.body.classList.add('sheet-open', 'locked');
    if (id === 'plantillas') renderTplPreviews();
  }
  function closePanel() {
    panel = null;
    document.body.classList.remove('sheet-open', 'locked');
  }

  function route() {
    const { v, p } = parse();
    if (v !== view) {
      closePanel();
      changeView(v, () => p && openPanel(p));
    } else if (p) openPanel(p);
    else closePanel();
  }
  addEventListener('hashchange', route);

  $$('[data-close]').forEach(b => b.addEventListener('click', () => { location.hash = '#/direction'; }));
  const step = d => { const i = panelIds.indexOf(panel); location.hash = '#/direction/' + panelIds[(i + d + panelIds.length) % panelIds.length]; };
  $('[data-sheet-prev]').addEventListener('click', () => step(-1));
  $('[data-sheet-next]').addEventListener('click', () => step(1));
  addEventListener('keydown', e => {
    if (!panel) return;
    if (e.key === 'Escape') location.hash = '#/direction';
    if (e.target.matches('input')) return;
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });

  /* ---------- hide bar on scroll down ---------- */
  const bar = $('.bar'); let lastY = 0;
  addEventListener('scroll', () => {
    const y = scrollY; bar.classList.toggle('hide', y > 160 && y > lastY); lastY = y;
  }, { passive: true });

  /* ---------- REEL carousel ---------- */
  const reel = (() => {
    const el = $('[data-reel]'), track = $('.reel-track', el), cards = $$('.card', el);
    const cap = $('.reel-caption'), tagEl = $('.reel-tag'), titleEl = $('.reel-title');
    const countEl = $('.reel-count b'), dotsEl = $('.reel-dots'), playBtn = $('[data-play]');
    const N = cards.length, DUR = 5200;
    $('.reel-count').lastChild.textContent = ' / ' + String(N).padStart(2, '0');
    const dots = cards.map((_, i) => {
      const b = document.createElement('button'); b.setAttribute('role', 'tab'); b.setAttribute('aria-label', 'Historia ' + (i + 1));
      b.addEventListener('click', () => go(i)); dotsEl.appendChild(b); return b;
    });
    let idx = 0, x = 0, playing = !reduce, hold = false, t0 = performance.now(), elapsed = 0;

    const offsetFor = i => {
      const c = cards[i];
      return -(c.offsetLeft + c.offsetWidth / 2 - el.clientWidth / 2);
    };
    function apply(px, anim) {
      track.style.transition = anim ? 'transform .9s cubic-bezier(.2,.8,.2,1)' : 'none';
      track.style.transform = `translate3d(${px}px,0,0)`;
    }
    function go(i, anim = true) {
      idx = (i + N) % N; x = offsetFor(idx); apply(x, anim);
      cards.forEach((c, k) => { c.classList.toggle('active', k === idx); c.setAttribute('aria-hidden', k !== idx); });
      dots.forEach((d, k) => { d.classList.toggle('on', k === idx); d.style.setProperty('--p', 0); });
      countEl.textContent = String(idx + 1).padStart(2, '0');
      tagEl.textContent = cards[idx].dataset.tag; titleEl.textContent = cards[idx].dataset.title;
      cap.classList.remove('swap'); void cap.offsetWidth; cap.classList.add('swap');
      elapsed = 0; t0 = performance.now();
    }

    // autoplay loop with progress in the active dot
    function tick(now) {
      if (playing && !hold && view === 'inspiration') {
        elapsed += now - t0;
        const p = Math.min(elapsed / DUR, 1);
        dots[idx].style.setProperty('--p', p);
        if (p >= 1) go(idx + 1);
      }
      t0 = now; requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // drag / swipe with velocity
    let sx = 0, sy = 0, base = 0, dragging = false, moved = false, lastX = 0, lastT = 0, v = 0, axis = null;
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      dragging = true; moved = false; axis = null; sx = lastX = e.clientX; sy = e.clientY; base = x; lastT = performance.now(); v = 0; hold = true;
    });
    addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!axis && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (axis === 'x') { el.classList.add('dragging'); el.setPointerCapture?.(e.pointerId); }
      }
      if (axis !== 'x') return;
      moved = true;
      const now = performance.now(); v = (e.clientX - lastX) / Math.max(now - lastT, 1); lastX = e.clientX; lastT = now;
      // rubber-band at the ends
      let nx = base + dx; const min = offsetFor(N - 1), max = offsetFor(0);
      if (nx > max) nx = max + (nx - max) * .35; if (nx < min) nx = min + (nx - min) * .35;
      apply(nx, false); x = nx;
    });
    function end() {
      if (!dragging) return; dragging = false; el.classList.remove('dragging'); hold = false;
      if (!moved) return;
      const projected = x + v * 220; // momentum
      let best = 0, bd = Infinity;
      cards.forEach((_, i) => { const d = Math.abs(offsetFor(i) - projected); if (d < bd) { bd = d; best = i; } });
      if (best === idx && Math.abs(v) > .3) best = idx + (v < 0 ? 1 : -1);
      go(Math.max(0, Math.min(N - 1, best)));
    }
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
    el.addEventListener('click', e => {
      if (moved) { e.preventDefault(); return; }
      const c = e.target.closest('.card'); if (c) { const i = cards.indexOf(c); if (i !== idx) go(i); }
    }, true);

    // horizontal wheel / trackpad
    let wheelLock = 0;
    el.addEventListener('wheel', e => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 12) return;
      e.preventDefault(); const now = Date.now(); if (now < wheelLock) return;
      wheelLock = now + 650; go(idx + (e.deltaX > 0 ? 1 : -1));
    }, { passive: false });

    el.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
    });
    el.addEventListener('mouseenter', () => hold = true);
    el.addEventListener('mouseleave', () => { if (!dragging) hold = false; });
    $('[data-prev]').addEventListener('click', () => go(idx - 1));
    $('[data-next]').addEventListener('click', () => go(idx + 1));
    function setPlaying(p) {
      playing = p; playBtn.classList.toggle('paused', !p);
      playBtn.setAttribute('aria-label', p ? 'Pausar' : 'Reproducir');
    }
    playBtn.addEventListener('click', () => setPlaying(!playing));
    setPlaying(playing);
    document.addEventListener('visibilitychange', () => { hold = document.hidden; });
    addEventListener('resize', () => go(idx, false));

    return { go, pause: () => {}, resume: () => requestAnimationFrame(() => go(idx, false)) };
  })();

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('show'); io.unobserve(e.target); } }), { threshold: .15 });
  $$('.reveal').forEach(el => io.observe(el));

  /* ---------- color copy ---------- */
  $$('[data-hex]').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.hex); toast(b.dataset.hex + ' copiado ✓'); }
    catch { toast(b.dataset.hex); }
  }));

  /* ---------- type playground ---------- */
  const spec = $('#specimen'), ti = $('#typeInput'), ts = $('#typeSize');
  const upType = () => { spec.textContent = ti.value || ' '; spec.style.fontSize = ts.value + 'px'; };
  ti.addEventListener('input', upType); ts.addEventListener('input', upType);
  if (innerWidth < 640) ts.value = 40; upType();

  /* ---------- logo lab ---------- */
  const DARK = ['#1C1B19', '#4F5A43'];
  const lab = { logo: 'assets/baco-studio.png', bg: '#F4F1EA' };
  const prev = $('#preview'), prevLogo = $('#previewLogo'), scale = $('#scale');
  function upLab() {
    prevLogo.src = lab.logo; prev.style.background = lab.bg;
    prev.classList.toggle('on-dark', DARK.includes(lab.bg));
    prevLogo.style.width = scale.value + '%'; $('#scaleLabel').textContent = scale.value + '%';
  }
  $$('[data-seg]').forEach(seg => seg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('button', seg).forEach(x => x.classList.toggle('on', x === b));
    lab[seg.dataset.seg] = b.dataset.v; upLab();
  }));
  scale.addEventListener('input', upLab); upLab();
  $('#compBtn').addEventListener('click', async () => {
    const img = new Image(); img.src = lab.logo; await img.decode();
    const c = document.createElement('canvas'); c.width = 1600; c.height = 1000;
    const ctx = c.getContext('2d'); ctx.fillStyle = lab.bg; ctx.fillRect(0, 0, c.width, c.height);
    const r = Math.min(c.width * scale.value / 100 / img.width, c.height * .7 / img.height);
    const w = img.width * r, h = img.height * r;
    if (DARK.includes(lab.bg)) { ctx.filter = 'invert(1)'; ctx.globalCompositeOperation = 'screen'; }
    else ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
    c.toBlob(b => b && save('BACO-composicion.png', b), 'image/png');
    toast('Composición descargada');
  });

  /* ---------- SVG templates ---------- */
  function svg(type) {
    const dims = { post: [1080, 1080], story: [1080, 1920], deck: [1920, 1080] }, [w, h] = dims[type];
    const bg = { post: '#1C1B19', story: '#4F5A43', deck: '#E6DFD3' }[type], fg = type === 'post' ? '#F4F1EA' : '#1C1B19';
    const title = { post: ['ESPACIOS', 'CON SENTIDO'], story: ['DISEÑAR', 'EL FUTURO'], deck: ['ARQUITECTURA', 'EN MOVIMIENTO'] }[type];
    const fs = type === 'deck' ? 150 : 110, f = 'Inter Tight,Arial,sans-serif';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/><text x="70" y="110" fill="${fg}" font-size="26" font-weight="700" font-family="${f}" letter-spacing="5">BACO STUDIO</text><text x="70" y="${h * .5}" fill="${fg}" font-size="${fs}" font-weight="400" font-family="Bodoni Moda,Didot,Georgia,serif" letter-spacing="-2">${title[0]}</text><text x="70" y="${h * .5 + fs}" fill="${fg}" font-size="${fs}" font-weight="400" font-family="Bodoni Moda,Didot,Georgia,serif" letter-spacing="-2">${title[1]}</text><circle cx="${w - 110}" cy="100" r="30" fill="${type === 'story' ? '#1C1B19' : '#4F5A43'}"/><line x1="70" y1="${h - 120}" x2="${w - 70}" y2="${h - 120}" stroke="${fg}" stroke-width="2"/><text x="70" y="${h - 70}" fill="${fg}" font-size="22" font-family="${f}" letter-spacing="4">ARQUITECTURA Y CONSTRUCCIÓN</text></svg>`;
  }
  function renderTplPreviews() { $$('[data-tpl]').forEach(d => { if (!d.innerHTML) d.innerHTML = svg(d.dataset.tpl); }); }
  $$('[data-svg]').forEach(b => b.addEventListener('click', () => { save(`BACO-${b.dataset.svg}.svg`, new Blob([svg(b.dataset.svg)], { type: 'image/svg+xml' })); toast('Plantilla descargada'); }));

  const css = ':root {\n  --baco-carbon: #1C1B19;\n  --baco-hueso: #F4F1EA;\n  --baco-olivo: #4F5A43;\n  --baco-travertino: #E6DFD3;\n  --baco-font-display: "Inter Tight", sans-serif;\n  --baco-font-body: "Inter", sans-serif;\n  --baco-radius: 24px;\n}\n';
  $$('[data-css]').forEach(b => b.addEventListener('click', () => { save('BACO-tokens.css', new Blob([css], { type: 'text/css' })); toast('Tokens descargados'); }));

  /* ---------- motion replay ---------- */
  

  /* ---------- ZIP kit ---------- */
  $('#zipBtn').addEventListener('click', async () => {
    const status = $('#status'), btn = $('#zipBtn');
    if (!window.JSZip) { status.textContent = 'No se cargó el generador ZIP. Descarga los archivos desde Recursos.'; return; }
    btn.disabled = true; status.textContent = 'Preparando recursos…';
    try {
      const z = new JSZip();
      const [a, b] = await Promise.all(['assets/baco-studio.png', 'assets/baco.png'].map(u => fetch(u).then(r => r.blob())));
      z.file('logos/BACO-Studio-original.png', a); z.file('logos/BACO-original.png', b);
      ['post', 'story', 'deck'].forEach(t => z.file(`plantillas/BACO-${t}.svg`, svg(t)));
      z.file('tokens/BACO-tokens.css', css);
      z.file('LEEME.txt', 'BACO STUDIO / DESIGN SYSTEM\nLogotipos originales PNG, plantillas SVG editables y tokens CSS.\nLas plantillas y los colores son propuestas digitales, no archivos vectoriales originales del logo.\n');
      save('BACO-Studio-Brand-Kit.zip', await z.generateAsync({ type: 'blob' }));
      status.textContent = 'Descarga lista ✓';
    } catch { status.textContent = 'No fue posible crear el ZIP. Usa las descargas individuales.'; }
    finally { btn.disabled = false; }
  });

  /* ---------- boot ---------- */
  document.fonts?.ready.then(placeThumb);
  route();
})();
