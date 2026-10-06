// HOMEBOUND crew figures: procedurally modelled, procedurally animated 1944 USAAF
// heavy bomber crewmen. No assets: geometry plus canvas textures only.
// API: makeCrewman(seed, name) -> THREE.Group with userData.update(dt, state); disposeCrewman(group).
import * as THREE from '/three.js';

const PI = Math.PI, TAU = PI * 2, V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

function rng(seed) {
  let h = typeof seed === 'number' ? (seed * 2654435761) >>> 0
    : [...String(seed)].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    h = (h + 0x6D2B79F5) >>> 0; let t = h;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---------- shared textures, materials, geometries (built once, shared by every crewman) ----------
let SH = null;

function canvasTex(size, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry); t.anisotropy = 4;
  return t;
}
function speckle(g, s, base, amp, n, r, alpha = .5) {
  g.fillStyle = `rgb(${base},${base},${base})`; g.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) {
    const v = clamp(base + (Math.random() * 2 - 1) * amp | 0, 0, 255);
    g.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    g.fillRect(Math.random() * s, Math.random() * s, r, r);
  }
}

function buildTextures() {
  return {
    // grained leather with creases and two panel seams
    leather: canvasTex(256, (g, s) => {
      speckle(g, s, 222, 30, 6000, 2);
      g.lineCap = 'round';
      for (let i = 0; i < 70; i++) {
        const x = Math.random() * s, y = Math.random() * s, l = 10 + Math.random() * 40, a = (Math.random() - .5) * .8;
        g.strokeStyle = `rgba(60,40,30,${.08 + Math.random() * .14})`; g.lineWidth = 1 + Math.random() * 2;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l * .5, y + 6 * Math.sin(i), x + l * Math.cos(a), y + l * Math.sin(a)); g.stroke();
      }
      for (const x of [s * .25, s * .75]) {
        g.strokeStyle = 'rgba(40,25,15,.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, s); g.stroke();
        g.strokeStyle = 'rgba(255,240,210,.25)'; g.setLineDash([3, 3]); g.lineWidth = 1;
        g.beginPath(); g.moveTo(x + 4, 0); g.lineTo(x + 4, s); g.stroke(); g.setLineDash([]);
      }
    }),
    // shearling: curly cream pile
    fur: canvasTex(128, (g, s) => {
      speckle(g, s, 225, 10, 0, 1);
      for (let i = 0; i < 900; i++) {
        const v = 170 + Math.random() * 85 | 0;
        g.fillStyle = `rgba(${v},${v},${v},.6)`;
        g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 1.5 + Math.random() * 3, 0, TAU); g.fill();
      }
    }, 2, 2),
    // olive drab wool: fine twill
    wool: canvasTex(128, (g, s) => {
      speckle(g, s, 215, 35, 5000, 1);
      g.strokeStyle = 'rgba(0,0,0,.06)';
      for (let i = -s; i < s; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke(); }
    }, 2, 2),
    // knit rib for A-2 cuffs and waistband
    knit: canvasTex(64, (g, s) => {
      speckle(g, s, 200, 20, 600, 1);
      for (let x = 0; x < s; x += 4) { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x, 0, 1.5, s); }
    }, 6, 1),
    // flak vest: quilted plate segments under cloth
    flak: canvasTex(256, (g, s) => {
      speckle(g, s, 205, 25, 4000, 1);
      g.strokeStyle = 'rgba(20,20,10,.32)'; g.lineWidth = 3;
      const rows = 5, cols = 10;
      for (let r = 0; r <= rows; r++) { g.beginPath(); g.moveTo(0, r * s / rows); g.lineTo(s, r * s / rows); g.stroke(); }
      for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
        const x = (c + (r % 2) * .5) * s / cols;
        g.beginPath(); g.moveTo(x, r * s / rows); g.lineTo(x, (r + 1) * s / rows); g.stroke();
      }
      g.strokeStyle = 'rgba(255,255,230,.12)'; g.lineWidth = 2;
      for (let r = 0; r < rows; r++) { g.beginPath(); g.moveTo(0, r * s / rows + 4); g.lineTo(s, r * s / rows + 4); g.stroke(); }
    }),
    // corrugated rubber hose ribs (u runs along the tube)
    hose: canvasTex(64, (g, s) => {
      for (let x = 0; x < s; x += 8) {
        const gr = g.createLinearGradient(x, 0, x + 8, 0);
        gr.addColorStop(0, '#333'); gr.addColorStop(.5, '#eee'); gr.addColorStop(1, '#333');
        g.fillStyle = gr; g.fillRect(x, 0, 8, s);
      }
    }, 14, 1),
    // face paint on the head sphere's UVs: front of face is u=0.75, uv.y = 1 - theta/PI.
    // White = skin colour; darker = sockets, brows, stubble; reddish = lips.
    face: canvasTex(512, (g, s) => {
      g.fillStyle = '#fff'; g.fillRect(0, 0, s, s);
      const k = s / TAU, cx = .75 * s, Y = v => (PI / 2 - v) * s / PI;   // v = elevation (rad)
      const blob = (x, y, rx, ry, col, a) => {
        g.save(); g.translate(x, y); g.scale(rx, ry);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
        gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0));
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
      };
      blob(cx, Y(-.62), .62 * k, .28 * s / PI, 'rgba(120,120,130,A)', .22);          // stubble shadow
      for (const sd of [-1, 1]) {
        const ex = cx + sd * .36 * k;
        blob(ex, Y(.1), .2 * k, .1 * s / PI, 'rgba(70,45,35,A)', .55);               // socket shadow
        blob(ex, Y(.1), .085 * k, .035 * s / PI, 'rgba(25,15,12,A)', .95);           // eye
        g.strokeStyle = 'rgba(55,35,25,.85)'; g.lineWidth = .045 * s / PI; g.lineCap = 'round';
        g.beginPath(); g.moveTo(cx + sd * .2 * k, Y(.235)); g.quadraticCurveTo(cx + sd * .38 * k, Y(.29), cx + sd * .55 * k, Y(.23)); g.stroke();
        blob(cx + sd * .55 * k, Y(-.22), .2 * k, .14 * s / PI, 'rgba(220,120,100,A)', .18); // cheek warmth
      }
      blob(cx, Y(-.3), .13 * k, .05 * s / PI, 'rgba(90,55,45,A)', .45);              // under-nose shadow
      blob(cx, Y(-.47), .2 * k, .055 * s / PI, 'rgba(175,95,85,A)', .85);            // lips
      g.strokeStyle = 'rgba(70,35,30,.7)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(cx - .15 * k, Y(-.465)); g.quadraticCurveTo(cx, Y(-.48), cx + .15 * k, Y(-.465)); g.stroke();
    }),
    // webbing: woven lengthwise with darker edges (u along the strap)
    web: canvasTex(64, (g, s) => {
      speckle(g, s, 215, 25, 800, 1);
      for (let y = 0; y < s; y += 3) { g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, y, s, 1); }
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, s, 5); g.fillRect(0, s - 5, s, 5);
    }, 4, 1),
  };
}

