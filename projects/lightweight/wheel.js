/* Lightweight — procedural carbon wheel (Three.js r128). Units: 1 = 100 mm. */
window.LWWheel = function (THREE, renderer, opts) {
  'use strict';
  const low = !!opts.lowPower;
  const R = 3.11, A = .42;                       // bead-seat radius, profile split
  const BASE = { D: .5, W: .28 };                // hero wheel: 50 mm deep, 28 mm wide
  const VARS = [{ D: .78, W: .29 }, { D: .32, W: .25 }, { D: .47, W: .33 }]; // L1, L2, L3

  /* ---------- rim profile: toroidal sidewalls + tyre bed, as a closed loop ---------- */
  const fProf = u => Math.pow(Math.max(0, 1 - Math.pow(u, 2.4)), .55) * (.9 + .16 * Math.sin(Math.PI * u * .9));
  function prof(s, D, Wd) {
    if (s < A) { const u = s / A; return [R - D * u, Wd / 2 * fProf(u)]; }
    if (s < 2 * A) { const u = 1 - (s - A) / A; return [R - D * u, -Wd / 2 * fProf(u)]; }
    const q = (s - 2 * A) / (1 - 2 * A), y0 = Wd / 2 * fProf(0);
    return [R - .045 * (1 - Math.pow(Math.abs(2 * q - 1), 8)), -y0 + 2 * y0 * q];
  }

  // resample by arclength so the weave and decal stay undistorted
  const DENSE = 3000, cum = [0];
  let prev = prof(0, BASE.D, BASE.W);
  for (let i = 1; i <= DENSE; i++) { const p = prof(i / DENSE, BASE.D, BASE.W); cum.push(cum[i - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1])); prev = p; }
  const Ltot = cum[DENSE];
  function sAtLen(L) {
    let lo = 0, hi = DENSE;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < L) lo = m; else hi = m; }
    return (lo + (L - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo])) / DENSE;
  }
  function vAtS(s) { const x = s * DENSE, i = Math.min(DENSE - 1, Math.floor(x)); return (cum[i] + (cum[i + 1] - cum[i]) * (x - i)) / Ltot; }
  const NPTS = low ? 84 : 120, SEG = low ? 256 : 400;
  const sList = []; for (let j = 0; j < NPTS; j++) sList.push(sAtLen(Ltot * j / (NPTS - 1)));

  function latheFor(D, Wd) {
    const g = new THREE.LatheGeometry(sList.map(s => { const p = prof(s, D, Wd); return new THREE.Vector2(p[0], p[1]); }), SEG);
    g.rotateX(Math.PI / 2); // wheel axis -> +z
    return g;
  }
  const rimGeo = latheFor(BASE.D, BASE.W);
  {
    const bp = rimGeo.attributes.position.array, bn = rimGeo.attributes.normal.array, mp = [], mn = [];
    VARS.forEach(v => {
      const g = latheFor(v.D, v.W), p = g.attributes.position.array, n = g.attributes.normal.array;
      const dp = new Float32Array(p.length), dn = new Float32Array(n.length);
      for (let i = 0; i < p.length; i++) { dp[i] = p[i] - bp[i]; dn[i] = n[i] - bn[i]; }
      mp.push(new THREE.BufferAttribute(dp, 3)); mn.push(new THREE.BufferAttribute(dn, 3)); g.dispose();
    });
    rimGeo.morphAttributes.position = mp; rimGeo.morphAttributes.normal = mn; rimGeo.morphTargetsRelative = true;
  }

  // v-coordinates of the decal bands, brake tracks and tyre bed
  const band = { a0: vAtS(.12 * A), a1: vAtS(.5 * A), b0: vAtS(1.5 * A), b1: vAtS(1.88 * A) };
  const Rband = R - BASE.D * .3, cellsX = 1100, cellsY = Math.round(Ltot / (2 * Math.PI * Rband / cellsX));

  /* ---------- decal ---------- */
  const dc = document.createElement('canvas'); dc.width = 4096; dc.height = low ? 512 : 1024;
  const dtex = new THREE.CanvasTexture(dc);
  dtex.anisotropy = renderer.capabilities.getMaxAnisotropy(); dtex.wrapS = THREE.RepeatWrapping;
  function drawDecal() {
    const c = dc.getContext('2d'), CW = dc.width, CHh = dc.height;
    c.clearRect(0, 0, CW, CHh);
    const k = (CHh / Ltot) / (CW / (2 * Math.PI * Rband)); // texel aspect correction
    [[band.a0, band.a1], [band.b0, band.b1]].forEach(([v0, v1]) => {
      const yT = (1 - v1) * CHh, yB = (1 - v0) * CHh, S = (yB - yT) * .6 / k, yc = (yT + yB) / 2;
      [.06, .56].forEach(px => {
        c.save(); c.translate(px * CW, yc); c.scale(1, k);
        c.fillStyle = '#2f8cff'; c.fillRect(0, -S * .07, S * .9, S * .14);
        c.font = '800 ' + S + 'px Archivo, Arial, sans-serif';
        try { c.fontStretch = 'ultra-expanded'; } catch (e) {}
        if ('letterSpacing' in c) c.letterSpacing = (S * .06) + 'px';
        c.textBaseline = 'middle'; c.fillStyle = '#b4bac2';
        c.fillText('LIGHTWEIGHT', S * 1.3, S * .04);
        const tw = c.measureText('LIGHTWEIGHT').width;
        c.font = '500 ' + (S * .3) + 'px "JetBrains Mono", monospace';
        if ('letterSpacing' in c) c.letterSpacing = (S * .05) + 'px';
        c.fillStyle = '#7d858f'; c.fillText('HAND-LAID CARBON · Ø622 · 1.18 KG', S * 1.3 + tw + S * .7, S * .02);
        c.restore();
      });
    });
    dtex.needsUpdate = true;
  }
  drawDecal();
  if (document.fonts) document.fonts.load('800 40px Archivo').then(drawDecal, () => {});

  /* ---------- carbon material: procedural 2x2 twill under a clear lacquer ---------- */
  const CU = {
    uWeave: { value: new THREE.Vector2(cellsX, cellsY) }, uWeaveAmt: { value: 1 }, uTime: { value: 0 },
    uSweep: { value: 0 }, uLit: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    uBands: { value: new THREE.Vector4(vAtS(.07 * A), vAtS(1.93 * A), vAtS(2 * A), 0) }, uDecal: { value: dtex }
  };
  const HEAD = `
varying vec2 vCUv;
uniform vec2 uWeave, uRes; uniform float uWeaveAmt, uTime, uSweep, uLit; uniform vec4 uBands; uniform sampler2D uDecal;
float cHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(cHash(i), cHash(i+vec2(1,0)), f.x), mix(cHash(i+vec2(0,1)), cHash(i+vec2(1,1)), f.x), f.y); }
#ifdef CARBON_DERIV
vec3 cPerturb(vec3 pos, vec3 n, float h, float s){
  vec3 dx = dFdx(pos), dy = dFdy(pos), r1 = cross(dy, n), r2 = cross(n, dx);
  float det = dot(dx, r1); vec2 dh = vec2(dFdx(h), dFdy(h)) * s;
  return normalize(abs(det) * n - sign(det) * (dh.x * r1 + dh.y * r2));
}
#endif`;
  const COLOR = `
vec2 c_wp = vCUv * uWeave; vec2 c_cell = floor(c_wp); vec2 c_f = fract(c_wp);
float c_warp = step(mod(c_cell.x + c_cell.y, 4.0), 1.5);
float c_across = mix(c_f.x, c_f.y, c_warp);
float c_edge = smoothstep(0.0, 0.2, c_across) * smoothstep(1.0, 0.8, c_across);
float c_fib = 0.5 + 0.5 * sin(mix(c_wp.x, c_wp.y, c_warp) * 50.2655);
float c_aa = 1.0;
#ifdef CARBON_DERIV
c_aa = 1.0 - smoothstep(0.35, 0.9, max(fwidth(c_wp.x), fwidth(c_wp.y)));
#endif
float c_v = vCUv.y;
float c_brake = max(1.0 - smoothstep(uBands.x - 0.006, uBands.x, c_v), smoothstep(uBands.y, uBands.y + 0.006, c_v) * (1.0 - step(uBands.z, c_v)));
float c_bed = step(uBands.z, c_v);
float c_w = clamp(c_aa * (1.0 - 0.7 * c_brake) * (1.0 - c_bed), 0.0, 1.0);
float c_tone = mix(0.6, 1.0, c_warp) * mix(0.55, 1.0, c_edge) * mix(0.9, 1.0, c_fib);
float c_n = cNoise(vCUv * vec2(90.0, 6.0));
vec3 c_base = mix(vec3(0.028, 0.029, 0.032), vec3(0.036, 0.037, 0.04), c_n);
vec3 c_col = mix(c_base, mix(vec3(0.016, 0.017, 0.019), vec3(0.048, 0.05, 0.056) * uWeaveAmt, c_tone), c_w);
c_col = mix(c_col, vec3(0.05, 0.052, 0.056), c_brake * 0.6);
c_col = mix(c_col, vec3(0.02), c_bed);
vec4 c_dc = texture2D(uDecal, vCUv);
c_col = mix(c_col, pow(c_dc.rgb, vec3(2.2)), c_dc.a * (1.0 - c_bed));
diffuseColor.rgb = c_col;
float cRough = mix(mix(0.5, 0.3, c_warp * c_edge * c_w + (1.0 - c_w) * 0.5), 0.62, c_brake) + (c_n - 0.5) * 0.06;
cRough = mix(mix(cRough, 0.42, c_dc.a), 0.8, c_bed);
float cH = (c_edge * 0.9 + c_fib * 0.05) * c_w * uWeaveAmt;
float c_sx = gl_FragCoord.x / uRes.x + gl_FragCoord.y / uRes.y * 0.25 - (fract(uTime * 0.09) * 1.8 - 0.4);
vec3 cEmis = vec3(0.55, 0.6, 0.68) * uSweep * exp(-c_sx * c_sx * 25.0) * (0.15 + c_tone * c_w * 0.85) * 0.35 * uLit;`;
  const carbonMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: .4, metalness: 0, clearcoat: .9, clearcoatRoughness: .09,
    side: THREE.DoubleSide, morphTargets: true, morphNormals: true
  });
  if (renderer.capabilities.isWebGL2) carbonMat.defines.CARBON_DERIV = '';
  carbonMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, CU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvCUv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + HEAD)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = cRough;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n#ifdef CARBON_DERIV\nnormal = cPerturb(-vViewPosition, normal, cH, 0.0007);\n#endif')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += cEmis;');
  };

  const spokeMat = new THREE.MeshPhysicalMaterial({ color: 0x0b0c0e, roughness: .35, clearcoat: .8, clearcoatRoughness: .12 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x9aa1aa, metalness: 1, roughness: .3, side: THREE.DoubleSide });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 1, roughness: .38 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x1f7cff, emissive: 0x0a3a99, emissiveIntensity: .7, metalness: .6, roughness: .25 });

  /* ---------- assembly ---------- */
  const root = new THREE.Group(), spin = new THREE.Group(); root.add(spin);
  const rim = new THREE.Mesh(rimGeo, carbonMat); rim.castShadow = rim.receiveShadow = true; spin.add(rim);

  const hp = [[0, -.5], [.07, -.5], [.075, -.47], [.075, -.44], [.118, -.435], [.122, -.37], [.2, -.352], [.3, -.345], [.305, -.33], [.3, -.305], [.17, -.295], [.145, -.2], [.135, -.08]];
  const hubPts = hp.concat([[.133, 0]], hp.slice().reverse().map(p => [p[0], -p[1]])).map(p => new THREE.Vector2(p[0], p[1]));
  const hubGeo = new THREE.LatheGeometry(hubPts, low ? 48 : 72); hubGeo.rotateX(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, hubMat); hub.castShadow = hub.receiveShadow = true; spin.add(hub);
  [-.445, .445].forEach(z => { const t = new THREE.Mesh(new THREE.TorusGeometry(.1, .011, 10, 48), blueMat); t.position.z = z; spin.add(t); });

  const NSP = 20, FL_R = .285, FL_Z = .325;
  const spokeData = [];
  for (let i = 0; i < NSP; i++) {
    const th = i / NSP * Math.PI * 2 + Math.PI / NSP, side = i % 2 ? 1 : -1;
    spokeData.push({ th, side, thh: th + (i % 4 < 2 ? .09 : -.09) });
  }
  const spokes = new THREE.InstancedMesh(new THREE.BoxGeometry(.075, .014, 1), spokeMat, NSP);
  const joints = new THREE.InstancedMesh(new THREE.CylinderGeometry(.032, .042, .1, 12), spokeMat, NSP);
  const heads = new THREE.InstancedMesh(new THREE.CylinderGeometry(.03, .03, .05, 10), darkMetal, NSP);
  [spokes, joints, heads].forEach(m => { m.castShadow = m.receiveShadow = true; spin.add(m); });
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .24, 10), darkMetal); valve.rotation.z = Math.PI / 2; spin.add(valve);

  const headsLocal = spokeData.map(() => new THREE.Vector3()), jointsLocal = spokeData.map(() => new THREE.Vector3());
  const dummy = new THREE.Object3D(), Y = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  let curD = -1;
  function setDepth(D) {
    if (Math.abs(D - curD) < 1e-4) return;
    curD = D;
    const rB = R - D + .015;
    spokeData.forEach((sd, i) => {
      const a = headsLocal[i].set(FL_R * Math.cos(sd.thh), FL_R * Math.sin(sd.thh), sd.side * FL_Z);
      const b = jointsLocal[i].set(rB * Math.cos(sd.th), rB * Math.sin(sd.th), sd.side * .01);
      dummy.position.copy(a).lerp(b, .5); dummy.up.set(0, 0, 1); dummy.scale.set(1, 1, a.distanceTo(b)); dummy.lookAt(b);
      dummy.updateMatrix(); spokes.setMatrixAt(i, dummy.matrix);
      dir.set(Math.cos(sd.th), Math.sin(sd.th), 0);
      dummy.position.copy(dir).multiplyScalar(rB - .03).setZ(sd.side * .01); dummy.scale.set(1, 1, 1);
      dummy.quaternion.setFromUnitVectors(Y, dir); dummy.updateMatrix(); joints.setMatrixAt(i, dummy.matrix);
      dummy.position.copy(a); dummy.rotation.set(Math.PI / 2, 0, 0); dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
    });
    spokes.instanceMatrix.needsUpdate = joints.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
    valve.position.set(R - D - .1, 0, 0);
  }
  setDepth(BASE.D);

  function setMorph(m) {
    const inf = rim.morphTargetInfluences;
    let D = BASE.D;
    for (let i = 0; i < 3; i++) { inf[i] = m[i]; D += m[i] * (VARS[i].D - BASE.D); }
    setDepth(D);
    return D;
  }
  function setLit(l) {
    carbonMat.envMapIntensity = l; spokeMat.envMapIntensity = .9 * l; hubMat.envMapIntensity = 1.1 * l; darkMetal.envMapIntensity = l;
  }

  return { root, spin, R, BASE, VARS, CU, setMorph, setLit, spokeData, headsLocal, jointsLocal, FL_R, FL_Z, prof, get depth() { return curD; } };
};
