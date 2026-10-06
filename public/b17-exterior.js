// B-17G Flying Fortress exterior. Procedural geometry and canvas textures only, no assets.
//
// API
//   buildExterior({hull, NOSE, TAIL})          (a leading THREE argument is accepted and ignored)
//     -> {group: THREE.Group, props: THREE.Group[4], glass: THREE.Material}
//     hull(z) -> {rx, lo, hi, cy, ry} is the caller's fuselage loft (exterior skin drawn at 1.025x).
//     props[i] sits at (engineX[i], -0.25, -6.65), engine 0 = port outer; spin it about its local z.
//   paintSkin(ctx, w, h)
//     Exterior hull colour texture for the caller's cylinder-UV skin (1024x2048 expected):
//     u around the hull (0 roof, .25 starboard, .5 belly, .75 port), canvas y=0 at the nose.
//
// Frame: metres, nose toward -z, +x starboard, +y up.
import * as THREE from '/three.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const G = 1.025;                       // exterior skin grow factor used by the caller
const SERIAL = '231909';               // 42-31909 as painted on the fin (USAAF practice drops the 4 and dash)
const OD = '#4b5136', GREY = '#7d827d', FRAME = '#2a2d22', GUNC = '#1e2021';
const ENG = [-7.4, -3.6, 3.6, 7.4], NAC_Y = -0.25, PROP_Z = -6.65;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rng(s) { return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function interp(tab, x) {
  if (x <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const a = tab[i - 1], b = tab[i]; return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0])); }
  return tab[tab.length - 1][1];
}

// NACA 4-digit section: [upper, lower] y at chord fraction x, thickness t, camber m at p.
function foil(x, t, m = 0, p = .4) {
  const yt = 5 * t * (.2969 * Math.sqrt(x) - .126 * x - .3516 * x * x + .2843 * x ** 3 - .1036 * x ** 4);
  const yc = !m ? 0 : x < p ? m / (p * p) * (2 * p * x - x * x) : m / ((1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x * x);
  return [yc + yt, yc - yt];
}

// ---- Planforms (shared by geometry and textures) ----
const WR = 1.24, WT = 15.8, DIH = Math.tan(4.5 * Math.PI / 180), WCAM = .02;
const WY0 = (() => { let m = 0; for (let x = 0; x <= 1; x += .005) m = Math.max(m, foil(x, .15, WCAM)[0]); return -.35 - m * 6; })();
function wingSec(x) {
  const ax = Math.abs(x), s = Math.max(0, (ax - WR) / (WT - WR));
  let le = lerp(-4.9, -1.75, s), te = lerp(1.1, .35, s);
  if (ax > 15) { const e = Math.min(1, (ax - 15) / .8), f = Math.sqrt(1 - e * e) * .97 + .03, c = te - le; le += (1 - f) * .45 * c; te -= (1 - f) * .55 * c; }
  return { le, te, t: lerp(.15, .10, s), y: WY0 + Math.max(0, ax - WR) * DIH };
}
const wingY = (x, z, up) => { const s = wingSec(x), c = s.te - s.le; return s.y + foil(Math.min(1, Math.max(0, (z - s.le) / c)), s.t, WCAM)[up ? 0 : 1] * c; };
// Fin: leading and trailing edge z as functions of height y.
const FIN_LE = [[1.35, 3.5], [2.04, 3.5], [2.12, 4.6], [2.22, 5.8], [2.38, 6.9], [2.6, 7.7], [2.9, 8.3], [3.4, 8.9], [4.0, 9.45], [4.6, 9.9], [5.0, 10.2], [5.25, 10.42], [5.4, 10.62], [5.44, 10.76]];
const FIN_TE = [[1.35, 11.45], [3.0, 11.42], [4.2, 11.33], [4.8, 11.22], [5.15, 11.07], [5.35, 10.92], [5.44, 10.78]];
const rudderHinge = y => 10.42 - .04 * (y - 1.4);
// Horizontal stabiliser at y 1.2, span 10.8.
const STAB_Y = 1.2, STAB_TIP = 5.4;
function stabSec(x) {
  const ax = Math.abs(x), s = Math.min(1, ax / 4.9);
  let le = lerp(8.9, 9.85, s), te = lerp(11.3, 11.12, s);
  if (ax > 4.9) { const e = Math.min(1, (ax - 4.9) / .5), f = Math.sqrt(1 - e * e) * .96 + .04, c = te - le; le += (1 - f) * .5 * c; te -= (1 - f) * .5 * c; }
  return { le, te, t: lerp(.11, .09, s) };
}
const ELEV_HINGE = 10.55;

// ---- Geometry helpers ----
function geo(pos, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
// Lifting surface lofted through airfoil stations {o: leading edge, c: chord vector, t: thickness dir, th, m}.
function surface(st, n, uvf, post) {
  const N = n + 1, xs = [...Array(N)].map((_, i) => (1 - Math.cos(Math.PI * i / n)) / 2), pos = [], uv = [], idx = [];
  st.forEach((s, k) => {
    const L = s.c.length();
    for (const up of [1, 0]) for (const x of xs) {
      const f = foil(x, s.th, s.m || 0), p = s.o.clone().addScaledVector(s.c, x).addScaledVector(s.t, f[up ? 0 : 1] * L);
      if (post) post(p, k, up);
      pos.push(p.x, p.y, p.z); uv.push(...uvf(p, up));
    }
  });
  const sg = st[1].o.clone().sub(st[0].o).cross(st[0].c).dot(st[0].t) > 0;
  for (let k = 0; k < st.length - 1; k++) for (const up of [1, 0]) for (let i = 0; i < n; i++) {
    const a = k * 2 * N + (up ? 0 : N) + i, b = a + 2 * N, c = a + 1, d = b + 1;
    if (sg === !!up) idx.push(a, b, c, c, b, d); else idx.push(a, c, b, c, d, b);
  }
  const g = geo(pos, uv, idx), nr = g.attributes.normal, t = V(0, 0, 0);
  for (let k = 0; k < st.length; k++) { // smooth the duplicated leading edge
    const a = k * 2 * N, b = a + N;
    t.set(nr.getX(a) + nr.getX(b), nr.getY(a) + nr.getY(b), nr.getZ(a) + nr.getZ(b)).normalize();
    nr.setXYZ(a, t.x, t.y, t.z); nr.setXYZ(b, t.x, t.y, t.z);
  }
  return g;
}
// Ring loft along z. secs: [z, x0, y0, rx, rUp, rDown]; mod(j,k) scales the radius per vertex.
function loft(secs, seg, mod) {
  const pos = [], uv = [], idx = [], R = seg + 1;
  secs.forEach(([z, x0, y0, rx, ru, rd], k) => {
    for (let j = 0; j <= seg; j++) {
      const a = j / seg * Math.PI * 2, c = Math.cos(a), f = mod ? mod(j, k) : 1;
      pos.push(x0 + rx * f * Math.sin(a), y0 + (c > 0 ? ru : rd) * f * c, z); uv.push(j / seg, k / (secs.length - 1));
    }
  });
  const fwd = secs[secs.length - 1][0] > secs[0][0];
  for (let k = 0; k < secs.length - 1; k++) for (let j = 0; j < seg; j++) {
    const a = k * R + j, b = a + R, c = a + 1, d = b + 1;
    if (fwd) idx.push(a, b, c, c, b, d); else idx.push(a, c, b, c, d, b);
  }
  const g = geo(pos, uv, idx), nr = g.attributes.normal, t = V(0, 0, 0);
  for (let k = 0; k < secs.length; k++) { const a = k * R, b = a + seg; t.set(nr.getX(a) + nr.getX(b), nr.getY(a) + nr.getY(b), nr.getZ(a) + nr.getZ(b)).normalize(); nr.setXYZ(a, t.x, t.y, t.z); nr.setXYZ(b, t.x, t.y, t.z); }
  return g;
}
const UPV = V(0, 1, 0);
function rod(a, b, r, seg = 8, r2 = r) {
  const d = b.clone().sub(a), L = d.length(), g = new THREE.CylinderGeometry(r2, r, L, seg, 1);
  g.translate(0, L / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UPV, d.normalize())); g.translate(a.x, a.y, a.z); return g;
}
const tube = (pts, r, seg = 24, closed = false) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), seg, r, 4, closed);
function xf(g, p, r = [0, 0, 0], s = [1, 1, 1]) { g.applyMatrix4(new THREE.Matrix4().compose(V(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), V(...s))); return g; }