function mat(color, kind) {
  const key = kind + color;
  if (SH.mats[key]) return SH.mats[key];
  const T = SH.tex, p = { color, roughness: .85, metalness: 0 };
  if (kind === 'leather') Object.assign(p, { map: T.leather, roughness: .58 });
  if (kind === 'helmet') Object.assign(p, { map: T.leather, roughness: .5, side: THREE.DoubleSide });
  if (kind === 'suede') Object.assign(p, { map: T.wool, roughness: .95 });
  if (kind === 'fur' || kind === 'furD') Object.assign(p, { map: T.fur, roughness: 1, side: kind === 'furD' ? THREE.DoubleSide : THREE.FrontSide });
  if (kind === 'wool') Object.assign(p, { map: T.wool, roughness: .95 });
  if (kind === 'knit') Object.assign(p, { map: T.knit, roughness: 1 });
  if (kind === 'flak') Object.assign(p, { map: T.flak, roughness: .95 });
  if (kind === 'hose') Object.assign(p, { map: T.hose, roughness: .7 });
  if (kind === 'web') Object.assign(p, { map: T.web, roughness: .95, side: THREE.DoubleSide });
  if (kind === 'skin') Object.assign(p, { roughness: .62 });
  if (kind === 'face') Object.assign(p, { map: T.face, roughness: .62 });
  if (kind === 'metal') Object.assign(p, { metalness: .6, roughness: .3 });
  if (kind === 'rubber') Object.assign(p, { roughness: .7 });
  if (kind === 'glass') Object.assign(p, { metalness: .5, roughness: .06 });
  return SH.mats[key] = new THREE.MeshStandardMaterial(p);
}

