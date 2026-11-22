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

  /* ---------- VERTICAL STAGE carousel (wise.design style) ---------- */
  const reel = (() => {
    const stage = $('[data-stage]'), items = $$('.item', stage), N = items.length;
    const rot = $('.insp-title .rot'), playBtn = $('[data-play]');
    const DUR = 4200, GAP = 14;
    let idx = 0, playing = !reduce, hold = false, last = performance.now(), elapsed = 0;
    const ar = items.map(it => { const [a, b] = it.dataset.ar.split('/').map(Number); return a / b; });

    function sizes() {
      const vw = innerWidth, vh = innerHeight, mobile = vw < 640;
      const boxW = mobile ? vw - 32 : Math.min(vw * 0.62, 1040);
      const boxH = vh - (mobile ? 250 : 300);
      const thumbW = mobile ? 76 : 124;
      return items.map((_, i) => {
        let w = boxW, h = w / ar[i];
        if (h > boxH) { h = boxH; w = h * ar[i]; }
        return { w, h, s: thumbW / w };
      });
    }

    function layout(anim = true) {
      const sz = sizes();
      const pos = new Array(N);
      pos[idx] = 0;
      for (let i = idx + 1; i < N; i++) {
        const prevH = i - 1 === idx ? sz[i - 1].h : sz[i - 1].h * sz[i - 1].s;
        pos[i] = pos[i - 1] + prevH / 2 + GAP + (sz[i].h * sz[i].s) / 2;
      }
      for (let i = idx - 1; i >= 0; i--) {
        const nextH = i + 1 === idx ? sz[i + 1].h : sz[i + 1].h * sz[i + 1].s;
        pos[i] = pos[i + 1] - nextH / 2 - GAP - (sz[i].h * sz[i].s) / 2;
      }
      items.forEach((it, i) => {
        const { w, h, s } = sz[i], active = i === idx, sc = active ? 1 : s;
        it.style.transition = anim ? '' : 'none';
        it.style.width = w + 'px'; it.style.height = h + 'px';
        it.style.marginLeft = -w / 2 + 'px'; it.style.marginTop = -h / 2 + 'px';
        it.style.transform = `translate3d(0,${pos[i]}px,0) scale(${sc})`;
        it.style.setProperty('--rad', active ? '24px' : Math.min(w, h) / 2 + 'px');
        it.style.opacity = Math.abs(pos[i]) > innerHeight ? 0 : 1;
        it.classList.toggle('active', active);
        it.setAttribute('aria-hidden', !active);
      });
    }

    function setTitle() {
      const it = items[idx];
      const span = document.createElement('span');
      span.className = 'rot-item in';
      span.innerHTML = `${String(idx + 1).padStart(2, '0')} — ${it.dataset.title}<small>${it.dataset.desc}</small>`;
      rot.replaceChildren(span);
    }

    function go(i, anim = true) {
      idx = Math.max(0, Math.min(N - 1, i));
      layout(anim); setTitle(); elapsed = 0;
    }
    const next = () => go(idx + 1 >= N ? 0 : idx + 1);
    const prev = () => go(idx - 1);

    setInterval(() => {
      const now = performance.now(), dt = now - last; last = now;
      if (playing && !hold && view === 'inspiration' && !document.hidden && !panel) {
        elapsed += dt;
        if (elapsed >= DUR) next();
      }
    }, 100);

    // wheel / trackpad (vertical or horizontal)
    let wheelAcc = 0, wheelLock = 0;
    stage.addEventListener('wheel', e => {
      e.preventDefault();
      const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      const now = Date.now(); if (now < wheelLock) return;
      wheelAcc += d;
      if (Math.abs(wheelAcc) > 40) { wheelAcc > 0 ? next() : prev(); wheelAcc = 0; wheelLock = now + 550; }
    }, { passive: false });

    // drag / swipe
    let sy = null, sx = 0, moved = false;
    stage.addEventListener('pointerdown', e => { sy = e.clientY; sx = e.clientX; moved = false; hold = true; stage.classList.add('dragging'); });
    addEventListener('pointermove', e => {
      if (sy === null) return;
      const dy = e.clientY - sy, dx = e.clientX - sx, d = Math.abs(dy) > Math.abs(dx) ? dy : dx;
      if (Math.abs(d) > 45) { d < 0 ? next() : prev(); sy = e.clientY; sx = e.clientX; moved = true; }
    });
    const end = () => { if (sy === null) return; sy = null; hold = false; stage.classList.remove('dragging'); };
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
    stage.addEventListener('click', e => {
      if (moved) return;
      const it = e.target.closest('.item'); if (it && !it.classList.contains('active')) go(items.indexOf(it));
    });

    addEventListener('keydown', e => {
      if (view !== 'inspiration' || panel) return;
      if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); next(); }
      if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
    });

    function setPlaying(p) {
      playing = p; playBtn.classList.toggle('paused', !p);
      playBtn.setAttribute('aria-label', p ? 'Pausar' : 'Reproducir');
    }
    playBtn.addEventListener('click', () => setPlaying(!playing));
    setPlaying(playing);
    addEventListener('resize', () => layout(false));
    go(0, false);

    return { go, pause: () => {}, resume: () => requestAnimationFrame(() => layout(false)) };
  })();

  // intro animation on first load (card spins in, carousel rises)
  if (!reduce && parse().v === 'inspiration') {
    root.classList.add('intro');
    setTimeout(() => root.classList.remove('intro'), 1100);
  }

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