// Merge [geometry, colour | fn(normal, position) -> Color] pairs into one vertex-coloured mesh.
function merge(list, mat) {
  let nv = 0, ni = 0;
  for (const [g] of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  const n = V(0, 0, 0), p = V(0, 0, 0);
  let vo = 0, io = 0;
  for (const [g, cl] of list) {
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, fixed = typeof cl === 'function' ? null : new THREE.Color(cl);
    for (let i = 0; i < P.count; i++) {
      const o = vo + i;
      pos[o * 3] = P.getX(i); pos[o * 3 + 1] = P.getY(i); pos[o * 3 + 2] = P.getZ(i);
      nor[o * 3] = N.getX(i); nor[o * 3 + 1] = N.getY(i); nor[o * 3 + 2] = N.getZ(i);
      if (U) { uv[o * 2] = U.getX(i); uv[o * 2 + 1] = U.getY(i); }
      const c = fixed || cl(n.fromBufferAttribute(N, i), p.fromBufferAttribute(P, i));
      col[o * 3] = c.r; col[o * 3 + 1] = c.g; col[o * 3 + 2] = c.b;
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo; else for (let i = 0; i < P.count; i++) idx[io++] = i + vo;
    vo += P.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
  return new THREE.Mesh(g, mat);
}

// ---- Canvas texture helpers ----
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// 1943-45 national insignia centred at the origin, star point toward -y, bars along x. r = disc radius.
function insignia(ctx, r) {
  const B = '#26315a', W = '#e9e7dc', o = r * .14;
  ctx.fillStyle = B; ctx.beginPath(); ctx.arc(0, 0, r + o, 0, 7); ctx.fill();
  ctx.fillRect(r * .5, -r * .25 - o, r * 1.5 + o, r * .5 + 2 * o); ctx.fillRect(-2 * r - o, -r * .25 - o, r * 1.5 + o, r * .5 + 2 * o);
  ctx.fillStyle = W; ctx.fillRect(r * .5, -r * .25, r * 1.5, r * .5); ctx.fillRect(-2 * r, -r * .25, r * 1.5, r * .5);
  ctx.fillStyle = B; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.fillStyle = W; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .382 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.fill();
}
// Weathering: soft mottling, streaks running aft along +sy, and paint chips, inside rect (x,y,w,h).
function weather(ctx, x, y, w, h, rnd, n, streakDir = [0, 1]) {
  for (let i = 0; i < n; i++) {
    const px = x + rnd() * w, py = y + rnd() * h, s = 6 + rnd() * 40;
    ctx.fillStyle = rnd() < .5 ? `rgba(0,0,0,${rnd() * .06})` : `rgba(210,205,180,${rnd() * .05})`;
    ctx.beginPath(); ctx.ellipse(px, py, s, s * (.4 + rnd()), rnd() * 3, 0, 7); ctx.fill();
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const px = x + rnd() * w, py = y + rnd() * h, l = 15 + rnd() * 90;
    ctx.strokeStyle = rnd() < .6 ? `rgba(0,0,0,${.03 + rnd() * .05})` : `rgba(220,215,190,${.02 + rnd() * .04})`;
    ctx.lineWidth = 1 + rnd() * 2.5; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + streakDir[0] * l, py + streakDir[1] * l); ctx.stroke();
  }
  for (let i = 0; i < n / 2; i++) { ctx.fillStyle = `rgba(175,175,165,${.25 + rnd() * .35})`; ctx.fillRect(x + rnd() * w, y + rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
}
// Line with rivet dots along it.
function seam(ctx, pts, rivet = 6, alpha = .45) {
  ctx.strokeStyle = `rgba(16,18,12,${alpha})`; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  if (!rivet) return;
  ctx.fillStyle = `rgba(10,12,8,${alpha * .6})`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], L = Math.hypot(x1 - x0, y1 - y0), dx = (y1 - y0) / L * 3, dy = -(x1 - x0) / L * 3;
    for (let d = 0; d < L; d += rivet) { const t = d / L; ctx.fillRect(x0 + (x1 - x0) * t + dx - .8, y0 + (y1 - y0) * t + dy - .8, 1.6, 1.6); }
  }
}

// ---- Hull skin ----
const S_NOSE = -9.3, S_TAIL = 11;
const S_PROFILE = [[-9.3, .95, -.15, 1.3], [-7.8, 1.15, -.35, 1.5], [-6.6, 1.22, -.4, 2.45], [-4.2, 1.24, -.45, 2.25], [-1, 1.24, -.45, 2.1], [3, 1.2, -.4, 2.05], [7.5, 1, -.15, 1.95], [10, .6, .35, 1.6], [11, .47, .5, 1.45]];
function skinRy(z) { // same smoothstep interpolation as the caller's hull(z), half height only
  let i = 0; while (i < S_PROFILE.length - 2 && z > S_PROFILE[i + 1][0]) i++;
  const a = S_PROFILE[i], b = S_PROFILE[i + 1], t = Math.max(0, Math.min(1, (z - a[0]) / (b[0] - a[0]))), s = t * t * (3 - 2 * t);
  return (lerp(a[3], b[3], s) - lerp(a[2], b[2], s)) / 2;
}
export function paintSkin(ctx, w, h) {
  const L = S_TAIL - S_NOSE, Y = z => (z - S_NOSE) / L * h, rnd = rng(1709);
  ctx.fillStyle = OD; ctx.fillRect(0, 0, w, h);
  // Sun-faded roof and a soft, slightly wavy demarcation to the grey belly.
  const fade = ctx.createLinearGradient(0, 0, w, 0);
  fade.addColorStop(0, 'rgba(150,140,100,.13)'); fade.addColorStop(.14, 'rgba(150,140,100,0)'); fade.addColorStop(.86, 'rgba(150,140,100,0)'); fade.addColorStop(1, 'rgba(150,140,100,.13)');
  ctx.fillStyle = fade; ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 8) {
    const wob = Math.sin(y * .011) * .01 + Math.sin(y * .037 + 1) * .005, a = .345 + wob, b = .655 - wob;
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(a - .025, 'rgba(125,130,125,0)'); g.addColorStop(a + .02, GREY); g.addColorStop(b - .02, GREY); g.addColorStop(b + .025, 'rgba(125,130,125,0)');
    ctx.fillStyle = g; ctx.fillRect(0, y, w, 8);
  }
  // Panel lines: frame stations around the hull and longitudinal seams.
  ctx.lineWidth = 1.3;
  const frames = []; for (let z = S_NOSE + .3; z < S_TAIL - .1; z += .48 + rnd() * .2) frames.push(z);
  frames.forEach((z, i) => seam(ctx, [[0, Y(z)], [w, Y(z)]], 6, i % 3 ? .3 : .5));
  for (let i = 0; i < 26; i++) {
    const x = (i + .5) / 26 * w;
    let z0 = S_NOSE;
    while (z0 < S_TAIL) { const z1 = Math.min(S_TAIL, z0 + 1.2 + rnd() * 2.5); if (rnd() < .85) seam(ctx, [[x + (rnd() - .5) * 6, Y(z0)], [x + (rnd() - .5) * 6, Y(z1)]], 6, .4); z0 = z1; }
  }
  // Bomb bay doors on the belly, crew entry door aft on the starboard side, nose hatch.
  ctx.lineWidth = 2;
  const box = (u0, u1, z0, z1, a = .6) => seam(ctx, [[u0 * w, Y(z0)], [u1 * w, Y(z0)], [u1 * w, Y(z1)], [u0 * w, Y(z1)], [u0 * w, Y(z0)]], 0, a);
  box(.44, .56, -3.9, -.75, .75); seam(ctx, [[.5 * w, Y(-3.9)], [.5 * w, Y(-.75)]], 0, .75);
  box(.3, .345, 7.9, 8.75, .7); box(.44, .53, -8.6, -7.9, .6);
  // Exhaust and oil staining low on the sides behind the wing root.
  for (const u of [.36, .64]) for (let i = 0; i < 40; i++) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
    g.addColorStop(0, `rgba(20,18,15,${.05 + rnd() * .05})`); g.addColorStop(1, 'rgba(20,18,15,0)');
    ctx.save(); ctx.translate(u * w + (rnd() - .5) * 60, Y(-1 + rnd() * 6)); ctx.scale(.5, 2.5); ctx.fillStyle = g; ctx.fillRect(-60, -60, 120, 120); ctx.restore();
  }
  weather(ctx, 0, 0, w, h, rnd, 1600);
  // Viewer-oriented frame in centimetres on either side (port: aft is right, up is +u).
  const side = (port, u, z, fn) => {
    const kx = w / (2 * Math.PI * skinRy(z) * G) / 100, ky = h / L / 100;
    ctx.save(); port ? ctx.setTransform(0, ky, -kx, 0, u * w, Y(z)) : ctx.setTransform(0, -ky, kx, 0, u * w, Y(z)); fn(); ctx.restore();
  };
  side(true, .75, 7.0, () => insignia(ctx, 55));
  side(false, .25, 7.0, () => insignia(ctx, 55));
  // Nose art on the port nose: a Lucky Strike roundel and the name.
  side(true, .655, -7.45, () => {
    ctx.translate(-110, 0);
    for (const [r, c] of [[30, '#111'], [27, '#ece6d2'], [22, '#b3221c'], [13, '#ece6d2'], [11, '#b3221c']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); }
    ctx.font = 'italic bold 30px Georgia, serif'; ctx.textBaseline = 'middle'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111'; ctx.strokeText('LUCKY STRIKE', 40, 2); ctx.fillStyle = '#efe4c0'; ctx.fillText('LUCKY STRIKE', 40, 2);
  });
  // Mission tally under the pilot's window.
  side(true, .705, -6.55, () => {
    ctx.fillStyle = '#d8b23a';
    for (let i = 0; i < 18; i++) { const x = (i % 9) * 15 - 60, y = Math.floor(i / 9) * 12; ctx.beginPath(); ctx.ellipse(x, y, 5, 2.6, 0, 0, 7); ctx.fill(); ctx.fillRect(x + 4, y - 2.5, 3, 5); }
  });
}