// lathe from a bottom-to-top [radius, y] profile, depth (z) squashed by zf
function lathe(pts, seg, zf = 1) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  g.scale(1, 1, zf); g.computeVertexNormals();
  return g;
}
// tapered limb hanging down from its joint: rounded caps at both ends
function limb(r1, r2, len, seg = 10) {
  const p = [];
  for (let i = 0; i <= 3; i++) { const a = -PI / 2 + i * PI / 6; p.push([r2 * Math.cos(a), -len + r2 * .6 * Math.sin(a)]); }
  for (let i = 0; i <= 3; i++) { const a = i * PI / 6; p.push([r1 * Math.cos(a), r1 * .6 * Math.sin(a)]); }
  return lathe(p, seg);
}
// flat strap following a curve; side = constant width direction
function ribbon(pts, side, w, segs = 20) {
  const c = new THREE.CatmullRomCurve3(pts), pos = [], nor = [], uv = [], idx = [];
  const len = c.getLength();
  for (let i = 0; i <= segs; i++) {
    const p = c.getPointAt(i / segs), t = c.getTangentAt(i / segs), sd = side.isVector3 ? side : side(t), n = new THREE.Vector3().crossVectors(sd, t).normalize();
    const ww = (typeof w === 'number' ? w : w(i / segs)) / 2;
    for (const s of [-1, 1]) { pos.push(p.x + sd.x * s * ww, p.y + sd.y * s * ww, p.z + sd.z * s * ww); nor.push(n.x, n.y, n.z); uv.push(i / segs * len / .1, s < 0 ? 0 : 1); }
    if (i) { const a = i * 2; idx.push(a - 2, a - 1, a, a - 1, a + 1, a); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// torso cross-section profiles [radius, y] in chest / spine frames, depth factor applied separately
const CHEST = [[.165, -.12], [.183, -.02], [.2, .08], [.212, .17], [.212, .23], [.18, .285], [.115, .315], [.06, .326], [0, .33]];
const CHEST_Z = .63;
const rAt = (P, y) => {
  if (y <= P[0][1]) return P[0][0];
  for (let i = 1; i < P.length; i++) if (y <= P[i][1]) { const [r0, y0] = P[i - 1], [r1, y1] = P[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); }
  return 0;
};
// z of the front (-z) or back surface of the chest at (x, y)
const chestZ = (x, y, back = false, off = .012) => {
  const r = rAt(CHEST, y), d = Math.sqrt(Math.max(r * r - x * x, 0)) * CHEST_Z + off;
  return back ? d : -d;
};

// head: sphere deformed into skull, jaw, brow and chin; facial detail is painted (face texture)
function headGeo() {
  const g = new THREE.SphereGeometry(1, 20, 14), p = g.attributes.position, n = new THREE.Vector3();
  const bump = (u, v, u0, v0, su, sv) => Math.exp(-((u - u0) ** 2 / (su * su) + (v - v0) ** 2 / (sv * sv)));
  for (let i = 0; i < p.count; i++) {
    n.fromBufferAttribute(p, i).normalize();
    const u = Math.atan2(n.x, -n.z), v = Math.asin(clamp(n.y, -1, 1)), low = Math.max(0, -n.y), front = Math.max(0, -n.z);
    const rx = .08 * (1 - .3 * low * low), ry = .112, rz = .1 * (1 - .1 * low * low) * (1 - .1 * front * front);
    let d = .007 * bump(u, v, 0, .25, .55, .08) + .01 * bump(u, v, 0, -.85, .3, .2) + .004 * bump(u, v, 0, -.45, .2, .08);
    for (const sd of [-1, 1]) d += .004 * bump(u, v, sd * .6, -.12, .2, .15) - .006 * bump(u, v, sd * .36, .1, .14, .09);
    p.setXYZ(i, n.x * (rx + d), n.y * (ry + d) + .075, n.z * (rz + d) + .005);
  }
  g.computeVertexNormals();
  return g;
}

function buildGeometries() {
  const G = {};
  G.ball = new THREE.SphereGeometry(1, 10, 7);
  G.head = headGeo();
  G.bead = new THREE.SphereGeometry(1, 7, 5);
  G.dome = new THREE.SphereGeometry(1, 10, 5, 0, TAU, 0, PI / 2).rotateX(-PI / 2); // dome toward -z
  G.chest = lathe(CHEST, 16, CHEST_Z);
  G.abdomen = lathe([[.158, -.08], [.157, .05], [.162, .15], [.168, .26]], 16, .7);
  G.waistband = lathe([[.166, -.1], [.173, -.085], [.174, -.035], [.169, -.02]], 16, .72);
  G.pelvis = lathe([[0, -.135], [.1, -.125], [.152, -.075], [.16, 0], [.148, .06]], 14, .74);
  G.flak = lathe([[.19, -.15], [.208, -.02], [.226, .08], [.238, .17], [.238, .23], [.2, .283], [.135, .308]], 16, .7);
  G.flakApron = lathe([[.19, -.1], [.188, .05], [.19, .26]], 16, .76);
  G.neck = limb(.05, .056, .1, 8);
  G.upperArm = limb(.069, .057, .29, 9);
  G.foreArm = limb(.059, .047, .24, 9);
  G.thigh = limb(.088, .064, .44, 9);
  G.shin = limb(.061, .048, .42, 9);
  G.bootShaft = lathe([[.058, -.43], [.068, -.39], [.071, -.3], [.073, -.21], [.074, -.18]], 12);
  G.gauntlet = lathe([[.037, -.045], [.046, -.005], [.057, .03], [.04, .045]], 10);
  G.cuffRing = new THREE.TorusGeometry(.05, .017, 4, 10).rotateX(PI / 2);
  G.bootRim = new THREE.TorusGeometry(.072, .015, 4, 10).rotateX(PI / 2);
  G.thighStrap = lathe([[.092, -.022], [.095, 0], [.092, .022]], 12);
  G.collar = lathe([[.185, .25], [.2, .268], [.197, .29], [.17, .322], [.135, .35], [.108, .372], [.09, .368], [.083, .335]], 16, .74);
  G.collarA2 = new THREE.TorusGeometry(.088, .022, 6, 16).rotateX(PI / 2).scale(1.12, 1.2, .9);
  // A-11 helmet: crown cap plus a skirt with a face opening
  G.helmCap = new THREE.SphereGeometry(1, 16, 6, 0, TAU, 0, .42 * PI);
  const open = .78;
  G.helmSkirt = new THREE.SphereGeometry(1, 14, 5, 1.5 * PI + open, TAU - 2 * open, .42 * PI, .4 * PI);
  G.chinStrap = new THREE.TorusGeometry(.07, .0055, 4, 10, PI).rotateZ(PI);
  G.gogFrame = new THREE.TorusGeometry(.025, .008, 4, 10);
  G.lens = new THREE.CircleGeometry(.023, 10).rotateY(PI);
  G.gogStrap = new THREE.TorusGeometry(.112, .007, 3, 18).rotateX(PI / 2).scale(.9, 1, 1);
  G.qac = new THREE.CylinderGeometry(.034, .036, .016, 12).rotateX(PI / 2);
  G.dring = new THREE.TorusGeometry(.016, .004, 3, 8);
  G.valve = new THREE.CylinderGeometry(.012, .014, .025, 8);

  // harness webbing in the chest frame
  const shoulderStrap = s => {
    const x = s * .1, pts = [];
    for (const y of [-.05, .1, .22, .27]) pts.push(V(x, y, chestZ(x, y, true)));
    pts.push(V(x, .336, 0));
    for (const y of [.27, .2]) pts.push(V(x, y, chestZ(x, y)));
    pts.push(V(s * .055, .07, chestZ(s * .055, .07, false, .02)));
    return pts;
  };
  const lowerStrap = s => [V(s * .055, .07, chestZ(.055, .07, false, .02)), V(s * .085, -.02, chestZ(.085, -.02)), V(s * .11, -.12, chestZ(.11, -.12))];
  G.straps = [-1, 1].flatMap(s => [ribbon(shoulderStrap(s), V(1, 0, 0), .045, 26), ribbon(lowerStrap(s), V(1, 0, 0), .045, 8)]);
  const chestStrap = [];
  for (let x = -.19; x <= .19; x += .038) chestStrap.push(V(x, .13, chestZ(x, .13, false, .016)));
  G.chestStrap = ribbon(chestStrap, V(0, 1, 0), .04, 14);
  G.lapel = {};
  for (const s of [-1, 1]) {
    const pts = [[.15, .3], [.12, .25], [.075, .2], [.03, .165]].map(([x, y]) => V(s * x, y, chestZ(x, y, false, .02)));
    G.lapel[s] = ribbon(pts, t => new THREE.Vector3().crossVectors(t, V(0, 0, -1)).normalize(), u => .09 - .065 * u, 8);
  }
  G.zip = ribbon([-.1, .05, .2, .29].map(y => V(0, y, chestZ(0, y, false, .004))), V(1, 0, 0), .01, 10);
  // abdomen continuation of the leg straps (spine frame)
  G.absStraps = [-1, 1].map(s => ribbon([V(s * .11, .2, -.122), V(s * .115, .08, -.123), V(s * .108, -.02, -.124)], V(1, 0, 0), .045, 6));
  // oxygen hose: head part (mask to jaw) and chest part (collar to harness clip), per side
  G.hoseHead = {}; G.hoseChest = {};
  for (const s of [-1, 1]) {
    G.hoseHead[s] = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(s * .1, -.07, -.075), V(s * .097, -.1, -.082), V(s * .092, -.125, -.088)]), 8, .012, 6);
    for (const fl of [0, 1]) {
      const o = fl ? .05 : .03;
      G.hoseChest[s + ':' + fl] = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        V(s * .092, .235, -.088), V(s * .125, .2, chestZ(.125, .21, false, o + .01)),
        V(s * .12, .13, chestZ(.12, .13, false, o)), V(s * .07, .085, chestZ(.07, .085, false, o - .005))]), 12, .0125, 6);
    }
  }
  return G;
}

