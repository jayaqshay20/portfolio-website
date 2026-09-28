/* Lightweight — scene, camera stations, lighting and world-anchored overlays. */
window.LWGL = function (ctx) {
  'use strict';
  if (!window.THREE || !window.LWWheel) return null;
  const THREE = window.THREE;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: ctx.canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { return null; }

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, t) => a + (b - a) * t;
  const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  let W = innerWidth, H = innerHeight;
  const lowPower = ctx.embedded || !ctx.fine || Math.min(W, H) < 640;
  const PR = Math.min(devicePixelRatio || 1, ctx.embedded ? 1 : lowPower ? 1.5 : 1.75);
  renderer.setPixelRatio(PR);
  renderer.setClearColor(0x050607, 1);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = !lowPower;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, W / H, .05, 200);

  /* ---------- studio environment: softbox strips for long carbon highlights ---------- */
  {
    const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshBasicMaterial({ color: 0x040506, side: THREE.BackSide })));
    const box = (w, h, x, y, z, k, col) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col || 0xffffff).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m);
    };
    box(16, 2.4, 0, 10, 2, 3.4); box(1.4, 14, -11, 1, 5, 2.6); box(1.1, 14, 11, 0, -3, 1.9);
    box(9, 5, 2, 3, 13, .7); box(10, 1.2, 0, -9, 3, .35, 0x7fa6ff);
    scene.environment = pm.fromScene(es, .03).texture;
    pm.dispose();
  }

  const wheel = window.LWWheel(THREE, renderer, { lowPower });
  const { root, spin, R, CU } = wheel;
  scene.add(root);

  /* ---------- lights ---------- */
  const key = new THREE.SpotLight(0xfff4ea, 0, 0, .42, .85, 1); key.target = root; scene.add(key);
  if (!lowPower) {
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0002; key.shadow.normalBias = .02;
    key.shadow.camera.near = 3; key.shadow.camera.far = 30;
  }
  const rimL = new THREE.DirectionalLight(0xdfe7ff, 0); rimL.target = root; scene.add(rimL);
  const blueL = new THREE.DirectionalLight(0x2f7dff, 0); blueL.target = root; scene.add(blueL);
  const fillL = new THREE.DirectionalLight(0xc8d2e0, 0); fillL.target = root; scene.add(fillL);
  const hemi = new THREE.HemisphereLight(0x8a96a6, 0x050506, 0); scene.add(hemi);
  const curL = new THREE.PointLight(0xffffff, 0, 5, 2); scene.add(curL);

  /* ---------- backdrop glow + atmospheric dust ---------- */
  const bdC = document.createElement('canvas'); bdC.width = bdC.height = 256;
  { const x = bdC.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.45, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(46, 30), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bdC), color: 0x2a3038, transparent: true, depthWrite: false, opacity: 0 }));
  backdrop.renderOrder = -1; scene.add(backdrop);

  const DU = { uTime: { value: 0 }, uAng: { value: 0 }, uLit: { value: 0 }, uPix: { value: PR }, uC: { value: new THREE.Vector3() } };
  {
    const n = ctx.embedded ? 260 : lowPower ? 520 : 1100, p = new Float32Array(n * 3), s = new Float32Array(n);
    for (let i = 0; i < n; i++) { p[i * 3] = .4 + Math.pow(Math.random(), .7) * 7.5; p[i * 3 + 1] = Math.random() * 6.2832; p[i * 3 + 2] = -3.5 + Math.random() * 7.5; s[i] = Math.random(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: DU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aS; uniform float uTime, uAng, uLit, uPix; uniform vec3 uC; varying float vA;
        void main(){
          float a = position.y + uAng * (.2 + aS * .6) + uTime * .015 * (aS - .5);
          vec3 p = uC + vec3(cos(a) * position.x, sin(a) * position.x + sin(uTime * .23 + aS * 40.) * .18, position.z + cos(uTime * .17 + aS * 20.) * .2);
          vec4 mv = modelViewMatrix * vec4(p, 1.); float d = -mv.z;
          gl_PointSize = clamp(uPix * (1.2 + aS * 2.2) * 9. / d, 1., 18. * uPix);
          vA = uLit * (.2 + .8 * fract(aS * 13.7)) * smoothstep(.25, 2., d) * smoothstep(26., 8., d);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(.8,.86,.95), smoothstep(.5, 0., d) * vA * .45); }`
    }));
    pts.frustumCulled = false; scene.add(pts);
  }

  /* ---------- camera stations (one per section) ---------- */
  const _o = new THREE.Object3D();
  let ST = [], portrait = false;
  function buildStations() {
    portrait = W / H < .82;
    const base = o => Object.assign({ wp: [0, 0, 0], wr: [0, 0], cam: [0, 0, 8], look: [0, 0, 0], fov: portrait ? 44 : 35, lit: 1, spin: 1, par: 1, morph: [0, 0, 0], sweep: 0, dust: 1, dip: 0 }, o);
    const rel = (o, lt, ld, dist, shift) => {
      o = base(o); _o.position.fromArray(o.wp); _o.rotation.set(o.wr[0], o.wr[1], 0); _o.updateMatrixWorld(true);
      const t = new THREE.Vector3().fromArray(lt).applyMatrix4(_o.matrixWorld);
      const d = new THREE.Vector3().fromArray(ld).normalize().transformDirection(_o.matrixWorld);
      o.cam = t.clone().addScaledVector(d, dist).toArray(); o.look = t.add(new THREE.Vector3().fromArray(shift)).toArray(); o.target = lt; return o;
    };
    ST = !portrait ? [
      base({ wp: [1.95, -.6, 0], wr: [.07, -.52], cam: [0, 0, 6.4], look: [.3, -.05, 0] }),
      base({ wp: [-2.7, -.05, 0], wr: [.02, -.1], cam: [0, 0, 12] }),
      rel({ wr: [0, -.42], spin: .05, par: .12, sweep: 1 }, [0, 2.93, .14], [.5, .2, 1], .66, [0, -.02, 0]),
      base({ wp: [3, .15, 0], wr: [.03, -.14], cam: [0, 0, 13.5], look: [.2, 0, 0], lit: .9 }),
      rel({ wp: [.2, 0, 0], wr: [.1, -.8], spin: .22, par: .3 }, [0, 0, .18], [.35, .42, 1], 2.7, [-.55, .05, 0]),
      base({ wp: [0, -.1, -2], wr: [.12, -.25], cam: [0, 0, 11.5], look: [0, 0, -1], lit: .6, dip: 1 }),
      base({ wp: [2.05, -.1, 0], wr: [.04, -.58], cam: [0, 0, 8.4], look: [.25, 0, 0], morph: [1, 0, 0], sweep: .3 }),
      base({ wp: [-2.05, -.1, 0], wr: [.04, .58], cam: [0, 0, 8.4], look: [-.25, 0, 0], morph: [0, 1, 0], sweep: .3 }),
      base({ wp: [2.05, -.1, 0], wr: [-.05, -.4], cam: [0, 0, 8.4], look: [.25, 0, 0], morph: [0, 0, 1], sweep: .3 }),
      base({ wp: [0, .3, -10], wr: [.2, -.35], cam: [0, 0, 10], look: [0, 0, -4], lit: .1, dust: .25 })
    ] : [
      base({ wp: [.9, -2.4, 0], wr: [.05, -.35], cam: [0, 0, 8.6] }),
      base({ wp: [0, -2.2, 0], wr: [.02, -.08], cam: [0, 0, 13] }),
      rel({ wr: [0, -.42], spin: .05, par: .12, sweep: 1 }, [0, 2.93, .14], [.5, .2, 1], .8, [0, -.08, 0]),
      base({ wp: [0, -1.7, 0], wr: [.03, -.1], cam: [0, 0, 16], lit: .9 }),
      rel({ wr: [.1, -.8], spin: .22, par: .3 }, [0, 0, .18], [.35, .42, 1], 3.4, [0, .55, 0]),
      base({ wp: [0, -.6, -2], wr: [.12, -.25], cam: [0, 0, 14], look: [0, 0, -1], lit: .6, dip: 1 }),
      base({ wp: [0, -2.2, 0], wr: [.04, -.5], cam: [0, 0, 10.5], morph: [1, 0, 0], sweep: .3 }),
      base({ wp: [0, -2.2, 0], wr: [.04, .5], cam: [0, 0, 10.5], morph: [0, 1, 0], sweep: .3 }),
      base({ wp: [0, -2.2, 0], wr: [-.05, -.4], cam: [0, 0, 10.5], morph: [0, 0, 1], sweep: .3 }),
      base({ wp: [0, -.5, -10], wr: [.2, -.35], cam: [0, 0, 12], look: [0, 0, -4], lit: .1, dust: .25 })
    ];
  }
  buildStations();
  const NS = ST.length;

  const pose = { wp: new THREE.Vector3(), cam: new THREE.Vector3(), look: new THREE.Vector3(), wr: [0, 0], fov: 35, lit: 1, spin: 1, par: 1, morph: [0, 0, 0], sweep: 0, dust: 1 };
  function samplePose(tf) {
    const k = Math.min(NS - 2, Math.floor(clamp(tf, 0, NS - 1))), f = clamp(tf - k, 0, 1), A = ST[k], B = ST[k + 1];
    const L3 = (v, a, b) => v.set(lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f));
    L3(pose.wp, A.wp, B.wp); L3(pose.cam, A.cam, B.cam); L3(pose.look, A.look, B.look);
    pose.wr[0] = lerp(A.wr[0], B.wr[0], f); pose.wr[1] = lerp(A.wr[1], B.wr[1], f);
    for (const n of ['fov', 'spin', 'par', 'sweep', 'dust']) pose[n] = lerp(A[n], B[n], f);
    for (let i = 0; i < 3; i++) pose.morph[i] = lerp(A.morph[i], B.morph[i], f);
    pose.lit = lerp(A.lit, B.lit, f) * (B.dip ? 1 - Math.sin(Math.PI * f) * .92 : 1); // pass through darkness
  }

  /* ---------- overlay helpers ---------- */
  const SVGNS = 'http://www.w3.org/2000/svg', $ = id => document.getElementById(id);
  const V = new THREE.Vector3(), T1 = new THREE.Vector3(), P0 = [0, 0, 0], P1 = [0, 0, 0];
  function proj(v, out) { V.copy(v).project(camera); out[0] = (V.x * .5 + .5) * W; out[1] = (-V.y * .5 + .5) * H; out[2] = V.z; return out; }
  const rootPt = (x, y, z, out) => proj(root.localToWorld(T1.set(x, y, z)), out);
  const f1 = n => n.toFixed(1);

  // airflow (potential flow around the projected wheel)
  const gFlow = $('g-flow'), flow = [];
  [.1, .24, .42, .64, .92, 1.3, 1.8].forEach(p => [1, -1].forEach(sg => {
    const b = document.createElementNS(SVGNS, 'path'), t = document.createElementNS(SVGNS, 'path');
    b.setAttribute('class', 'fl'); t.setAttribute('class', 'fl-t'); gFlow.append(b, t);
    flow.push({ psi: p * sg, b, t, off: Math.random() * 500, sp: 1 + Math.random() * .5 });
  }));
  let flowKey = '';
  function updateFlow(cx, cy, a, dt, speed) {
    const key = f1(cx) + f1(cy) + f1(a) + W;
    for (const L of flow) {
      if (key !== flowKey) {
        const psi = Math.abs(L.psi) * a, sg = Math.sign(L.psi); let d = '';
        for (let x = -20; x <= W + 20; x += 14) {
          const X = x - cx; let lo = Math.abs(X) < a ? Math.sqrt(a * a - X * X) : psi, hi = psi + a;
          for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (m - a * a * m / (X * X + m * m) - psi < 0) lo = m; else hi = m; }
          d += (d ? 'L' : 'M') + x + ' ' + f1(cy - sg * lo);
        }
        L.b.setAttribute('d', d); L.t.setAttribute('d', d);
      }
      L.off -= dt * speed * L.sp;
      L.t.style.strokeDashoffset = L.off; L.b.style.strokeDashoffset = L.off * .35;
    }
    flowKey = key;
  }
  const fgrad = $('fgrad');
  function updateMask() {
    const s = portrait ? [0, H * .5, 0, H * .36] : [W * .52, 0, W * .64, 0];
    ['x1', 'y1', 'x2', 'y2'].forEach((a, i) => fgrad.setAttribute(a, s[i]));
  }
  updateMask();

  // measurement instrument (weight)
  const mRing = $('m-ring'), mTick = $('m-tick'), mDim = $('m-dim'), mPtr = $('m-ptr'), mCross = $('m-cross'), mDimT = $('m-dim-t'), mTh = $('m-th');
  function updateMeasure(angle) {
    let d = '';
    for (let i = 0; i <= 96; i++) { const t = i / 96 * Math.PI * 2; rootPt(Math.cos(t) * (R + .32), Math.sin(t) * (R + .32), 0, P0); d += (i ? 'L' : 'M') + f1(P0[0]) + ' ' + f1(P0[1]); }
    mRing.setAttribute('d', d + 'Z');
    d = '';
    for (let i = 0; i < 72; i++) {
      const t = i / 72 * Math.PI * 2, r2 = R + .38 + (i % 6 ? .08 : .22);
      rootPt(Math.cos(t) * (R + .38), Math.sin(t) * (R + .38), 0, P0); rootPt(Math.cos(t) * r2, Math.sin(t) * r2, 0, P1);
      d += 'M' + f1(P0[0]) + ' ' + f1(P0[1]) + 'L' + f1(P1[0]) + ' ' + f1(P1[1]);
    }
    mTick.setAttribute('d', d);
    const yd = -(R + .95), seg = (x0, y0, x1, y1) => { rootPt(x0, y0, 0, P0); rootPt(x1, y1, 0, P1); return 'M' + f1(P0[0]) + ' ' + f1(P0[1]) + 'L' + f1(P1[0]) + ' ' + f1(P1[1]); };
    mDim.setAttribute('d', seg(-R, yd, R, yd) + seg(-R, -.1, -R, yd - .15) + seg(R, -.1, R, yd - .15) + seg(-R, yd + .08, -R + .16, yd) + seg(-R, yd - .08, -R + .16, yd) + seg(R, yd + .08, R - .16, yd) + seg(R, yd - .08, R - .16, yd));
    rootPt(0, yd - .3, 0, P0); mDimT.setAttribute('x', f1(P0[0])); mDimT.setAttribute('y', f1(P0[1]));
    mCross.setAttribute('d', seg(-.55, 0, .55, 0) + seg(0, -.55, 0, .55));
    const t = Math.PI / 2 - angle, c = Math.cos(t), s = Math.sin(t), r0 = R + .3;
    rootPt(c * r0, s * r0, 0, P0); rootPt(c * (r0 + .18) - s * .09, s * (r0 + .18) + c * .09, 0, P1);
    const q = [P1[0], P1[1]]; rootPt(c * (r0 + .18) + s * .09, s * (r0 + .18) - c * .09, 0, P1);
    mPtr.setAttribute('d', 'M' + f1(P0[0]) + ' ' + f1(P0[1]) + 'L' + f1(q[0]) + ' ' + f1(q[1]) + 'L' + f1(P1[0]) + ' ' + f1(P1[1]) + 'Z');
    rootPt(c * (r0 + .5), s * (r0 + .5), 0, P0);
    mTh.setAttribute('x', f1(P0[0] + 8)); mTh.setAttribute('y', f1(P0[1]));
    mTh.textContent = 'θ ' + (((angle * 180 / Math.PI) % 360 + 360) % 360).toFixed(1) + '°';
  }

  // carbon reticle
  const cRet = $('c-ret'), cX = $('c-x'), cLead = $('c-lead'), cBar = $('c-bar'), cBarT = $('c-bar-t'), cT = [$('c-t1'), $('c-t2'), $('c-t3')];
  function updateCarbon() {
    const t = ST[2].target;
    rootPt(t[0], t[1], t[2], P0); rootPt(t[0] + .05, t[1], t[2], P1);
    const x = P0[0], y = P0[1], r = 86, px5 = Math.hypot(P1[0] - x, P1[1] - y);
    cRet.setAttribute('cx', f1(x)); cRet.setAttribute('cy', f1(y));
    cX.setAttribute('d', `M${f1(x - r - 14)} ${f1(y)}h24M${f1(x + r - 10)} ${f1(y)}h24M${f1(x)} ${f1(y - r - 14)}v24M${f1(x)} ${f1(y + r - 10)}v24M${f1(x - 4)} ${f1(y)}h8M${f1(x)} ${f1(y - 4)}v8`);
    const lx = x + r * .72, ly = y - r * .72, ex = x + r + 70, ey = y - r - 30;
    cLead.setAttribute('d', `M${f1(lx)} ${f1(ly)}L${f1(ex - 20)} ${f1(ey)}H${f1(ex + 130)}`);
    cT.forEach((el, i) => { el.setAttribute('x', f1(ex - 14)); el.setAttribute('y', f1(ey - 10 + i * 16 + (i ? 26 : 0))); });
    const by = y + r + 34;
    cBar.setAttribute('d', `M${f1(x - px5 / 2)} ${f1(by - 4)}v8M${f1(x - px5 / 2)} ${f1(by)}H${f1(x + px5 / 2)}M${f1(x + px5 / 2)} ${f1(by - 4)}v8`);
    cBarT.setAttribute('x', f1(x + px5 / 2 + 10)); cBarT.setAttribute('y', f1(by + 3.5));
  }

  // DOM markers
  const mkRoot = $('mk');
  function makeMarker() {
    const el = document.createElement('div'); el.className = 'mk';
    el.innerHTML = '<i class="mk-x"></i><span class="mk-l"></span><div class="mk-t"><b></b><span></span></div>';
    mkRoot.appendChild(el);
    return { el, b: el.querySelector('b'), s: el.querySelector('.mk-t span'), vis: false, flip: null };
  }
  function place(m, x, y, op) {
    if (op < .01 || x < -40 || x > W + 40 || y < -40 || y > H + 40) { if (m.vis) { m.el.style.visibility = 'hidden'; m.el.style.opacity = 0; m.vis = false; } return; }
    if (!m.vis) { m.el.style.visibility = 'visible'; m.vis = true; }
    m.el.style.transform = 'translate3d(' + f1(x) + 'px,' + f1(y) + 'px,0)';
    m.el.style.opacity = op.toFixed(3);
    const fl = !m.fixed && x > W * .72; if (fl !== m.flip) { m.flip = fl; m.el.classList.toggle('flip', fl); }
  }
  const setText = (m, t, s) => { if (m.b.textContent !== t) { m.b.textContent = t; m.s.textContent = s; } };
  const PREC = [['A · THRU-AXLE', '12 × 100 MM · 7075-T6'], ['B · FLANGE', 'Ø 57 MM · CNC 7075'], ['C · SPOKE HEAD', 'LAMINATED · NO THREADS'], ['D · SPOKE', 'T1000 UD · 1,150 N']];
  // each precision marker gets its own leader direction so the labels fan out around the hub
  const PREC_POS = ['far', 'dr far', 'ul far', 'dl'];
  const precM = PREC.map((p, i) => { const m = makeMarker(); setText(m, p[0], p[1]); m.fixed = true; m.el.className += ' ' + PREC_POS[i]; return m; });
  const MODEL = [
    [['RIM DEPTH', '78 MM · TOROIDAL'], ['WIDTH', '29 / 21 MM'], ['WEIGHT', '1,420 G / PAIR']],
    [['RIM DEPTH', '32 MM · CLIMBING'], ['WIDTH', '25 / 19 MM'], ['WEIGHT', '1,050 G / PAIR']],
    [['RIM DEPTH', '47 MM · ALL-ROAD'], ['WIDTH', '33 / 25 MM'], ['WEIGHT', '1,290 G / PAIR']]
  ];
  const modM = [makeMarker(), makeMarker(), makeMarker()];
  const spinPt = (v, out) => proj(spin.localToWorld(T1.copy(v)), out);
  const tmpL = new THREE.Vector3();

  // hover light
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), nW = new THREE.Vector3(), hit = new THREE.Vector3(), wc = new THREE.Vector3();
  const snapPts = [];
  for (let i = 0; i < 41; i++) snapPts.push([0, 0, 0]);

  const sw = new Array(NS).fill(0);
  let hoverAmt = 0, lastFov = 0;
  const camTmp = new THREE.Vector3(), dirTmp = new THREE.Vector3();

  function resize() {
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    CU.uRes.value.set(W * PR, H * PR);
    const wasP = portrait; buildStations(); if (wasP !== portrait) flowKey = '';
    updateMask(); flowKey = '';
  }
  resize();

  /* ---------- per frame ---------- */
  function update(s) {
    const dt = s.dt, time = s.time, T = s.intro;
    samplePose(s.tf);
    for (let i = 0; i < NS; i++) sw[i] = clamp(1 - Math.abs(s.tf - i) * 2, 0, 1);

    const rimI = ctx.reduce ? 1 : clamp((T - .15) / 1.15, 0, 1);
    const introLit = ctx.reduce ? 1 : easeIO(clamp((T - .9) / 3, 0, 1));
    const sweepA = lerp(-1.75, .6, ctx.reduce ? 1 : easeIO(clamp((T - 1.1) / 3.7, 0, 1))) + Math.sin(time * .07) * .18;
    const dolly = ctx.reduce ? 0 : Math.pow(1 - clamp(T / 6, 0, 1), 3) * 3.2;
    const lit = pose.lit * introLit;

    root.position.copy(pose.wp);
    root.rotation.set(pose.wr[0] + Math.sin(time * .3) * .004, pose.wr[1], 0);
    spin.rotation.z = -s.angle;
    const D = wheel.setMorph(pose.morph);

    dirTmp.copy(pose.cam).sub(pose.look).normalize();
    camTmp.copy(pose.cam).addScaledVector(dirTmp, dolly);
    camTmp.x += s.mouse.sx * .18 * pose.par; camTmp.y -= s.mouse.sy * .12 * pose.par - Math.sin(time * .4) * .006 * pose.par;
    camera.position.copy(camTmp); camera.lookAt(pose.look);
    if (Math.abs(pose.fov - lastFov) > .01) { camera.fov = lastFov = pose.fov; camera.updateProjectionMatrix(); }

    const wp = pose.wp;
    key.position.set(wp.x + 9 * Math.sin(sweepA), wp.y + 5.5, wp.z + 9 * Math.cos(sweepA)); key.intensity = 2.5 * lit;
    rimL.position.set(wp.x - 3, wp.y + 7, wp.z - 8); rimL.intensity = rimI * (.35 + .65 * pose.lit) * 1.6;
    blueL.position.set(wp.x + 7, wp.y - 3, wp.z - 6); blueL.intensity = .6 * Math.max(lit, .25 * rimI);
    fillL.position.set(wp.x, wp.y + 1, wp.z + 6); fillL.intensity = .25 * lit;
    hemi.intensity = .1 * lit;
    wheel.setLit(lit);
    backdrop.position.set(wp.x * .6, wp.y * .6, wp.z - 7); backdrop.material.opacity = .9 * lit;

    CU.uTime.value = time; CU.uSweep.value = pose.sweep; CU.uLit.value = lit; CU.uWeaveAmt.value = 1 + hoverAmt * .8;
    DU.uTime.value = time; DU.uAng.value = s.angle * .18; DU.uC.value.copy(wp);
    DU.uLit.value = Math.max(lit, .12 * rimI) * pose.dust * (1 + Math.min(Math.abs(s.omega) * .08, .6));

    root.updateMatrixWorld(true); camera.updateMatrixWorld();

    // projected wheel
    root.getWorldPosition(wc); proj(wc, P0); const cx = P0[0], cy = P0[1];
    rootPt(R, 0, 0, P1); let pr = Math.hypot(P1[0] - cx, P1[1] - cy); rootPt(0, R, 0, P1); pr = (pr + Math.hypot(P1[0] - cx, P1[1] - cy)) / 2;

    // overlays
    const oF = sw[1], oC = sw[2], oM = sw[3];
    gFlow.setAttribute('opacity', oF.toFixed(3));
    if (oF > .01) updateFlow(cx, cy, pr * 1.1, dt, 90 + Math.abs(s.omega) * 60);
    $('g-meas').setAttribute('opacity', oM.toFixed(3)); if (oM > .01) updateMeasure(s.angle);
    $('g-carb').setAttribute('opacity', oC.toFixed(3)); if (oC > .01) updateCarbon();

    const oP = clamp(sw[4] * 1.4 - .3, 0, 1);
    if (oP > .01) {
      const sd = wheel.spokeData, h = wheel.headsLocal, j = wheel.jointsLocal;
      spinPt(tmpL.set(0, 0, .5), P0); place(precM[0], P0[0], P0[1], oP);
      spinPt(tmpL.set(.3 * Math.cos(2.3), .3 * Math.sin(2.3), wheel.FL_Z), P0); place(precM[1], P0[0], P0[1], oP);
      spinPt(h[1], P0); place(precM[2], P0[0], P0[1], oP);
      spinPt(tmpL.copy(h[9]).lerp(j[9], .3), P0); place(precM[3], P0[0], P0[1], oP);
      void sd;
    } else precM.forEach(m => place(m, 0, 0, 0));

    // product hover
    const mIdx = sw[6] >= sw[7] && sw[6] >= sw[8] ? 0 : sw[7] >= sw[8] ? 1 : 2, mW = sw[6 + mIdx];
    const over = mW > .4 && s.mouse.inside && !s.hoverUI && Math.hypot(s.mouse.px - cx, s.mouse.py - cy) < pr;
    hoverAmt += ((over ? 1 : 0) - hoverAmt) * (1 - Math.exp(-dt * 4));
    const mkOp = clamp(mW * 1.4 - .3, 0, 1) * (ctx.fine ? hoverAmt : 1);
    const md = MODEL[mIdx];
    md.forEach((t, i) => setText(modM[i], t[0], t[1]));
    if (mkOp > .01) {
      const a1 = .66, a2 = -.56;
      rootPt(Math.cos(a1) * R, Math.sin(a1) * R, 0, P0); place(modM[0], P0[0], P0[1], mkOp);
      rootPt(Math.cos(a2) * (R - D), Math.sin(a2) * (R - D), 0, P0); place(modM[1], P0[0], P0[1], mkOp);
      rootPt(0, 0, .45, P0); place(modM[2], P0[0], P0[1], mkOp);
    } else modM.forEach(m => place(m, 0, 0, 0));
    if (hoverAmt > .01) {
      ndc.set(s.mouse.px / W * 2 - 1, -(s.mouse.py / H) * 2 + 1); ray.setFromCamera(ndc, camera);
      nW.set(0, 0, 1).transformDirection(root.matrixWorld); plane.setFromNormalAndCoplanarPoint(nW, wc);
      if (ray.ray.intersectPlane(plane, hit)) curL.position.copy(hit).addScaledVector(nW, 1.1);
    }
    curL.intensity = hoverAmt * 2.6 * lit;

    // cursor snap targets: rim joints, flange heads, axis
    let snap = null;
    if (s.mouse.inside && !s.hoverUI && lit > .3) {
      let best = 24;
      for (let i = 0; i < 20; i++) {
        spinPt(wheel.jointsLocal[i], P0);
        let dd = Math.hypot(P0[0] - s.mouse.px, P0[1] - s.mouse.py); if (P0[2] < 1 && dd < best) { best = dd; snap = { x: P0[0], y: P0[1], label: 'J-' + String(i + 1).padStart(2, '0') + ' · RIM JOINT' }; }
        spinPt(wheel.headsLocal[i], P0);
        dd = Math.hypot(P0[0] - s.mouse.px, P0[1] - s.mouse.py); if (P0[2] < 1 && dd < best) { best = dd; snap = { x: P0[0], y: P0[1], label: 'H-' + String(i + 1).padStart(2, '0') + ' · FLANGE' }; }
      }
      const dd = Math.hypot(cx - s.mouse.px, cy - s.mouse.py); if (dd < best) snap = { x: cx, y: cy, label: 'AXIS · 0.00' };
    }

    if (!ctx.embedded || (s.frame & 1) === 0) renderer.render(scene, camera);
    return { snap, spin: pose.spin, lit };
  }

  return { update, resize, get spin() { return pose.spin; } };
};
