/* Lightweight — scroll physics, instruments, cursor, fallback. */
(() => {
  'use strict';
  const doc = document.documentElement;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let embedded = false; try { embedded = window.self !== window.top; } catch (e) { embedded = true; }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pad = (n, l) => String(n).padStart(l || 2, '0');
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  /* ---------- journey mapping ---------- */
  const secs = $$('.station'), NS = secs.length;
  const CH = secs.map(s => +s.dataset.ch), SIDE = secs.map(s => +s.dataset.side), NAMES = secs.map(s => s.dataset.name);
  let W = innerWidth, H = innerHeight, stopY = [], maxScroll = 1;
  function measure() {
    W = innerWidth; H = innerHeight;
    maxScroll = Math.max(1, doc.scrollHeight - H);
    stopY = secs.map((el, i) => { if (!i) return 0; const r = el.getBoundingClientRect(); return clamp(r.top + scrollY + r.height / 2 - H / 2, 0, maxScroll); });
    stopY[NS - 1] = maxScroll;
  }
  function tfAt(y) {
    if (y <= stopY[0]) return 0;
    for (let k = 0; k < NS - 1; k++) {
      if (y <= stopY[k + 1]) { const l = (y - stopY[k]) / Math.max(1, stopY[k + 1] - stopY[k]); return k + l * l * (3 - 2 * l); }
    }
    return NS - 1;
  }
  measure();
  addEventListener('load', measure);
  if (document.fonts) document.fonts.ready.then(measure);

  const nav = $('.nav'), menuBtn = $('.menu-btn');
  function go(i) { scrollTo({ top: stopY[i], behavior: reduce ? 'auto' : 'smooth' }); nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
  $$('[data-go]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); go(+el.dataset.go); }));
  menuBtn.addEventListener('click', () => menuBtn.setAttribute('aria-expanded', nav.classList.toggle('open')));
  let navY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    if (Math.abs(y - navY) > 6) { nav.classList.toggle('hide', y > navY && y > 120 && !nav.classList.contains('open')); navY = y; }
  }, { passive: true });

  /* ---------- pointer & cursor ---------- */
  const mouse = { px: W / 2, py: H / 2, sx: 0, sy: 0, nx: 0, ny: 0, inside: false };
  addEventListener('pointermove', e => { mouse.px = e.clientX; mouse.py = e.clientY; mouse.nx = e.clientX / W * 2 - 1; mouse.ny = e.clientY / H * 2 - 1; mouse.inside = true; }, { passive: true });
  doc.addEventListener('mouseleave', () => { mouse.inside = false; });
  let hoverUI = false;
  addEventListener('pointerover', e => { hoverUI = !!(e.target.closest && e.target.closest('a,button')); });
  const cursor = $('#cursor'), ringW = $('.c-ring-w'), dotW = $('.c-dot-w'), cTag = $('.c-tag'), cXY = $('.c-xy');
  const useCursor = fine && !embedded;
  if (useCursor) doc.classList.add('cursor-on');
  const ring = { x: W / 2, y: H / 2 };
  let lastTag = null;
  function updateCursor(dt, snap) {
    if (!useCursor) return;
    cursor.style.opacity = mouse.inside ? 1 : 0;
    const tx = snap ? snap.x : mouse.px, ty = snap ? snap.y : mouse.py, k = 1 - Math.exp(-dt * (snap ? 14 : 22));
    ring.x += (tx - ring.x) * k; ring.y += (ty - ring.y) * k;
    ringW.style.transform = 'translate3d(' + ring.x.toFixed(1) + 'px,' + ring.y.toFixed(1) + 'px,0)';
    dotW.style.transform = 'translate3d(' + mouse.px + 'px,' + mouse.py + 'px,0)';
    cursor.classList.toggle('hover', hoverUI);
    cursor.classList.toggle('snap', !!snap && !hoverUI);
    const tag = snap && !hoverUI ? snap.label : '';
    if (tag !== lastTag) { cTag.textContent = tag; lastTag = tag; }
    cXY.textContent = 'X ' + pad(Math.round(ring.x), 4) + ' · Y ' + pad(Math.round(ring.y), 4);
  }

  const mags = fine ? $$('.magnetic').map(el => ({ el, x: 0, y: 0 })) : [];
  function updateMagnets(dt) {
    for (const m of mags) {
      const r = m.el.getBoundingClientRect();
      if (r.bottom < -50 || r.top > H + 50) continue;
      const cx = r.left + r.width / 2 - m.x, cy = r.top + r.height / 2 - m.y, dx = mouse.px - cx, dy = mouse.py - cy;
      const d = Math.hypot(dx, dy), pull = mouse.inside && d < 120 ? 1 - d / 120 : 0, k = 1 - Math.exp(-dt * 10);
      m.x += (dx * .22 * pull - m.x) * k; m.y += (dy * .3 * pull - m.y) * k;
      m.el.style.transform = 'translate3d(' + m.x.toFixed(2) + 'px,' + m.y.toFixed(2) + 'px,0)';
    }
  }

  /* ---------- aero profile diagram (static SVG, CSS-animated flow) ---------- */
  (function buildProfile() {
    const svg = $('#profile-svg'); if (!svg) return;
    const NSV = 'http://www.w3.org/2000/svg', R = 3.11, A = .42, D = .5, Wd = .28, sc = 420, x0 = 118, cy = 104;
    const fP = u => Math.pow(Math.max(0, 1 - Math.pow(u, 2.4)), .55) * (.9 + .16 * Math.sin(Math.PI * u * .9));
    const prof = s => {
      if (s < A) { const u = s / A; return [R - D * u, Wd / 2 * fP(u)]; }
      if (s < 2 * A) { const u = 1 - (s - A) / A; return [R - D * u, -Wd / 2 * fP(u)]; }
      const q = (s - 2 * A) / (1 - 2 * A), y0 = Wd / 2 * fP(0); return [R - .045 * (1 - Math.pow(Math.abs(2 * q - 1), 8)), -y0 + 2 * y0 * q];
    };
    const el = (t, a, p) => { const e = document.createElementNS(NSV, t); for (const k in a) e.setAttribute(k, a[k]); (p || svg).appendChild(e); return e; };
    const defs = el('defs', {}), pat = el('pattern', { id: 'tw', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('rect', { width: 6, height: 6, fill: '#101317' }, pat); el('rect', { width: 3, height: 6, fill: '#1b1f25' }, pat);
    // half-thickness along the chord, then a forward-looking max envelope so lines lift before the leading edge
    const xs = [], T = [];
    for (let x = 0; x <= 460; x += 4) { xs.push(x); const u = (x - x0) / (D * sc); T.push(u >= 0 && u <= 1 ? Wd / 2 * fP(u) * sc : 0); }
    const Tenv = xs.map((x, i) => { let m = 0; xs.forEach((x2, j) => { m = Math.max(m, T[j] * Math.exp(-Math.pow((x2 - x) / 22, 2))); }); return Math.max(m, T[i]); });
    [6, 16, 30, 48, 70, 96].forEach((y0, n) => [1, -1].forEach(sg => {
      let d = ''; xs.forEach((x, i) => { d += (i ? 'L' : 'M') + x + ' ' + (cy - sg * (y0 + Tenv[i] * Math.exp(-y0 / 70) * 1.08)).toFixed(1); });
      el('path', { d, class: 'pf-l' });
      if (n % 2 === 0) el('path', { d, class: 'pf-t', style: 'animation-delay:' + (-(n * .7 + (sg > 0 ? 0 : 1.3))).toFixed(2) + 's' });
    }));
    let d = ''; for (let i = 0; i <= 240; i++) { const p = prof(i / 240); d += (i ? 'L' : 'M') + (x0 + (R - p[0]) * sc).toFixed(1) + ' ' + (cy - p[1] * sc).toFixed(1); }
    el('path', { d: d + 'Z', class: 'pf-shape' });
    const tMax = Math.max(...T), xMax = xs[T.indexOf(tMax)], yb = cy + tMax + 26, xe = x0 + D * sc, xd = x0 - 40;
    el('path', { class: 'pf-d', d: `M${x0} ${yb}H${xe}M${x0} ${yb - 5}v10M${xe} ${yb - 5}v10M${x0} ${cy + 50}V${yb + 4}M${xe} ${cy + 4}V${yb + 4}` });
    el('text', { x: (x0 + xe) / 2, y: yb + 16, 'text-anchor': 'middle', class: 'pf-x' }).textContent = '50 MM';
    el('path', { class: 'pf-d', d: `M${xd} ${cy - tMax}V${cy + tMax}M${xd - 5} ${cy - tMax}h10M${xd - 5} ${cy + tMax}h10M${xMax} ${cy - tMax}H${xd - 6}M${xMax} ${cy + tMax}H${xd - 6}` });
    el('text', { x: xd - 12, y: cy, 'text-anchor': 'middle', class: 'pf-x', transform: `rotate(-90 ${xd - 12} ${cy})` }).textContent = '28 MM';
    el('text', { x: 4, y: 12, class: 'pf-x' }).textContent = 'FLOW →';
  })();

  /* ---------- 3D world or fallback ---------- */
  const G = window.LWGL ? window.LWGL({ canvas: $('#gl'), reduce, embedded, fine }) : null;
  let fbWheel = null;
  if (!G) {
    doc.classList.add('no-gl');
    const g = $('#fb-wheel'), NSV = 'http://www.w3.org/2000/svg';
    const add = (t, a) => { const e = document.createElementNS(NSV, t); for (const k in a) e.setAttribute(k, a[k]); g.appendChild(e); };
    add('circle', { r: 300, fill: 'none', stroke: '#1f232a', 'stroke-width': 44 });
    add('circle', { r: 322, fill: 'none', stroke: '#3a4049', 'stroke-width': 1.5 });
    add('circle', { r: 278, fill: 'none', stroke: '#2a2f36', 'stroke-width': 1 });
    for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2, b = a + (i % 4 < 2 ? .09 : -.09); add('line', { x1: Math.cos(b) * 28, y1: Math.sin(b) * 28, x2: Math.cos(a) * 280, y2: Math.sin(a) * 280, stroke: '#2b3038', 'stroke-width': 5 }); }
    add('circle', { r: 30, fill: '#6f7680' }); add('circle', { r: 10, fill: 'none', stroke: '#2f8cff', 'stroke-width': 2 });
    fbWheel = g;
  }

  addEventListener('resize', () => { measure(); if (G) G.resize(); });

  /* ---------- DOM refs ---------- */
  const scrimL = $('.scrim-l'), scrimR = $('.scrim-r'), iCur = $('#i-cur'), iFill = $('#i-fill');
  const hRpm = $('#h-rpm'), hTh = $('#h-th'), hSec = $('#h-sec'), kgEl = $('#kg'), kgLive = $('#kg-live');
  const lastP = new Array(NS).fill(-1);
  kgEl.textContent = '0.00';

  /* ---------- state ---------- */
  const S = { tf: 0, omega: 0, angle: 0, sv: 0, lastY: scrollY, intro: reduce ? 30 : 0, time: 0, frame: 0, dt: 0, mouse, hoverUI: false, spin: 1 };
  // ?skip jumps past the intro, ?s=N opens at station N (handy for reviewing a single section)
  const q = new URLSearchParams(location.search);
  if (q.has('skip')) S.intro = 30;
  const jumpTo = q.has('s');
  if (jumpTo) { const n = clamp(+q.get('s') | 0, 0, NS - 1); addEventListener('load', () => { measure(); scrollTo(0, stopY[n]); S.lastY = scrollY; }); }
  S.tf = tfAt(scrollY);
  let heroIn = false, kgStart = null, slow = 0, last = performance.now();
  if (!G) { doc.classList.add('in'); heroIn = true; }

  function frame(now) {
    requestAnimationFrame(frame);
    S.frame++;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    S.dt = dt; S.time += dt * (reduce ? .4 : 1); S.intro += dt;

    // scroll → rotation with inertia: fast spin-up, slow mechanical settle
    const y = scrollY, inst = (y - S.lastY) / Math.max(dt, 1 / 240); S.lastY = y;
    S.sv += (inst - S.sv) * (1 - Math.exp(-dt * 8));
    const idle = (reduce ? .03 : .1) * clamp((S.intro - 1.4) / 2.8, 0, 1);
    const drive = clamp(S.sv * (reduce ? .0015 : .0042), -9, 9) + idle;
    const rate = Math.abs(drive) > Math.abs(S.omega) ? 3.4 : .7;
    S.omega += (drive - S.omega) * (1 - Math.exp(-dt * rate));
    S.angle += S.omega * dt * S.spin;

    const target = tfAt(y);
    S.tf += (target - S.tf) * (reduce || jumpTo ? 1 : 1 - Math.exp(-dt * 3.2));
    mouse.sx += (mouse.nx - mouse.sx) * (1 - Math.exp(-dt * 3)); mouse.sy += (mouse.ny - mouse.sy) * (1 - Math.exp(-dt * 3));
    S.hoverUI = hoverUI;

    let snap = null;
    if (G) { const r = G.update(S); snap = r.snap; S.spin = r.spin; }
    else if (fbWheel) fbWheel.setAttribute('transform', 'rotate(' + (S.angle * 180 / Math.PI).toFixed(2) + ')');

    if (!heroIn && S.intro > 2.1) { heroIn = true; doc.classList.add('in'); }

    // section reveal progress
    for (let i = 0; i < NS; i++) {
      const r = secs[i].getBoundingClientRect();
      const d = clamp((r.top + r.height / 2 - H / 2) / H, -1, 1), p = clamp(1 - Math.abs(d) * 1.55, 0, 1);
      if (Math.abs(p - lastP[i]) > .002 || (p === 0) !== (lastP[i] === 0)) {
        secs[i].style.setProperty('--p', p.toFixed(3)); secs[i].style.setProperty('--d', d.toFixed(3)); lastP[i] = p;
      }
    }
    // scrims follow the text side
    const a = Math.min(NS - 2, Math.floor(S.tf)), f = S.tf - a, side = SIDE[a] + (SIDE[a + 1] - SIDE[a]) * f;
    scrimL.style.opacity = (side <= .5 ? 1 - side * 1.3 : .35 - (side - .5) * .7).toFixed(3);
    scrimR.style.opacity = (side >= .5 ? .35 + (side - .5) * 1.3 : side * .7).toFixed(3);

    const k = Math.round(S.tf);
    iFill.style.transform = 'scaleY(' + (y / maxScroll).toFixed(4) + ')';

    // weight: count up once, then a live scale readout
    const wWeight = clamp(1 - Math.abs(S.tf - 3) * 2, 0, 1);
    if (kgStart === null && wWeight > .55) kgStart = S.time;
    if (kgStart !== null && S.time - kgStart < 2.2) kgEl.textContent = (1.18 * easeOut(clamp((S.time - kgStart) / 1.8, 0, 1))).toFixed(2);

    slow += dt;
    if (slow > .1) {
      slow = 0;
      const ic = pad(CH[k]); if (iCur.textContent !== ic) iCur.textContent = ic;
      hRpm.textContent = pad((Math.abs(S.omega * S.spin) * 60 / (2 * Math.PI)).toFixed(1), 5);
      hTh.textContent = pad((((S.angle * 180 / Math.PI) % 360 + 360) % 360).toFixed(1), 5) + '°';
      const sec = 'SEC ' + pad(k) + ' · ' + NAMES[k]; if (hSec.textContent !== sec) hSec.textContent = sec;
      if (wWeight > .05) kgLive.textContent = (1181.6 + Math.sin(S.angle * 2.3) * .35 + Math.sin(S.time * 7.1) * .08).toFixed(1).replace(/^(\d)(\d{3})/, '$1,$2') + ' g';
    }

    updateCursor(dt, snap);
    updateMagnets(dt);
  }
  requestAnimationFrame(frame);
})();