function shared() {
  if (!SH) { SH = { mats: {} }; SH.tex = buildTextures(); SH.geo = buildGeometries(); }
  return SH;
}

// ---------- poses: every number is a joint angle (radians) or a height (metres) ----------
const POSES = {
  walk: { hipY: .98, hipZ: 0, hipPitch: 0, hipYaw: 0, spinePitch: .03, chestPitch: 0, chestYaw: 0, neckPitch: 0, headPitch: -.03,
    lHipX: 0, rHipX: 0, lKnee: -.06, rKnee: -.06, ankle: 0, hipAb: .035,
    shX: .06, shAb: .14, shY: 0, elbow: .28, wristX: 0, twist: 0, curl: .55, footFlat: 1, plant: 1, sway: 1, labelY: 2.08 },
  crouch: { hipY: .47, hipZ: .25, hipPitch: -.55, hipYaw: 0, spinePitch: -1.0, chestPitch: -.2, chestYaw: 0, neckPitch: .6, headPitch: .6,
    lHipX: .95, rHipX: .95, lKnee: -1.97, rKnee: -1.97, ankle: -1.45, hipAb: .1,
    shX: 1.85, shAb: .14, shY: 0, elbow: .55, wristX: .92, twist: 1.45, curl: .15, footFlat: 0, plant: 0, sway: 0, labelY: 1.1 },
  seated: { hipY: .52, hipZ: .12, hipPitch: 0, hipYaw: 0, spinePitch: -.1, chestPitch: -.04, chestYaw: 0, neckPitch: .06, headPitch: .06,
    lHipX: 1.5, rHipX: 1.5, lKnee: -1.45, rKnee: -1.45, ankle: 0, hipAb: .1,
    shX: .62, shAb: .1, shY: -.2, elbow: 1.0, wristX: -.1, twist: 0, curl: 1.1, footFlat: 1, plant: 0, sway: 0, labelY: 1.68 },
  kneel: { hipY: .56, hipZ: .1, hipPitch: 0, hipYaw: 0, spinePitch: -.3, chestPitch: -.12, chestYaw: 0, neckPitch: .2, headPitch: .22,
    lHipX: .3, rHipX: .3, lKnee: -1.87, rKnee: -1.87, ankle: -1.45, hipAb: .12,
    shX: 1.1, shAb: .05, shY: -.3, elbow: 1.25, wristX: .15, twist: 0, curl: 1.2, footFlat: 0, plant: 0, sway: 0, labelY: 1.58 },
  gunner: { hipY: .96, hipZ: 0, hipPitch: 0, hipYaw: .25, spinePitch: -.12, chestPitch: -.04, chestYaw: -.25, neckPitch: .05, headPitch: .05,
    lHipX: .22, rHipX: -.18, lKnee: -.3, rKnee: -.12, ankle: 0, hipAb: .1,
    shX: .6, shAb: .1, shY: -.35, elbow: 1.35, wristX: .1, twist: 0, curl: 1.2, footFlat: 1, plant: 1, sway: .3, labelY: 2.06 },
};
const HEAD_YAW_MAX = 70 * PI / 180, BLEND_TIME = .6;
// leg geometry used to plant feet on the floor
const THIGH = .44, SHIN = .42, ANKLE_SOLE = .088, HIP_DROP = .03;