// ---- Wing / tail textures ----
function paintWing(ctx, w, h) {
  const half = w / 2, X = x => (x + 16) / 32 * half, Z = z => (z + 5.2) / 6.6 * h, rnd = rng(31);
  for (const top of [true, false]) {
    ctx.save(); ctx.translate(top ? 0 : half, 0);
    ctx.fillStyle = top ? OD : GREY; ctx.fillRect(0, 0, half, h);
    const edge = (f, x0, x1, step = .3) => { const pts = []; for (let x = x0; x <= x1 + 1e-6; x += step) { const s = wingSec(x); pts.push([X(x), Z(s.le + (s.te - s.le) * f)]); } return pts; };
    // Control surfaces: fabric shade and rib tapes.
    const surf = (x0, x1, f) => {
      const a = edge(f, x0, x1, .2), b = edge(1, x0, x1, .2).reverse();
      ctx.fillStyle = top ? 'rgba(90,92,60,.35)' : 'rgba(150,152,145,.35)'; ctx.beginPath(); [...a, ...b].forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.fill();
      ctx.lineWidth = 2.2; seam(ctx, [...a, ...b, a[0]], 0, .7);
      ctx.lineWidth = 1; for (let x = x0 + .25; x < x1; x += .25) { const s = wingSec(x); seam(ctx, [[X(x), Z(s.le + (s.te - s.le) * f)], [X(x), Z(s.te)]], 0, .18); }
    };
    for (const sg of [-1, 1]) {
      const r = (a, b) => sg > 0 ? [a, b] : [-b, -a];
      surf(...r(11.1, 15.3), .74); // aileron
      for (const [a, b] of [[1.3, 2.9], [4.3, 6.7], [8.1, 11.0]]) surf(...r(a, b), .8); // flaps
      // Aileron trim tab.
      const tx = sg * 12.0, s = wingSec(tx); ctx.lineWidth = 1.5; seam(ctx, [[X(tx - .5), Z(s.te - .25)], [X(tx + .5), Z(s.te - .25)]], 0, .6);
      // De-icer boots along the leading edge, interrupted by the nacelles.
      ctx.fillStyle = 'rgba(30,31,28,.82)';
      for (const [a, b] of [[1.3, 2.9], [4.3, 6.7], [8.1, 15.2]]) {
        const [x0, x1] = r(a, b), pts = [];
        for (let x = x0; x <= x1 + 1e-6; x += .2) pts.push([X(x), Z(wingSec(x).le)]);
        for (let x = x1; x >= x0 - 1e-6; x -= .2) pts.push([X(x), Z(wingSec(x).le + .2)]);
        ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.fill();
      }
    }
    // Ribs and spars.
    ctx.lineWidth = 1.2;
    for (let x = -15.4; x <= 15.4; x += .5) { if (Math.abs(x) < 1.2) continue; const s = wingSec(x); seam(ctx, [[X(x), Z(s.le + .3)], [X(x), Z(s.le + (s.te - s.le) * .74)]], 5, .3); }
    for (const f of [.18, .42, .62]) for (const sg of [-1, 1]) { const p = edge(f, 1.24, 15.2); seam(ctx, p.map(([x, y]) => [sg > 0 ? x : half - x, y]), 5, .35); }
    // Engine exhaust and turbo staining aft of each nacelle.
    for (const x of ENG) {
      const s = wingSec(x), g = ctx.createLinearGradient(0, Z(s.le), 0, Z(s.te + .3));
      const a = top ? .28 : .55; g.addColorStop(0, `rgba(28,25,20,${a})`); g.addColorStop(1, 'rgba(28,25,20,0)');
      ctx.fillStyle = g;
      for (let i = 0; i < 6; i++) { const dx = (rnd() - .5) * .8, wd = .3 + rnd() * .5; ctx.fillRect(X(x + dx - wd / 2), Z(top ? s.le + .6 : -3), X(wd) - X(0), Z(s.te + .3) - Z(top ? s.le + .6 : -3)); }
    }
    weather(ctx, 0, 0, half, h, rnd, 900, [0, 1]);
    // Insignia: port upper, starboard lower.
    const ix = top ? -11.6 : 11.6, s = wingSec(ix);
    ctx.save(); ctx.translate(X(ix), Z((s.le + s.te) / 2 - .1)); ctx.scale(half / 32, h / 6.6); insignia(ctx, .8); ctx.restore();
    ctx.restore();
  }
}
function paintTail(ctx, w, h) {
  const half = w / 2, fh = h / 2, rnd = rng(77);
  // Fin: starboard half (nose to the right), port half (nose to the left).
  const FZ = (z, port) => port ? half + (z - 3.3) / 8.4 * half : (11.7 - z) / 8.4 * half, FY = y => (5.6 - y) / 4.3 * fh;
  for (const port of [false, true]) {
    ctx.save(); ctx.beginPath(); ctx.rect(port ? half : 0, 0, half, fh); ctx.clip();
    ctx.fillStyle = OD; ctx.fillRect(port ? half : 0, 0, half, fh);
    const P = (z, y) => [FZ(z, port), FY(y)];
    ctx.lineWidth = 1.3;
    for (let z = 4; z < 11.4; z += .45) seam(ctx, [P(z, 1.3), P(z, 5.6)], 5, .3);
    for (let y = 2.3; y < 5.4; y += .55) seam(ctx, [P(3.3, y), P(11.7, y)], 5, .3);
    // Rudder: fabric shade, hinge, ribs, trim tab.
    const hinge = [], te = [];
    for (let y = 1.4; y <= 5.42; y += .1) { hinge.push(P(rudderHinge(y), y)); te.push(P(interp(FIN_TE, y), y)); }
    ctx.fillStyle = 'rgba(95,97,62,.35)'; ctx.beginPath(); [...hinge, ...te.reverse()].forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.fill();
    ctx.lineWidth = 2.5; seam(ctx, hinge, 0, .75);
    ctx.lineWidth = 1; for (let y = 1.6; y < 5.3; y += .22) seam(ctx, [P(rudderHinge(y), y), P(interp(FIN_TE, y), y)], 0, .2);
    ctx.lineWidth = 1.6; seam(ctx, [P(11.0, 1.9), P(11.0, 3.0), P(interp(FIN_TE, 3), 3)], 0, .6);
    // De-icer boot on the fin leading edge.
    ctx.strokeStyle = 'rgba(22,23,20,.92)'; ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.beginPath();
    for (let y = 2.75; y <= 5.3; y += .05) { const [x, yy] = P(interp(FIN_LE.map(([a, b]) => [a, b]), y) + .1, y); y === 2.75 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
    ctx.stroke();
    weather(ctx, port ? half : 0, 0, half, fh, rnd, 500, [0, 1]);
    // 1st Bomb Division marking (white triangle, group letter) and yellow serial.
    const [cx, cy] = P(9.95, 4.25), s = fh / 4.3;
    ctx.fillStyle = '#e6e3d6'; ctx.beginPath(); ctx.moveTo(cx, cy - .5 * s); ctx.lineTo(cx + .55 * s, cy + .45 * s); ctx.lineTo(cx - .55 * s, cy + .45 * s); ctx.fill();
    ctx.fillStyle = '#1b1c18'; ctx.font = `bold ${.55 * s}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('A', cx, cy + .13 * s);
    const [sx, sy] = P(9.75, 3.15); ctx.fillStyle = '#d9b53a'; ctx.font = `bold ${.36 * s}px "Arial Narrow", Arial, sans-serif`; ctx.fillText(SERIAL, sx, sy);
    ctx.restore();
  }
  // Stabiliser: upper (left) and lower (right), nose at the top of the region.
  const SX = x => (x + 5.6) / 11.2 * half, SZ = z => fh + (z - 8.7) / 2.8 * fh;
  for (const top of [true, false]) {
    ctx.save(); ctx.translate(top ? 0 : half, 0);
    ctx.fillStyle = top ? OD : GREY; ctx.fillRect(0, fh, half, fh);
    ctx.lineWidth = 1.3;
    for (let x = -5.2; x <= 5.2; x += .45) { const s = stabSec(x); seam(ctx, [[SX(x), SZ(s.le + .2)], [SX(x), SZ(ELEV_HINGE)]], 5, .3); }
    for (const sg of [-1, 1]) {
      const pts = [], back = [];
      for (let x = .45; x <= 5.36; x += .1) { const s = stabSec(x); pts.push([SX(sg * x), SZ(Math.min(ELEV_HINGE, s.te - .05))]); back.push([SX(sg * x), SZ(s.te)]); }
      ctx.fillStyle = top ? 'rgba(95,97,62,.35)' : 'rgba(150,152,145,.35)'; ctx.beginPath(); [...pts, ...back.reverse()].forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.fill();
      ctx.lineWidth = 2.2; seam(ctx, pts, 0, .75);
      ctx.lineWidth = 1; for (let x = .6; x < 5.2; x += .2) seam(ctx, [[SX(sg * x), SZ(ELEV_HINGE)], [SX(sg * x), SZ(stabSec(x).te)]], 0, .2);
      ctx.lineWidth = 1.6; seam(ctx, [[SX(sg * .7), SZ(10.95)], [SX(sg * 1.9), SZ(10.95)]], 0, .6);
      ctx.fillStyle = 'rgba(22,23,20,.92)'; ctx.beginPath();
      for (let x = .45; x <= 5.2; x += .1) ctx.lineTo(SX(sg * x), SZ(stabSec(x).le));
      for (let x = 5.2; x >= .45; x -= .1) ctx.lineTo(SX(sg * x), SZ(stabSec(x).le + .22));
      ctx.fill();
    }
    weather(ctx, 0, fh, half, fh, rnd, 300, [0, 1]);
    ctx.restore();
  }
}

// ---- Exterior ----
export function buildExterior(a, b) {
  const { hull, NOSE = -9.3, TAIL = 11 } = b || a;
  const group = new THREE.Group(); group.name = 'b17-exterior';
  const solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: .12, side: THREE.DoubleSide });
  const metalMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .42, metalness: .65 });
  const glass = new THREE.MeshStandardMaterial({ color: '#c3d7dc', transparent: true, opacity: .22, roughness: .04, metalness: .35, depthWrite: false, side: THREE.DoubleSide });
  const S = [], M = [], GL = [];
  const odC = new THREE.Color(OD), greyC = new THREE.Color(GREY), tmp = new THREE.Color();
  const camo = (n, p, dark = 1) => tmp.copy(greyC).lerp(odC, smooth(-.7, -.45, n.y)).multiplyScalar(dark);
  const hp = (ang, z, g = G) => { const h = hull(z); return V(h.rx * g * Math.sin(ang), h.cy + h.ry * g * Math.cos(ang), z); };
  const TAU = Math.PI * 2;

  // Wing, one piece tip to tip with dihedral and rounded tips.
  {
    const xs = [0, .6, 1.24, 2, 2.8, 3.6, 4.4, 5.2, 6, 6.8, 7.4, 8, 8.8, 9.6, 10.4, 11.2, 12, 12.8, 13.6, 14.4, 15, 15.24, 15.44, 15.6, 15.7, 15.77, 15.8];
    const st = [...xs.slice(1).reverse().map(x => -x), ...xs].map(x => { const s = wingSec(x); return { o: V(x, s.y, s.le), c: V(0, 0, s.te - s.le), t: V(0, 1, 0), th: s.t, m: WCAM }; });
    const tex = canvasTex(4096, 1024, paintWing);
    const wing = new THREE.Mesh(surface(st, 16, (p, up) => [(p.x + 16) / 32 * .5 + (up ? 0 : .5), 1 - (p.z + 5.2) / 6.6]), new THREE.MeshStandardMaterial({ map: tex, roughness: .8, metalness: .12 }));
    wing.name = 'wing'; group.add(wing);
    // Nav lights.
    for (const s of [-1, 1]) { const w = wingSec(15.75); S.push([xf(new THREE.SphereGeometry(.06, 8, 6), [s * 15.76, w.y + .02, (w.le + w.te) / 2 - .1]), s < 0 ? '#c02020' : '#20a040']); }
    // Oil cooler / intercooler intakes in the leading edge.
    for (const x of [-5.5, -2.25, 2.25, 5.5]) { const s = wingSec(x); S.push([xf(new THREE.BoxGeometry(1.0, .15, .14), [x, s.y + .03, s.le + .03], [0, -Math.sign(x) * .213, 0]), '#121310']); }
  }
  // Wing root / belly fairing so the fuselage meets the low-slung wing.
  {
    const bot = wingY(1.24, -1.5, false) + .04;
    const tab = [[-5.7, 0], [-5.3, .35], [-4.9, .85], [-4.5, 1], [1.0, 1], [1.5, .75], [1.95, .3], [2.2, 0]];
    const secs = [];
    for (let z = -5.7; z <= 2.2 + 1e-6; z += .2) { const h = hull(z), f = interp(tab, z), lo = lerp(h.lo + .02, bot, f); secs.push([z, 0, h.cy, h.rx * (G - .01), h.ry * .9, Math.max(h.ry * (G - .01), h.cy - lo)]); }
    S.push([loft(secs, 32), (n, p) => camo(n, p)]);
  }
  // Horizontal stabilisers, two halves rooted on the hull side.
  const tailTex = canvasTex(2048, 1024, paintTail), tailMat = new THREE.MeshStandardMaterial({ map: tailTex, roughness: .8, metalness: .12 });
  {
    const xs = [.4, 1, 1.8, 2.6, 3.4, 4.2, 4.9, 5.05, 5.18, 5.28, 5.35, 5.4];
    const stabUV = (p, up) => [(p.x + 5.6) / 11.2 * .5 + (up ? 0 : .5), .5 - .5 * (p.z - 8.7) / 2.8];
    for (const sg of [-1, 1]) {
      const st = xs.map(x => { const s = stabSec(x); return { o: V(sg * x, STAB_Y, s.le), c: V(0, 0, s.te - s.le), t: V(0, 1, 0), th: s.t }; });
      const snap = (p, k) => { if (k) return; const h = hull(Math.min(p.z, TAIL)), d = (p.y - h.cy) / (h.ry * G); p.x = sg * h.rx * G * Math.sqrt(Math.max(0, 1 - d * d)) * .995; };
      const m = new THREE.Mesh(surface(st, 12, stabUV, snap), tailMat); m.name = 'stabiliser'; group.add(m);
    }
  }
  // Fin with the long dorsal fillet; root snapped to the spine.
  {
    const ys = [1.35, 2.04, 2.12, 2.22, 2.38, 2.6, 2.9, 3.4, 4.0, 4.6, 5.0, 5.2, 5.32, 5.4, 5.44];
    const st = ys.map(y => { const le = interp(FIN_LE, y), te = Math.max(le + .02, interp(FIN_TE, y)), c = te - le; return { o: V(0, y, le), c: V(0, 0, c), t: V(1, 0, 0), th: Math.min(.12, .3 / c) }; });
    const finUV = (p, up) => [up ? .5 * (11.7 - p.z) / 8.4 : .5 + .5 * (p.z - 3.3) / 8.4, .5 + .5 * (p.y - 1.3) / 4.3];
    const snap = (p, k) => { if (k) return; const h = hull(Math.min(p.z, TAIL)); p.y = h.hi + .012 * h.ry; };
    const fin = new THREE.Mesh(surface(st, 16, finUV, snap), tailMat); fin.name = 'fin'; group.add(fin);
  }

  // Engines: cowling, cooling gills, nacelle, engine face, turbosupercharger, exposed main wheels.
  const props = [];
  const bladeMat = solidMat;
  ENG.forEach((x, e) => {
    const inb = Math.abs(x) < 5, y = NAC_Y;
    const front = [[-6.47, .52, .52, .52], [-6.46, .60, .60, .60], [-6.41, .655, .655, .655], [-6.3, .695, .695, .695], [-6.1, .725, .725, .725], [-5.8, .738, .738, .738], [-5.47, .735, .735, .735], [-5.46, .70, .70, .70]];
    const aft = inb
      ? [[-4.9, .70, .70, .74], [-4.2, .68, .6, .95], [-3.2, .64, .46, 1.0], [-2.2, .57, .32, .95], [-1.2, .47, .2, .82], [-.2, .35, .12, .62], [.8, .2, .06, .36], [1.45, .05, .02, .08]]
      : [[-4.9, .70, .70, .72], [-4.1, .67, .58, .8], [-3.1, .6, .42, .78], [-2.1, .5, .28, .7], [-1.1, .38, .16, .55], [-.2, .24, .08, .36], [.55, .1, .04, .14], [.9, .03, .02, .04]];
    const secs = [...front, ...aft].map(([z, rx, ru, rd]) => [z, x, y, rx, ru, rd]);
    const rdAt = z => interp(aft.map(r => [r[0], r[3]]), z);
    S.push([loft(secs, 28), (n, p) => { const c = camo(n, p); if (p.z < -5.45) c.multiplyScalar(.93); if (n.y < -.3 && p.z > -5) c.multiplyScalar(lerp(1, .6, smooth(-5, -2, p.z))); return c; }]);
    S.push([loft([[-5.47, x, y, .72, .72, .72], [-5.1, x, y, .775, .775, .775]], 40, (j, k) => k && j % 2 ? .975 : 1), (n) => camo(n, null, .72)]);
    // Engine face seen through the cowl opening: R-1820 cylinders round a crankcase nose.
    S.push([xf(new THREE.CircleGeometry(.6, 24), [x, y, -6.3], [0, Math.PI, 0]), '#151614']);
    S.push([xf(new THREE.SphereGeometry(.22, 12, 8), [x, y, -6.38], [0, 0, 0], [1, 1, .8]), '#4c4f4f']);
    for (let i = 0; i < 9; i++) { const a2 = i / 9 * TAU; S.push([rod(V(x + Math.cos(a2) * .2, y + Math.sin(a2) * .2, -6.34), V(x + Math.cos(a2) * .5, y + Math.sin(a2) * .5, -6.34), .075, 6), '#2b2d2b']); }
    M.push([rod(V(x, y, -6.45), V(x, y, -6.6), .06, 8), '#3a3c3c']);
    // Turbosupercharger under the nacelle, with its exhaust duct and hood.
    const tz = inb ? -2.5 : -3.2, by = y - rdAt(tz);
    M.push([xf(new THREE.CylinderGeometry(.24, .24, .07, 18), [x, by - .02, tz]), '#77736b']);
    M.push([xf(new THREE.CylinderGeometry(.1, .14, .12, 10), [x, by - .08, tz]), '#3b3631']);
    M.push([rod(V(x, y - .66, -5.0), V(x, by + .01, tz - .25), .065, 8), '#4a3b30']);
    M.push([rod(V(x, by - .05, tz + .05), V(x, by - .07, tz + .4), .07, 8, .09), '#2d2722']);
    if (inb) {
      // Partly exposed retracted main wheel and the closed gear doors aft of it.
      S.push([xf(new THREE.CylinderGeometry(.66, .66, .36, 22), [x, y - 1.0 - .3 + .66, -3.6], [0, 0, Math.PI / 2]), '#161616']);
      S.push([xf(new THREE.CylinderGeometry(.3, .3, .38, 14), [x, y - 1.0 - .3 + .66, -3.6], [0, 0, Math.PI / 2]), '#55595a']);
      for (const s of [-1, 1]) S.push([xf(new THREE.BoxGeometry(.36, .025, 1.0), [x + s * .2, y - rdAt(-2.4) + .02, -2.4], [0, 0, s * .25]), '#6f746f']);
    }
    // Propeller: Hamilton Standard dome hub and three paddle blades with yellow tips.
    const P = [];
    P.push([xf(new THREE.SphereGeometry(.18, 14, 8, 0, TAU, 0, Math.PI / 2), [0, 0, -.08], [-Math.PI / 2, 0, 0], [1, 1.5, 1]), '#202322']);
    P.push([xf(new THREE.CylinderGeometry(.2, .2, .2, 14), [0, 0, 0], [Math.PI / 2, 0, 0]), '#2b2e2d']);
    const black = new THREE.Color('#141615'), yellow = new THREE.Color('#d6aa2a');
    for (let i = 0; i < 3; i++) {
      const st = [];
      for (const r of [.16, .26, .4, .6, .8, 1.0, 1.2, 1.4, 1.55, 1.66, 1.72, 1.755, 1.77]) {
        const rn = (r - .16) / 1.61, beta = lerp(.95, .3, rn), tip = rn > .9 ? Math.sqrt(Math.max(0, 1 - ((rn - .9) / .1) ** 2)) * .85 + .15 : 1;
        const c = (r < .3 ? .14 : .17 + .15 * Math.sin(Math.PI * Math.min(1, rn * 1.15)) ** .6) * tip;
        const cd = V(Math.cos(beta), 0, Math.sin(beta));
        st.push({ o: V(0, r, 0).addScaledVector(cd, -.35 * c), c: cd.clone().multiplyScalar(c), t: V(-Math.sin(beta), 0, Math.cos(beta)), th: r < .3 ? .5 : lerp(.14, .06, rn), m: .02 });
      }
      const g = surface(st, 6, () => [0, 0]); g.rotateZ(i * TAU / 3);
      P.push([g, (n, p) => Math.hypot(p.x, p.y) > 1.62 ? yellow : black]);
    }
    const prop = new THREE.Group(); prop.position.set(x, y, PROP_Z); prop.name = 'prop' + e;
    prop.add(merge(P, bladeMat)); group.add(prop); props.push(prop);
  });

  // Guns.
  const gun = (a2, dir, len = 1.15, rec = 0) => {
    dir = dir.clone().normalize(); const at = t => a2.clone().addScaledVector(dir, t);
    M.push([rod(at(0), at(.5), .03, 8), GUNC]); M.push([rod(at(.5), at(len - .07), .013, 6), GUNC]); M.push([rod(at(len - .08), at(len), .02, 6, .024), GUNC]);
    if (rec) M.push([rod(at(-rec), at(0), .05, 4), GUNC]);
  };
  const twin = (c, dir, sep, len = 1.15) => { const sd = UPV.clone().cross(dir).normalize(); for (const s of [-1, 1]) gun(c.clone().addScaledVector(sd, s * sep), dir, len); };

  // Glazed nose: pointed one-piece Plexiglas with base ring, top strip and the bomb-aiming flat.
  {
    const n0 = hull(NOSE), T = [0, .12, .25, .38, .5, .62, .72, .81, .88, .94, .98, 1];
    const cone = t => { const f = Math.sqrt(Math.max(0, 1 - t ** 2.4)); return { z: NOSE - 2.05 * t, cy: n0.cy - .22 * t * t, rx: n0.rx * G * f, ry: n0.ry * G * f }; };
    GL.push([loft(T.map(t => { const c = cone(t); return [c.z, 0, c.cy, c.rx, c.ry, c.ry]; }), 32), '#fff']);
    const cp = (ang, t, g = 1.012) => { const c = cone(t); return V(c.rx * g * Math.sin(ang), c.cy + c.ry * g * Math.cos(ang), c.z); };
    S.push([tube([...Array(33)].map((_, k) => hp(k / 32 * TAU, NOSE, 1.035)), .03, 48, true), FRAME]);
    S.push([tube([...Array(8)].map((_, k) => cp(0, k / 7 * .8)), .016, 16), FRAME]);
    const fl = [], a0 = Math.PI - .55, a1 = Math.PI + .55;
    for (let k = 0; k <= 6; k++) fl.push(cp(lerp(a0, a1, k / 6), .86)); for (let k = 0; k <= 3; k++) fl.push(cp(a1, lerp(.86, .965, k / 3)));
    for (let k = 0; k <= 6; k++) fl.push(cp(lerp(a1, a0, k / 6), .965)); for (let k = 0; k <= 3; k++) fl.push(cp(a0, lerp(.965, .86, k / 3)));
    S.push([tube(fl, .014, 48, true), FRAME]);
  }
  // Chin turret (Bendix) with twin .50s.
  S.push([xf(new THREE.SphereGeometry(.43, 20, 14), [0, -.35, -10.2], [0, 0, 0], [1, .88, 1.05]), (n, p) => camo(n, p)]);
  for (const s of [-1, 1]) S.push([xf(new THREE.BoxGeometry(.06, .3, .05), [s * .11, -.42, -10.63], [-.15, 0, 0]), '#191a17']);
  twin(V(0, -.42, -10.55), V(0, 0, -1), .11, 1.1);
  // Cheek guns in bulged windows, astrodome, pitot heads.
  for (const s of [-1, 1]) {
    const z = s < 0 ? -8.85 : -8.55, p = hp(s < 0 ? .73 * TAU : .27 * TAU, z, 1.03);
    GL.push([xf(new THREE.SphereGeometry(.2, 12, 8), [p.x, p.y, p.z], [0, 0, 0], [.45, 1, 1.5]), '#fff']);
    S.push([xf(new THREE.SphereGeometry(.07, 10, 8), [p.x + s * .05, p.y, p.z]), '#2a2c26']);
    gun(V(p.x + s * .07, p.y, p.z), V(s * .22, -.03, -1), 1.05, .3);
    const q = hp(s * 1.95, -9.05, 1.02);
    S.push([rod(q, q.clone().add(V(s * .14, 0, 0)), .012, 5), '#2f312c']); S.push([rod(q.clone().add(V(s * .14, 0, .05)), q.clone().add(V(s * .14, 0, -.32)), .016, 6), '#b8b8b0']);
  }
  {
    const p = hp(0, -8.45, 1.0);
    GL.push([xf(new THREE.SphereGeometry(.2, 14, 6, 0, TAU, 0, Math.PI / 2), [p.x, p.y + .02, p.z]), '#fff']);
    S.push([xf(new THREE.TorusGeometry(.205, .022, 4, 20), [p.x, p.y + .03, p.z], [Math.PI / 2, 0, 0]), FRAME]);
  }
  // Cockpit canopy frame outline round the windscreen and side windows (open, no opaque cover).
  {
    const at = (ang, z) => hp(ang, z, 1.035), bar = (pts, r = .02) => S.push([tube(pts, r, 16), FRAME]);
    const span = (a0, a1, z) => bar([...Array(9)].map((_, k) => at(a0 + (a1 - a0) * k / 8, z)));
    const along = (ang, z0, z1) => bar([...Array(9)].map((_, k) => at(ang, z0 + (z1 - z0) * k / 8)));
    for (const ang of [-.82, -.4, 0, .4, .82]) along(ang, -7.8, -6.5);
    span(-.82, .82, -7.8); span(-.82, .82, -6.5); span(-.82, .82, -7.15);
    for (const s of [-1, 1]) { for (const ang of [.75, 1.2, 1.62]) along(s * ang, -7.42, -5.53); for (const z of [-7.42, -6.48, -5.53]) span(s * .75, s * 1.62, z); }
  }
  // Window glazing flush with the skin cut-outs.
  for (const [u, du, z0, z1] of [[0, .13, -7.78, -6.5], [.19, .07, -7.4, -5.55], [.81, .07, -7.4, -5.55], [0, .08, -5.1, -4.3], [.27, .05, -9.1, -8.3], [.73, .05, -9.1, -8.3], [0, .05, -.4, .7], [.25, .04, .1, .9], [.77, .07, 3.5, 4.6], [.23, .07, 4.7, 5.8], [.25, .03, 10.1, 10.7], [.75, .03, 10.1, 10.7]]) {
    const pos = [], uv = [], idx = [], n = 6;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { const p = hp((u - du + 2 * du * j / n) * TAU, lerp(z0, z1, i / n), 1.028); pos.push(p.x, p.y, p.z); uv.push(j / n, i / n); }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a2 = i * (n + 1) + j; idx.push(a2, a2 + 1, a2 + n + 1, a2 + 1, a2 + n + 2, a2 + n + 1); }
    GL.push([geo(pos, uv, idx), '#fff']);
  }
  // Top turret (Sperry A-1): armoured ring, framed dome, twin guns forward.
  {
    const z = -4.7, top = hull(z).hi + .02;
    S.push([xf(new THREE.CylinderGeometry(.66, .74, .16, 28, 1, true), [0, top + .04, z]), (n, p) => camo(n, p)]);
    S.push([xf(new THREE.TorusGeometry(.655, .02, 6, 28), [0, top + .12, z], [Math.PI / 2, 0, 0]), FRAME]);
    GL.push([xf(new THREE.SphereGeometry(.62, 24, 10, 0, TAU, 0, Math.PI / 2), [0, top + .1, z], [0, 0, 0], [1, .85, 1]), '#fff']);
    const dp = (th, ph) => V(.625 * Math.sin(ph) * Math.cos(th), top + .1 + .53 * Math.cos(ph), z + .625 * Math.sin(ph) * Math.sin(th));
    for (let i = 0; i < 6; i++) if (i !== 4) S.push([tube([...Array(9)].map((_, k) => dp(i / 6 * TAU + Math.PI / 6, k / 8 * Math.PI / 2)), .009, 12), FRAME]);
    S.push([tube([...Array(29)].map((_, k) => dp(k / 28 * TAU, .95)), .009, 28, true), FRAME]);
    S.push([xf(new THREE.BoxGeometry(.38, .14, .3), [0, top + .32, z - .48]), '#24261f']);
    twin(V(0, top + .32, z - .5), V(0, 0, -1), .12, 1.2);
  }
  // Sperry ball turret mounting ring. The ball itself rotates with its gunner, so the game builds it (public/app.js).
  S.push([xf(new THREE.CylinderGeometry(.72, .7, .12, 28, 1, true), [0, hull(2.7).lo - .05, 2.7]), (n, p) => camo(n, p)]);
  // Cheyenne tail turret: glazed cap, armoured gun mount, twin guns aft.
  {
    const h = hull(TAIL), T = [[0, 1], [.15, .99], [.3, .95], [.42, .86], [.5, .72], [.56, .5], [.6, .15], [.61, 0]];
    GL.push([loft(T.map(([dz, f]) => [TAIL + dz, 0, h.cy + .08 * dz, h.rx * G * f, h.ry * G * f, h.ry * G * f]), 28), '#fff']);
    S.push([tube([...Array(29)].map((_, k) => hp(k / 28 * TAU, TAIL, 1.035)), .028, 36, true), FRAME]);
    const tp = (ang, dz, f) => V(h.rx * G * f * 1.01 * Math.sin(ang), h.cy + .08 * dz + h.ry * G * f * 1.01 * Math.cos(ang), TAIL + dz);
    for (const ang of [1.75, -1.75, 2.6, -2.6]) S.push([tube(T.slice(0, 6).map(([dz, f]) => tp(ang, dz, f)), .01, 12), FRAME]);
    S.push([tube([...Array(25)].map((_, k) => tp(k / 24 * TAU, .42, .86)), .01, 24, true), FRAME]);
    S.push([xf(new THREE.SphereGeometry(.2, 16, 10, 0, TAU, 0, Math.PI / 2), [0, .66, TAIL + .42], [Math.PI / 2, 0, 0], [1.2, 1, 1]), '#3b3f35']);
    twin(V(0, .66, TAIL + .5), V(0, 0, 1), .09, 1.0);
  }
  // No fixed waist guns: the gunner's first-person gun stands in, and a fixed barrel would sit inside his head.
  // Antenna mast on the cockpit roof and the long wire to the fin.
  {
    const base = hp(0, -5.95, 1.0), tip = base.clone().add(V(0, .42, .18)), fin = V(0, 5.28, 10.4);
    S.push([rod(base, tip, .022, 6, .012), FRAME]);
    S.push([rod(tip, fin, .006, 3), '#1a1a1a']);
    S.push([rod(fin.clone().add(V(0, -.05, -.05)), fin.clone().add(V(0, .03, .05)), .02, 5), FRAME]);
  }

  const solid = merge(S, solidMat); solid.name = 'airframe-details'; group.add(solid);
  const metal = merge(M, metalMat); metal.name = 'metal'; group.add(metal);
  const gl = merge(GL, glass); gl.name = 'glazing'; gl.renderOrder = 2; group.add(gl);
  return { group, props, glass };
}