// ---------- builder ----------
const SKIN = ['#e3bc9c', '#d9aa86', '#cc9873', '#e8c6a8', '#c48a64', '#9a6644'];
const B3 = ['#5a3f2b', '#4e3825', '#654832'];
const A2 = ['#4c3020', '#5e3624', '#41291c'];
const FUR = ['#ddd0b4', '#d3c4a4', '#e3d8c0'];
const HELM = ['#3b2819', '#4a3220', '#57391f', '#30241b'];
const OD = ['#4f4b33', '#59563b', '#4a4632'];
const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];

function mesh(parent, geo, material, p = [0, 0, 0], r = [0, 0, 0], s = null) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...p); m.rotation.set(...r);
  if (s) typeof s === 'number' ? m.scale.setScalar(s) : m.scale.set(...s);
  parent.add(m); return m;
}
const grp = (parent, p = [0, 0, 0], order = 'XYZ') => { const g = new THREE.Group(); g.position.set(...p); g.rotation.order = order; parent.add(g); return g; };

function makeLabel(name) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), font = '600 34px "Segoe UI", Arial, sans-serif';
  g.font = font; const w = Math.ceil(g.measureText(name).width) + 36; c.width = w; c.height = 52;
  g.font = font; g.fillStyle = 'rgba(16,17,12,.55)';
  g.beginPath(); g.roundRect(1, 1, w - 2, 50, 12); g.fill();
  g.strokeStyle = 'rgba(214,196,150,.35)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#eadfbf'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, w / 2, 27);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: .9 }));
  sp.scale.set(.11 * w / 52, .11, 1); sp.renderOrder = 10; sp.name = 'nameTag';
  return sp;
}

export function makeCrewman(seed = 1, name = '') {
  const { geo: G } = shared();
  const r = rng(seed);
  const variant = r() < .7 ? 'B3' : 'A2', flak = r() < .3, a3 = variant === 'B3' && r() < .45;
  const skinC = r() < .85 ? pick(r, SKIN.slice(0, 4)) : pick(r, SKIN.slice(4));
  const jacketC = variant === 'B3' ? pick(r, B3) : pick(r, A2), furC = pick(r, FUR), helmC = pick(r, HELM), odC = pick(r, OD);
  const maskSide = r() < .5 ? 1 : -1, height = .97 + r() * .06;

  const M = {
    skin: mat(skinC, 'skin'), face: mat(skinC, 'face'), jacket: mat(jacketC, 'leather'), fur: mat(furC, 'fur'), furD: mat(furC, 'furD'),
    trousers: a3 ? mat(B3[(B3.indexOf(jacketC) + 1) % 3], 'leather') : mat(odC, 'wool'),
    helmet: mat(helmC, 'helmet'), glove: mat('#2e2219', 'leather'), boot: mat('#4a3526', 'suede'), sole: mat('#1c1915', 'rubber'),
    web: mat('#a39770', 'web'), metal: mat('#9a9a94', 'metal'), brass: mat('#b08a48', 'metal'), rubber: mat('#24221e', 'rubber'),
    glass: mat('#3a4a52', 'glass'), mask: mat('#4f5746', 'rubber'), hose: mat('#4e5644', 'hose'),
    dark: mat('#2a1c15', 'rubber'), lip: mat('#86574a', 'skin'), brow: mat('#3a2a1e', 'rubber'),
    knit: mat('#3a2a20', 'knit'), flak: mat('#5a5838', 'flak'),
  };

  const root = new THREE.Group(); root.name = 'crewman';
  const rig = grp(root); rig.scale.setScalar(height);
  const J = {};
  J.hips = grp(rig, [0, .98, 0]);
  mesh(J.hips, G.pelvis, M.trousers);
  J.spine = grp(J.hips, [0, .08, 0]);
  mesh(J.spine, G.abdomen, M.jacket);
  mesh(J.spine, G.waistband, variant === 'A2' ? M.knit : M.jacket);
  if (flak) mesh(J.spine, G.flakApron, M.flak);
  for (const g of G.absStraps) mesh(J.spine, g, M.web);
  J.chest = grp(J.spine, [0, .18, 0]);
  J.chestMesh = mesh(J.chest, G.chest, M.jacket);
  mesh(J.chest, G.zip, M.metal);
  for (const g of G.straps) mesh(J.chest, g, M.web);
  mesh(J.chest, G.chestStrap, M.web);
  mesh(J.chest, G.qac, M.metal, [0, .07, chestZ(0, .07, false, .028)]);
  for (const s of [-1, 1]) mesh(J.chest, G.dring, M.metal, [s * .135, .03, chestZ(.135, .03, false, .02)], [0, s * .5, 0]);
  if (flak) mesh(J.chest, G.flak, M.flak);
  if (variant === 'B3') {
    mesh(J.chest, G.collar, M.furD, [0, 0, .01], [-.06, 0, 0]);
    for (const s of [-1, 1]) mesh(J.chest, G.lapel[s], M.furD);
  } else {
    mesh(J.chest, G.collarA2, M.jacket, [0, .31, .006], [-.2, 0, 0]);
    for (const s of [-1, 1]) mesh(J.chest, G.bead, M.jacket, [s * .06, .245, chestZ(.06, .245, false, .015)], [-.3, s * .25, s * -.55], [.04, .085, .012]);
  }
  mesh(J.chest, G.hoseChest[maskSide + ':' + (flak ? 1 : 0)], M.hose);
  J.neck = grp(J.chest, [0, .29, .005], 'YXZ');
  mesh(J.neck, G.neck, M.skin, [0, .1, 0]);
  J.head = grp(J.neck, [0, .07, 0], 'YXZ');
  buildHead(J.head, G, M, maskSide);

  for (const s of [-1, 1]) {
    const k = s < 0 ? 'l' : 'r';
    const sh = J[k + 'Sh'] = grp(J.chest, [s * .2, .24, .005]);
    mesh(sh, G.ball, M.jacket, [-s * .012, -.005, 0], [0, 0, 0], [.085, .075, .074]);
    mesh(sh, G.upperArm, M.jacket);
    const el = J[k + 'El'] = grp(sh, [0, -.29, 0]);
    mesh(el, G.foreArm, M.jacket);
    mesh(el, G.cuffRing, variant === 'B3' ? M.fur : M.knit, [0, -.215, 0]);
    const wr = J[k + 'Wr'] = grp(el, [0, -.25, 0]);
    mesh(wr, G.gauntlet, M.glove);
    mesh(wr, G.bead, M.glove, [0, -.05, 0], [0, 0, 0], [.025, .048, .047]);
    const fi = J[k + 'Fi'] = grp(wr, [0, -.066, 0]);
    mesh(fi, G.bead, M.glove, [0, -.028, 0], [0, 0, 0], [.018, .038, .043]);
    mesh(wr, G.bead, M.glove, [-s * .016, -.05, -.036], [-.3, 0, -s * .5], [.014, .032, .014]);

    const hp = J[k + 'Hip'] = grp(J.hips, [s * .093, -HIP_DROP, 0]);
    mesh(hp, G.thigh, M.trousers);
    mesh(hp, G.thighStrap, M.web, [0, -.09, 0], [s * -.15, 0, s * .18]);
    const kn = J[k + 'Kn'] = grp(hp, [0, -THIGH, 0]);
    mesh(kn, G.shin, M.trousers);
    mesh(kn, G.bootShaft, M.boot);
    mesh(kn, G.bootRim, M.fur, [0, -.18, 0]);
    const an = J[k + 'An'] = grp(kn, [0, -SHIN, 0]);
    mesh(an, G.bead, M.boot, [0, -.035, -.058], [0, 0, 0], [.058, .053, .14]);
    mesh(an, G.bead, M.boot, [0, -.035, .03], [0, 0, 0], [.055, .05, .065]);
    mesh(an, G.bead, M.sole, [0, -.07, -.05], [0, 0, 0], [.056, .014, .135]);
  }

  let label = null;
  if (name) { label = makeLabel(String(name)); label.position.y = 2.08; root.add(label); }

  const st = {
    cur: { ...POSES.walk }, from: { ...POSES.walk }, pose: 'walk', w: 1, phase: 0, t: r() * 100, walkAmp: 0, crawlAmp: 0,
    bodyYaw: null, headYaw: 0, headPitch: 0, height,
  };
  root.userData.crew = { J, label, st };
  root.userData.update = (dt, state = {}) => update(root, Math.min(Math.max(dt || 0, 0), .1), state);
  root.userData.update(0, {});
  return root;
}

function buildHead(h, G, M, side) {
  const c = [0, .075, .005];
  mesh(h, G.head, M.face);
  mesh(h, G.bead, M.skin, [0, .054, -.084], [.12, 0, 0], [.011, .024, .012]);       // nose
  // A-11 helmet
  const hs = [.1, .118, .114];
  mesh(h, G.helmCap, M.helmet, c, [0, 0, 0], hs);
  mesh(h, G.helmSkirt, M.helmet, c, [0, 0, 0], hs);
  for (const s of [-1, 1]) {
    mesh(h, G.bead, M.helmet, [s * .1, .058, .006], [0, 0, 0], [.022, .044, .04]);   // earphone housing
  }
  mesh(h, G.chinStrap, M.helmet, [0, .045, -.035], [-.45, 0, 0], [1.45, 1, 1]);
  // B-8 goggles pushed up on the helmet
  mesh(h, G.gogStrap, M.web, [0, .12, .005], [.42, 0, 0]);
  const gg = grp(h, [0, .156, -.088]); gg.rotation.x = .72;
  for (const s of [-1, 1]) {
    mesh(gg, G.gogFrame, M.rubber, [s * .037, 0, 0]);
    mesh(gg, G.lens, M.glass, [s * .037, 0, -.006]);
  }
  mesh(gg, G.bead, M.rubber, [0, -.004, .002], [0, 0, 0], [.014, .007, .008]);
  // A-14 oxygen mask unclipped, hanging from one side
  const mk = grp(h, [side * .1, -.025, -.07]);
  mk.rotation.set(.35, -side * 1.15, side * .25);
  mesh(mk, G.dome, M.mask, [0, 0, 0], [0, 0, 0], [.034, .05, .03]);
  mesh(mk, G.valve, M.rubber, [0, -.046, -.01]);
  mesh(h, G.hoseHead[side], M.hose);
}

function update(root, dt, s) {
  const { J, label, st } = root.userData.crew, cur = st.cur;
  const name = POSES[s.pose] ? s.pose : 'walk', pose = POSES[name], speed = Math.max(0, s.speed || 0);
  // pose change: ease-in-out crossfade from wherever the body is right now
  if (name !== st.pose) { st.pose = name; st.from = { ...cur }; st.w = 0; }
  st.w = Math.min(1, st.w + dt / BLEND_TIME);
  const e = st.w * st.w * (3 - 2 * st.w);
  for (const key in pose) cur[key] = st.from[key] + (pose[key] - st.from[key]) * e;
  const walkT = name === 'walk' ? Math.min(speed / 1.4, 1.4) : 0;
  const crawlT = name === 'crouch' ? Math.min(speed / .6, 1.2) : 0;
  const ka = dt ? 1 - Math.exp(-dt * 7) : 1;
  st.walkAmp += (walkT - st.walkAmp) * ka; st.crawlAmp += (crawlT - st.crawlAmp) * ka;
  const wa = st.walkAmp, ca = st.crawlAmp;
  st.phase += dt * TAU * (ca > wa ? .35 + speed * .9 : .6 + speed * .25);
  st.t += dt;

  // body yaw follows the look direction: when moving, or when the head would turn past its limit
  const look = s.lookYaw || 0;
  if (st.bodyYaw === null) st.bodyYaw = look;
  let diff = wrap(look - st.bodyYaw);
  if (speed > .1) st.bodyYaw += diff * (1 - Math.exp(-dt * 4));
  diff = wrap(look - st.bodyYaw);
  if (Math.abs(diff) > HEAD_YAW_MAX) st.bodyYaw += (diff - Math.sign(diff) * HEAD_YAW_MAX) * (dt ? 1 - Math.exp(-dt * 12) : 1);
  st.bodyYaw = wrap(st.bodyYaw);
  root.rotation.y = st.bodyYaw;
  const hk = dt ? 1 - Math.exp(-dt * 12) : 1;
  st.headYaw += (clamp(wrap(look - st.bodyYaw), -HEAD_YAW_MAX, HEAD_YAW_MAX) - st.headYaw) * hk;
  st.headPitch += (clamp(s.lookPitch || 0, -.9, 1.0) - st.headPitch) * hk;
  const hy = st.headYaw, hp = st.headPitch, t = st.t;

  // legs: walk cycle (left leg leads at phase 0) plus crawl cycle
  const sw = { l: Math.sin(st.phase), r: Math.sin(st.phase + PI) }, cw = { l: Math.cos(st.phase), r: Math.cos(st.phase + PI) };
  let drop = 0;
  const legs = {};
  for (const k2 of ['l', 'r']) {
    const hipX = cur[k2 + 'HipX'] + (.4 * wa + .22 * ca) * sw[k2];
    const knee = cur[k2 + 'Knee'] - wa * (.12 + .95 * Math.pow(Math.max(0, cw[k2]), 1.5)) - ca * .15 * Math.max(0, cw[k2]);
    legs[k2] = { hipX, knee };
    drop = Math.max(drop, THIGH * Math.cos(hipX) + SHIN * Math.cos(hipX + knee));
  }
  const breath = Math.sin(t * 1.5), sway = cur.sway * (1 - Math.min(wa, 1));
  const planted = HIP_DROP + drop + ANKLE_SOLE;
  const hipY = cur.hipY + (planted - cur.hipY) * cur.plant + ca * .02 * Math.abs(sw.l);
  J.hips.position.set(sway * .018 * Math.sin(t * .55), hipY, cur.hipZ);
  J.hips.rotation.set(cur.hipPitch, cur.hipYaw + .12 * wa * sw.l, sway * .025 * Math.sin(t * .55 + .4) + .04 * wa * cw.l);
  const lean = -.08 * Math.max(0, wa - 1) - .04 * wa;
  J.spine.rotation.set(cur.spinePitch + lean + .008 * breath, hy * .12 - .1 * wa * sw.l, -.02 * wa * cw.l);
  J.chest.rotation.set(cur.chestPitch + hp * .1, cur.chestYaw + hy * .13, 0);
  J.chestMesh.scale.set(1 + .008 * breath, 1, 1 + .018 * breath);
  J.neck.rotation.set(cur.neckPitch + hp * .35, hy * .3, 0);
  J.head.rotation.set(cur.headPitch + hp * .55 + .015 * Math.sin(t * .7), hy * .45 + .03 * sway * Math.sin(t * .3), 0);

  for (const k2 of ['l', 'r']) {
    const sg = k2 === 'l' ? -1 : 1, { hipX, knee } = legs[k2];
    J[k2 + 'Hip'].rotation.set(hipX, 0, sg * cur.hipAb);
    J[k2 + 'Kn'].rotation.x = knee;
    const flat = -(hipX + knee + cur.hipPitch);
    J[k2 + 'An'].rotation.x = cur.ankle + (flat - cur.ankle) * cur.footFlat + wa * .2 * Math.max(0, cw[k2]);
    // arms swing opposite to the same-side leg
    const swing = (.36 * wa + .28 * ca) * sw[k2];
    J[k2 + 'Sh'].rotation.set(cur.shX - swing + .01 * breath, sg * cur.shY, sg * (cur.shAb + .02 * breath * cur.sway));
    J[k2 + 'Sh'].position.y = .24 + .003 * breath;
    J[k2 + 'El'].rotation.x = cur.elbow + wa * .3 * Math.max(0, -sw[k2]) + ca * .35 * Math.max(0, -cw[k2]);
    J[k2 + 'Wr'].rotation.set(cur.wristX, sg * cur.twist, 0);
    J[k2 + 'Fi'].rotation.z = -sg * cur.curl;
  }
  if (label) label.position.y = cur.labelY * st.height;
}

export function disposeCrewman(group) {
  if (!group) return;
  group.parent?.remove(group);
  const c = group.userData.crew;
  if (c?.label) { c.label.material.map?.dispose(); c.label.material.dispose(); }
  // ponytail: geometries and materials are shared module-wide and live for the page; nothing else to free
  group.userData.update = () => {};
  group.userData.crew = null;
}
