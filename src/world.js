// 연희관 앞마당 디오라마. 정적인 물체는 재질별로 합쳐서 그리기 횟수를 줄입니다.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import fontJson from 'three/examples/fonts/helvetiker_bold.typeface.json';

export const FONT = '"Pretendard Variable", Pretendard, "Noto Sans CJK KR", "Apple SD Gothic Neo", sans-serif';

// ---- seeded random so the scene is the same on every device ----
let seed = 7;
export const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rr = (a, b) => a + rnd() * (b - a);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

export const C = {
  stone: '#b9a487', stoneLight: '#c8b598', stoneDark: '#9b8569', trim: '#e3d6bd',
  roof: '#6b6158', glass: '#3a434c', lit: '#ffcf7e',
  sand: '#e8d6b4', road: '#dcc7a2', wood: '#9a7350', woodLight: '#b98a57',
  lawn: '#97bf63', hedge: '#4f8640', hedgeLight: '#5f9a4b',
  ivy: ['#b4342a', '#c64530', '#d65f38', '#a42b25', '#df8240', '#c13a2c'],
  autumn: ['#e58a3a', '#d9662f', '#eba446', '#c9512b'],
};

export function textTexture(text, { w = 512, h = 128, bg = '#f6ead2', fg = '#4a3424', size = 64, radius = 24, weight = 800 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.beginPath(); g.roundRect(0, 0, w, h, radius); g.fill();
  g.fillStyle = fg;
  g.font = `${weight} ${size}px ${FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + size * 0.04);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// floating label sprite (place names)
export function labelSprite(text, scale = 0.0125) {
  const c = document.createElement('canvas'); const fs = 44;
  const g = c.getContext('2d'); g.font = `800 ${fs}px ${FONT}`;
  const tw = g.measureText(text).width; c.width = Math.ceil(tw + 64); c.height = 84;
  g.font = `800 ${fs}px ${FONT}`;
  g.fillStyle = 'rgba(40,25,15,0.22)'; g.beginPath(); g.roundRect(2, 8, c.width - 4, 72, 36); g.fill();
  g.fillStyle = '#5b3d27'; g.beginPath(); g.roundRect(0, 2, c.width - 4, 72, 36); g.fill();
  g.fillStyle = '#fbefd8'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2 - 2, 40);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, toneMapped: false, depthTest: true }));
  sp.scale.set(c.width * scale, c.height * scale, 1);
  sp.renderOrder = 5;
  return sp;
}

// speech bubble sprite
export function bubbleSprite(text, scale = 0.0105) {
  const c = document.createElement('canvas'); const fs = 40, pad = 26;
  const g = c.getContext('2d'); g.font = `700 ${fs}px ${FONT}`;
  let t = text;
  while (g.measureText(t).width > 520 && t.length > 4) t = t.slice(0, -2);
  if (t !== text) t = t.slice(0, -1) + '…';
  const tw = g.measureText(t).width;
  c.width = Math.ceil(tw + pad * 2); c.height = 96;
  const h = 70;
  g.font = `700 ${fs}px ${FONT}`;
  g.fillStyle = 'rgba(59,41,30,0.18)'; g.beginPath(); g.roundRect(3, 6, c.width - 6, h - 4, 30); g.fill();
  g.fillStyle = '#fffaf2'; g.beginPath(); g.roundRect(2, 2, c.width - 6, h - 6, 30); g.fill();
  g.beginPath(); g.moveTo(c.width / 2 - 12, h - 6); g.lineTo(c.width / 2, h + 14); g.lineTo(c.width / 2 + 12, h - 6); g.fill();
  g.fillStyle = '#3b2a1e'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, c.width / 2 - 2, h / 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, toneMapped: false }));
  sp.scale.set(c.width * scale, c.height * scale, 1);
  sp.renderOrder = 6;
  return sp;
}

export function createWorld({ quality = 'high' } = {}) {
  seed = 7;
  const scene = new THREE.Scene();

  // sky
  {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#9fc0d9'); gr.addColorStop(0.5, '#dfe3e2'); gr.addColorStop(0.8, '#f3e4cf'); gr.addColorStop(1, '#f5dcc0');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
  }
  scene.fog = new THREE.Fog('#f1e4d2', 55, 130);

  // light: late-autumn evening
  scene.add(new THREE.HemisphereLight('#cfe0ee', '#c9a87c', 1.15));
  const sun = new THREE.DirectionalLight('#ffc78a', 2.6);
  sun.position.set(-22, 20, 14);
  sun.castShadow = true;
  const sm = quality === 'high' ? 2048 : 1024;
  sun.shadow.mapSize.set(sm, sm);
  Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 19, bottom: -19, near: 1, far: 70 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 4;
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#b8cfe8', 0.45);
  fill.position.set(18, 10, 20);
  scene.add(fill);

  // ---- builders ----
  const staticGroup = new THREE.Group();
  const mats = {};
  const M = (color, extra = {}) => {
    const key = color + JSON.stringify(extra);
    if (!mats[key]) mats[key] = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...extra });
    return mats[key];
  };
  function put(geo, mat, x, y, z, o = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (o.rx) m.rotation.x = o.rx;
    if (o.ry) m.rotation.y = o.ry;
    if (o.rz) m.rotation.z = o.rz;
    if (o.s) m.scale.set(...o.s);
    m.castShadow = o.cast !== false;
    m.receiveShadow = true;
    (o.parent || staticGroup).add(m);
    return m;
  }
  const rbox = (w, h, d, r, color, x, y, z, o = {}) => put(new RoundedBoxGeometry(w, h, d, 3, r), M(color, o.mat), x, y, z, o);
  const sphereSeg = (r) => (r < 0.12 ? [8, 6] : r < 0.6 ? [14, 10] : [20, 14]);
  const ball = (r, color, x, y, z, o = {}) => put(new THREE.SphereGeometry(r, ...sphereSeg(r)), M(color, o.mat), x, y, z, o);
  const cyl = (r1, r2, h, color, x, y, z, o = {}) => put(new THREE.CylinderGeometry(r1, r2, h, o.seg || 16), M(color, o.mat), x, y, z, o);
  function plate(text, w, h, x, y, z, o = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: textTexture(text, o.tex), roughness: 0.85, transparent: true }));
    m.position.set(x, y, z);
    if (o.ry) m.rotation.y = o.ry;
    if (o.rx) m.rotation.x = o.rx;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }
  const roofShape = (half, h) => { const s = new THREE.Shape(); s.moveTo(-half, 0); s.lineTo(half, 0); s.lineTo(0, h); s.closePath(); return s; };
  const ext = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });

  function stoneMat(rx, ry, tint = '#ffffff') {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#a99478'; g.fillRect(0, 0, 256, 256);
    const tones = ['#b6a083', '#bba68a', '#b29c7f', '#bea98c', '#b49e82'];
    for (let row = 0; row < 16; row++) {
      let x = -rr(0, 20);
      while (x < 256) { const w = rr(14, 30); g.fillStyle = pick(tones); g.fillRect(x + 1, row * 16 + 1, w - 2, 14); x += w; }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4;
    return new THREE.MeshStandardMaterial({ map: t, color: tint, roughness: 0.92 });
  }

  // ---- clouds: the diorama floats on a soft cloud sea ----
  {
    const cm = M('#fffaf4', { roughness: 1, emissive: '#fff4ea', emissiveIntensity: 0.38 });
    const cloud = (x, y, z, s, n = 7) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd(), d = i ? rr(0.5, 1.2) * s : 0;
        const r = (i ? rr(0.55, 0.85) : 1.0) * s;
        put(new THREE.SphereGeometry(1, 16, 10), cm, x + Math.cos(a) * d * 1.4, y + (i ? rr(-0.15, 0.35) * s : 0.15 * s), z + Math.sin(a) * d * 0.7, { s: [r, r * 0.72, r], cast: false });
      }
    };
    for (let x = -18; x <= 18; x += 3.6) cloud(x + rr(-0.6, 0.6), rr(-1.6, -0.9), -13.2 + rr(-0.6, 0.4), rr(1.5, 2.1));
    for (let z = -10; z <= 13; z += 3.4) { cloud(-17.3 + rr(-0.4, 0.4), rr(-1.7, -1.0), z, rr(1.4, 2.0)); cloud(17.3 + rr(-0.4, 0.4), rr(-1.7, -1.0), z, rr(1.4, 2.0)); }
    for (let x = -17; x <= 17; x += 3.8) cloud(x + rr(-0.5, 0.5), rr(-2.0, -1.5), 15.6 + rr(-0.3, 0.5), rr(1.3, 1.8));
    for (let x = -60; x <= 60; x += 10) cloud(x + rr(-3, 3), rr(-5, -2.5), -38 + rr(-6, 4), rr(3.6, 5.5), 8);
    for (const x of [-46, -8, 34]) cloud(x + rr(-4, 4), rr(6, 10), -70 + rr(-6, 6), rr(3.5, 5), 6);
    cloud(-22, 9, -20, 1.6, 5); cloud(24, 11, -24, 1.9, 5); cloud(-6, 13, -34, 2.2, 6);
  }

  // ---- diorama base ----
  rbox(32, 0.4, 26, 0.15, C.sand, 0, -0.2, 1);
  rbox(32.8, 1.3, 26.8, 0.25, '#8f6b48', 0, -1.05, 1);
  rbox(30, 0.03, 2.0, 0.01, C.road, 0, 0.012, -1.3, { cast: false });

  // ---- 연희관 ----
  put(new RoundedBoxGeometry(15, 3.4, 2.6, 3, 0.08), stoneMat(7, 1.6), 0, 1.7, -5.3);
  {
    const g = ext(roofShape(1.5, 1.05), 14.8); g.translate(0, 0, -7.4); g.rotateY(Math.PI / 2);
    put(g, M(C.roof), 0, 3.4, -5.3);
    rbox(0.4, 0.9, 0.4, 0.04, C.stoneDark, -4.6, 4.2, -5.6);
    rbox(0.4, 0.9, 0.4, 0.04, C.stoneDark, 4.6, 4.2, -5.6);
  }
  for (const sx of [-1, 1]) {
    const wx = 7.6 * sx;
    put(new RoundedBoxGeometry(3.2, 3.8, 4.6, 3, 0.08), stoneMat(1.6, 1.8), wx, 1.9, -4.6);
    const g = ext(roofShape(1.62, 1.6), 4.5); g.translate(0, 0, -2.25);
    put(g, M(C.stone), wx, 3.8, -4.6);
    const a = Math.atan2(1.6, 1.75), L = 2.62;
    rbox(L, 0.16, 4.95, 0.05, C.roof, wx - 0.86, 4.72, -4.6, { rz: a });
    rbox(L, 0.16, 4.95, 0.05, C.roof, wx + 0.86, 4.72, -4.6, { rz: -a });
  }
  put(new RoundedBoxGeometry(2.0, 6.2, 2.4, 3, 0.06), stoneMat(1, 3, '#f4ecdf'), 0, 3.1, -4.0);
  for (const sx of [-1, 1]) {
    put(new RoundedBoxGeometry(0.78, 6.9, 0.78, 3, 0.05), stoneMat(0.4, 3.3, '#f4ecdf'), 1.05 * sx, 3.45, -2.86);
    for (const [dx, dz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]])
      rbox(0.24, 0.3, 0.24, 0.03, C.stoneLight, 1.05 * sx + dx, 7.02, -2.86 + dz);
  }
  for (const x of [-0.45, 0, 0.45]) rbox(0.26, 0.3, 0.26, 0.03, C.stoneLight, x, 6.35, -2.95);
  rbox(0.62, 0.72, 0.1, 0.05, C.trim, 0, 5.45, -2.78);
  rbox(1.5, 1.9, 0.12, 0.05, C.trim, 0, 0.95, -2.76);
  cyl(0.75, 0.75, 0.12, C.trim, 0, 1.9, -2.76, { rx: Math.PI / 2, seg: 28 });
  rbox(1.0, 1.5, 0.1, 0.03, '#3a312c', 0, 0.75, -2.7, { cast: false });
  cyl(0.5, 0.5, 0.1, '#3a312c', 0, 1.5, -2.7, { rx: Math.PI / 2, seg: 28, cast: false });
  for (let i = 0; i < 3; i++) rbox(2.1 - i * 0.15, 0.16, 0.42, 0.03, '#d8c9ad', 0, 0.08 + i * 0.16, -2.25 - i * 0.3);

  // cornices, dormers, ridge, lanterns
  rbox(15.2, 0.16, 0.24, 0.05, C.trim, 0, 3.38, -3.98);
  for (const y of [1.35, 2.35]) rbox(14.9, 0.07, 0.1, 0.03, '#cdbd9f', 0, y, -3.97, { cast: false });
  for (const sx of [-1, 1]) {
    rbox(3.35, 0.16, 0.24, 0.05, C.trim, 7.6 * sx, 3.78, -2.28);
    for (const y of [1.35, 2.35]) rbox(3.2, 0.07, 0.1, 0.03, '#cdbd9f', 7.6 * sx, y, -2.27, { cast: false });
  }
  for (const y of [2.3, 3.75, 5.0]) rbox(2.05, 0.1, 0.1, 0.03, '#d9cbb0', 0, y, -2.79, { cast: false });
  for (const dx of [-5.2, -3.1, 3.1, 5.2]) {
    rbox(0.72, 0.62, 0.8, 0.05, C.stoneLight, dx, 3.82, -4.3);
    const gd = ext(roofShape(0.46, 0.38), 0.86); gd.translate(0, 0, -0.43);
    put(gd, M(C.roof), dx, 4.12, -4.3);
    rbox(0.36, 0.38, 0.05, 0.02, C.trim, dx, 3.82, -3.89, { cast: false });
    rbox(0.28, 0.3, 0.05, 0.02, C.glass, dx, 3.82, -3.87, { cast: false });
  }
  rbox(15.0, 0.12, 0.18, 0.05, '#584f47', 0, 4.48, -5.3);
  for (const sx of [-1, 1]) ball(0.11, '#fff0cc', 0.95 * sx, 1.7, -2.6, { mat: { emissive: '#ffcf7e', emissiveIntensity: 1.5 } });

  // windows (instanced), some lit for evening
  {
    const win = [];
    for (const sx of [-1, 1]) {
      for (let i = 0; i <= 5; i++) for (const y of [0.85, 1.85, 2.85]) win.push([sx * (1.6 + i * 0.82), y, -4.0, 0.46, 0.66]);
      for (const dx of [-0.95, 0, 0.95]) for (const y of [0.85, 1.85, 2.85]) win.push([7.6 * sx + dx, y, -2.3, 0.5, 0.66]);
      win.push([7.6 * sx, 4.35, -2.3, 0.5, 0.48]);
      for (const y of [3.1, 4.2]) win.push([0.32 * sx, y, -2.8, 0.42, 0.72]);
      for (const y of [2.4, 3.9, 5.4]) win.push([1.05 * sx, y, -2.47, 0.16, 0.42]);
    }
    const box = new THREE.BoxGeometry(1, 1, 1);
    const frames = new THREE.InstancedMesh(box, M(C.trim), win.length);
    const darkIdx = [], litIdx = [];
    const m4 = new THREE.Matrix4();
    win.forEach(([x, y, z, w, h], i) => {
      m4.compose(new THREE.Vector3(x, y, z + 0.02), new THREE.Quaternion(), new THREE.Vector3(w + 0.07, h + 0.07, 0.06));
      frames.setMatrixAt(i, m4);
      (rnd() < 0.32 ? litIdx : darkIdx).push(i);
    });
    frames.receiveShadow = true; scene.add(frames);
    for (const [idx, mat] of [[darkIdx, M(C.glass, { roughness: 0.4 })], [litIdx, M('#d9a85a', { emissive: C.lit, emissiveIntensity: 0.9 })]]) {
      const g = new THREE.InstancedMesh(box, mat, idx.length);
      idx.forEach((wi, k) => { const [x, y, z, w, h] = win[wi]; m4.compose(new THREE.Vector3(x, y, z + 0.05), new THREE.Quaternion(), new THREE.Vector3(w, h, 0.05)); g.setMatrixAt(k, m4); });
      g.receiveShadow = true; scene.add(g);
    }
  }

  // red ivy (instanced)
  {
    const patches = [
      [-7.4, -5.6, 2.6, -4.0], [-4.9, -3.6, 3.3, -4.0], [-2.9, -1.9, 1.5, -4.0], [1.9, 3.3, 2.4, -4.0], [3.9, 4.9, 1.3, -4.0], [5.0, 6.0, 3.3, -4.0],
      [0.68, 1.42, 5.6, -2.47], [-1.42, -0.68, 2.6, -2.47],
      [-9.2, -7.9, 3.6, -2.3], [8.1, 9.2, 3.1, -2.3], [6.0, 6.8, 1.8, -2.3], [-6.9, -6.0, 2.3, -2.3],
    ];
    const pts = [];
    const density = quality === 'high' ? 95 : 60;
    for (const [x0, x1, y1, z] of patches) {
      const n = Math.round((x1 - x0) * y1 * density);
      const cx = (x0 + x1) / 2, hw = (x1 - x0) / 2;
      for (let i = 0; i < n; i++) {
        const x = rr(x0, x1);
        const top = y1 * (1 - Math.pow(Math.abs(x - cx) / hw, 1.6) * 0.75);
        const y = Math.pow(rnd(), 0.7) * top;
        if (rnd() < 0.15 && y > top * 0.6) continue;
        pts.push([x, y + 0.08, z + 0.03 + rnd() * 0.06, rr(0.08, 0.14)]);
      }
    }
    const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), M('#ffffff', { roughness: 0.8 }), pts.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    pts.forEach(([x, y, z, r], i) => {
      m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, 0)), new THREE.Vector3(r, r, r * 0.35));
      im.setMatrixAt(i, m4); im.setColorAt(i, col.set(pick(C.ivy)));
    });
    im.castShadow = true; im.receiveShadow = true; scene.add(im);
  }

  // shrubs along the building
  for (const x of [-5.6, -4.4, -3.2, -2.0, 2.0, 3.2, 4.4, 5.6]) ball(rr(0.42, 0.55), pick([C.hedge, C.hedgeLight]), x, 0.32, -3.55, { s: [1, 0.8, 1] });
  for (const sx of [-1, 1]) for (const dx of [-1.0, 0, 1.0]) ball(rr(0.45, 0.6), pick([C.hedge, C.hedgeLight]), 7.6 * sx + dx, 0.34, -1.85, { s: [1, 0.8, 1] });

  // ---- 앞마당 ----
  const GZ = 5.0;
  rbox(12.2, 0.22, 8.2, 0.08, C.lawn, 0, 0.11, GZ);
  for (const sx of [-1, 1]) {
    rbox(0.5, 0.62, 9.0, 0.2, C.hedge, 6.35 * sx, 0.31, GZ);
    rbox(5.65, 0.62, 0.5, 0.2, C.hedge, 3.65 * sx, 0.31, GZ - 4.25);
    rbox(5.65, 0.62, 0.5, 0.2, C.hedge, 3.65 * sx, 0.31, GZ + 4.25);
  }
  {
    const y = 0.235;
    rbox(0.8, 0.05, 8.2, 0.02, C.sand, 0, y, GZ, { cast: false });
    const ang = Math.atan2(7.6, 11.6), len = Math.hypot(11.6, 7.6);
    rbox(len, 0.05, 0.8, 0.02, C.sand, 0, y, GZ, { ry: -ang, cast: false });
    rbox(len, 0.05, 0.8, 0.02, C.sand, 0, y, GZ, { ry: ang, cast: false });
    cyl(1.45, 1.45, 0.06, C.sand, 0, 0.245, GZ, { seg: 40, cast: false });
    cyl(0.85, 0.9, 0.18, '#6f9f4f', 0, 0.3, GZ, { seg: 32 });
  }
  for (const [x, z] of [[-4.0, 2.4], [4.0, 2.4], [-4.0, 7.6], [4.0, 7.6]]) ball(0.42, C.hedgeLight, x, 0.55, z, { s: [1, 0.9, 1] });
  for (let i = 0; i < 90; i++) {
    const x = rr(-5.6, 5.6), z = rr(1.4, 8.6);
    if (Math.abs(x) < 0.6) continue;
    ball(0.055, pick(['#f3d35b', '#ef9a4a', '#f6efe0', '#e66a4a']), x, 0.25, z, { cast: false, s: [1, 0.6, 1] });
  }
  // 게시판
  {
    cyl(0.05, 0.05, 1.5, C.wood, -0.6, 1.0, GZ);
    cyl(0.05, 0.05, 1.5, C.wood, 0.6, 1.0, GZ);
    rbox(1.55, 0.95, 0.1, 0.04, C.woodLight, 0, 1.25, GZ + 0.02);
    rbox(1.75, 0.08, 0.36, 0.03, C.wood, 0, 1.78, GZ + 0.04, { rx: -0.25 });
    const notes = [['#fffaf0', -0.45, 1.38], ['#f6d365', -0.05, 1.42], ['#cfe5ee', 0.4, 1.36], ['#f2b8a8', -0.28, 1.08], ['#fffaf0', 0.2, 1.06]];
    for (const [c, x, y] of notes) put(new THREE.PlaneGeometry(0.3, 0.24), M(c), x, y, GZ + 0.08, { rz: rr(-0.12, 0.12), cast: false });
    plate('게시판', 0.9, 0.24, 0, 1.62, GZ + 0.09, { tex: { w: 360, h: 96, size: 54, bg: '#4a3424', fg: '#f6ead2', radius: 18 } });
  }
  // gate
  for (const sx of [-1, 1]) {
    rbox(0.4, 1.6, 0.4, 0.06, C.stoneDark, 1.15 * sx, 0.8, GZ + 4.6);
    ball(0.16, '#ffe2a8', 1.15 * sx, 1.75, GZ + 4.6, { mat: { emissive: '#ffcf7e', emissiveIntensity: 1.2 } });
  }
  rbox(2.9, 0.42, 0.08, 0.04, C.wood, 0, 2.15, GZ + 4.6);
  plate('2026 문인 동문회', 2.7, 0.34, 0, 2.15, GZ + 4.65, { tex: { w: 800, h: 100, size: 58, bg: '#f6ead2', fg: '#7a2a1e', radius: 14 } });
  cyl(0.03, 0.03, 0.5, C.wood, -1.15, 1.95, GZ + 4.6);
  cyl(0.03, 0.03, 0.5, C.wood, 1.15, 1.95, GZ + 4.6);
  // path, benches
  rbox(2.0, 0.03, 4.4, 0.01, C.road, 0, 0.015, GZ + 6.8, { cast: false });
  for (const sx of [-1, 1]) {
    for (const dz of [0, 2.2]) {
      rbox(1.2, 0.08, 0.38, 0.03, C.woodLight, 2.0 * sx, 0.42, GZ + 6.0 + dz);
      rbox(1.2, 0.3, 0.07, 0.03, C.woodLight, 2.0 * sx, 0.64, GZ + 6.0 + dz - 0.17);
      for (const lx of [-0.5, 0.5]) rbox(0.07, 0.4, 0.3, 0.02, '#4a3f37', 2.0 * sx + lx, 0.2, GZ + 6.0 + dz);
    }
  }
  // lamps
  for (const [x, z] of [[-7.1, 0.3], [7.1, 0.3], [-7.1, 9.7], [7.1, 9.7]]) {
    cyl(0.06, 0.08, 2.2, '#3f3a36', x, 1.1, z, { seg: 10 });
    ball(0.2, '#fff0cc', x, 2.3, z, { mat: { emissive: '#ffcf7e', emissiveIntensity: 1.4 } });
  }

  // ---- 안내소 tent ----
  const TENT = { x: -10.5, z: 3.6 };
  {
    const { x: tx, z: tz } = TENT;
    rbox(2.4, 0.75, 1.0, 0.06, '#f4ead6', tx, 0.38, tz);
    rbox(2.42, 0.18, 1.02, 0.04, '#c64530', tx, 0.65, tz);
    for (const [dx, dz] of [[-1.25, -0.7], [1.25, -0.7], [-1.25, 0.7], [1.25, 0.7]]) cyl(0.04, 0.04, 1.95, '#6b4f3a', tx + dx, 0.98, tz + dz, { seg: 8 });
    const c = document.createElement('canvas'); c.width = 512; c.height = 64;
    const g = c.getContext('2d'); for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#f6ecda' : '#c64530'; g.fillRect(i * 32, 0, 32, 64); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const rm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
    for (const sz of [-1, 1]) {
      const slab = new THREE.Mesh(new RoundedBoxGeometry(2.9, 0.08, 1.15, 2, 0.03), rm);
      slab.position.set(tx, 2.2, tz + 0.48 * sz); slab.rotation.x = 0.55 * sz; slab.castShadow = true; slab.receiveShadow = true; scene.add(slab);
    }
    rbox(2.95, 0.12, 0.12, 0.05, '#c64530', tx, 2.5, tz);
    rbox(0.5, 0.18, 0.4, 0.03, '#efe2c8', tx - 0.6, 0.85, tz - 0.1);
    plate('안내소 · 식순', 1.9, 0.42, tx, 0.36, tz + 0.52, { tex: { w: 640, h: 140, size: 70, radius: 20 } });
  }
  // ---- 사진관 booth ----
  const BOOTH = { x: 10.5, z: 4.0 };
  {
    const { x: bx, z: bz } = BOOTH;
    rbox(2.0, 1.9, 1.6, 0.12, '#3f7a8c', bx, 0.95, bz);
    rbox(2.4, 0.28, 2.0, 0.08, '#2f5e6c', bx, 2.02, bz);
    rbox(0.95, 0.62, 0.16, 0.08, '#f6efe2', bx, 1.15, bz + 0.82);
    rbox(0.28, 0.14, 0.1, 0.03, '#f6efe2', bx - 0.2, 1.52, bz + 0.82);
    cyl(0.21, 0.21, 0.14, '#2f3b44', bx, 1.15, bz + 0.92, { rx: Math.PI / 2, seg: 24 });
    cyl(0.1, 0.1, 0.16, '#9fc3d0', bx, 1.15, bz + 0.93, { rx: Math.PI / 2, seg: 16 });
    plate('사진관', 1.3, 0.3, bx, 2.02, bz + 1.01, { tex: { w: 420, h: 100, size: 62, fg: '#2f5e6c', radius: 16 } });
  }
  // ---- Thanks to ----
  const MONU = { x: -10.2, z: 8.6 };
  {
    const { x: mx, z: mz } = MONU;
    rbox(1.8, 0.26, 0.9, 0.06, C.stoneDark, mx, 0.13, mz);
    rbox(1.3, 1.35, 0.34, 0.16, '#cdbb9d', mx, 0.92, mz);
    plate('Thanks to', 1.0, 0.3, mx, 1.15, mz + 0.18, { tex: { w: 400, h: 120, size: 60, bg: '#cdbb9d', fg: '#5a4632', radius: 10, weight: 700 } });
    for (let i = 0; i < 4; i++) put(new THREE.PlaneGeometry(0.75, 0.035), M('#a08a6c'), mx, 0.88 - i * 0.12, mz + 0.18, { cast: false });
    for (let i = 0; i < 10; i++) ball(0.07, pick(['#f3d35b', '#ef9a4a', '#e66a4a']), mx + rr(-1, 1), 0.07, mz + rr(0.5, 0.8), { s: [1, 0.7, 1] });
  }
  // ---- 강당 sign ----
  {
    const sx = 2.4, sz = -1.3;
    cyl(0.05, 0.05, 1.4, C.wood, sx, 0.7, sz, { seg: 8 });
    rbox(1.9, 0.48, 0.08, 0.04, C.wood, sx, 1.35, sz);
    plate('강당 · 진행 장표', 1.75, 0.36, sx, 1.35, sz + 0.05, { tex: { w: 640, h: 132, size: 64, radius: 14 } });
  }

  // ---- trees ----
  const roundTree = (x, z, s, colors) => {
    cyl(0.12 * s, 0.16 * s, 1.6 * s, '#6b4f3a', x, 0.8 * s, z, { seg: 10 });
    const n = 4 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd();
      const r = (i === 0 ? 0.95 : rr(0.6, 0.8)) * s;
      ball(r, pick(colors), x + (i ? Math.cos(a) * 0.55 * s : 0), (i ? rr(1.6, 2.1) : 2.15) * s, z + (i ? Math.sin(a) * 0.55 * s : 0));
    }
  };
  const cypress = (x, z, s, color) => {
    cyl(0.1 * s, 0.12 * s, 0.6 * s, '#6b4f3a', x, 0.3 * s, z, { seg: 8 });
    ball(0.8 * s, color, x, 2.0 * s, z, { s: [1, 2.3, 1] });
  };
  cypress(-12.6, -6.4, 1.15, '#a8c04a');
  cypress(-14.1, -4.8, 0.85, '#86a83f');
  cypress(-11.2, -7.6, 0.7, '#6f9a3c');
  roundTree(12.6, -6.2, 1.2, ['#3f7a45', '#4b8a4a']);
  roundTree(14.2, -3.8, 0.9, ['#3f7a45', '#4b8a4a']);
  roundTree(-13.8, 1.6, 1.0, C.autumn);
  roundTree(13.8, 0.9, 1.0, ['#eba446', '#e58a3a', '#f0b850']);
  roundTree(-13.4, 11.2, 0.95, ['#c9512b', '#d9662f', '#b8452a']);
  roundTree(13.4, 11.6, 0.95, C.autumn);
  roundTree(-11.0, -9.5, 0.9, ['#4b8a4a', '#5f9a4b']);
  roundTree(11.2, -9.6, 0.95, ['#eba446', '#e58a3a']);

  // fallen leaves (instanced)
  {
    const geo = new THREE.CircleGeometry(0.09, 6); geo.rotateX(-Math.PI / 2);
    const im = new THREE.InstancedMesh(geo, M('#ffffff', { side: THREE.DoubleSide }), 260);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    for (let i = 0; i < 260; i++) {
      const side = rnd() < 0.5 ? -1 : 1;
      const x = side * rr(7.6, 15.2), z = rr(-3, 13);
      m4.compose(new THREE.Vector3(x, 0.015, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6, 0)), new THREE.Vector3(1, 1, rr(0.5, 1)));
      im.setMatrixAt(i, m4); im.setColorAt(i, col.set(pick(C.autumn)));
    }
    im.receiveShadow = true; scene.add(im);
  }

  // '26' sculpture + flower bed
  {
    const font = new FontLoader().parse(fontJson);
    const tg = new TextGeometry('26', { font, size: 1.25, depth: 0.42, curveSegments: 6, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.05, bevelSegments: 3 });
    tg.center();
    rbox(2.5, 0.28, 1.0, 0.1, C.stoneDark, 5.6, 0.14, 12.4);
    put(tg, M('#c64530', { roughness: 0.6 }), 5.6, 0.98, 12.4, { ry: -0.28 });
    rbox(3.2, 0.3, 1.3, 0.14, '#7a5a3c', -5.6, 0.15, 12.4);
    rbox(3.0, 0.08, 1.1, 0.04, '#5c4a36', -5.6, 0.31, 12.4, { cast: false });
    for (let i = 0; i < 60; i++) {
      const x = -5.6 + rr(-1.35, 1.35), z = 12.4 + rr(-0.45, 0.45), h = rr(0.2, 0.45);
      cyl(0.012, 0.012, h, '#5f8a3e', x, 0.33 + h / 2, z, { seg: 4, cast: false });
      ball(rr(0.06, 0.09), pick(['#f2b8c6', '#e66a8a', '#f6efe0', '#c64570', '#f3d35b']), x, 0.35 + h, z, { s: [1, 0.55, 1] });
    }
  }

  // ---- merge every static mesh by material ----
  staticGroup.updateMatrixWorld(true);
  const byMat = new Map();
  staticGroup.traverse((m) => {
    if (!m.isMesh) return;
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    g.applyMatrix4(m.matrixWorld);
    const key = m.material.uuid + (m.castShadow ? 'c' : 'n');
    if (!byMat.has(key)) byMat.set(key, { mat: m.material, cast: m.castShadow, geos: [] });
    byMat.get(key).geos.push(g);
  });
  for (const { mat, cast, geos } of byMat.values()) {
    const merged = new THREE.Mesh(mergeGeometries(geos, false), mat);
    merged.castShadow = cast; merged.receiveShadow = true;
    scene.add(merged);
  }

  // ---- place labels + tap targets ----
  const labels = [
    ['강당 · 진행 장표', 'slides', 2.4, 2.6, -1.3, [0, 2, -2.6], [4.2, 4, 1.6]],
    ['게시판', 'board', 0, 2.75, GZ, [0, 1, GZ], [2.2, 2, 1.4]],
    ['안내소 · 식순', 'info', TENT.x, 3.6, TENT.z, [TENT.x, 1.2, TENT.z], [3, 2.6, 2]],
    ['사진관', 'photos', BOOTH.x, 3.0, BOOTH.z, [BOOTH.x, 1.1, BOOTH.z], [2.6, 2.4, 2.2]],
    ['Thanks to', 'thanks', MONU.x, 2.4, MONU.z, [MONU.x, 0.8, MONU.z], [2.2, 1.8, 1.4]],
  ];
  const hitTargets = [];
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  for (const [text, place, lx, ly, lz, c, s] of labels) {
    const sp = labelSprite(text); sp.position.set(lx, ly, lz); sp.userData.place = place; scene.add(sp);
    hitTargets.push(sp);
    const hb = new THREE.Mesh(new THREE.BoxGeometry(...s), hitMat); hb.position.set(...c); hb.userData.place = place; scene.add(hb);
    hitTargets.push(hb);
  }

  // ground plane for tap-to-walk
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ visible: false }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0.02, 1);
  scene.add(ground);

  return { scene, sun, hitTargets, ground };
}

// ---- where characters may stand ----
const OBST = [
  [-12.0, 2.8, -9.0, 4.4], // tent
  [9.3, 2.9, 11.7, 5.1],   // booth
  [-11.2, 8.1, -9.2, 9.1], // monument
  [4.2, 11.8, 7.0, 13.0],  // 26
  [-7.3, 11.6, -3.9, 13.2],// flower bed
  [-0.6, 4.4, 0.6, 5.6],   // board
];
export function clampWalk(x, z) {
  x = Math.max(-14.5, Math.min(14.5, x));
  z = Math.max(-1.9, Math.min(13.8, z));
  if (z < -1.6 && Math.abs(x) < 9.3) z = -1.6;
  for (const [x0, z0, x1, z1] of OBST) {
    if (x > x0 && x < x1 && z > z0 && z < z1) {
      const d = [[x - x0, 'x', x0 - 0.05], [x1 - x, 'x', x1 + 0.05], [z - z0, 'z', z0 - 0.05], [z1 - z, 'z', z1 + 0.05]].sort((a, b) => a[0] - b[0])[0];
      if (d[1] === 'x') x = d[2]; else z = d[2];
    }
  }
  return [x, z];
}
const SPOTS = [
  [-5.6, 1.2, 5.6, 8.8, 5], // lawn
  [-12.5, 10.4, 12.5, 13.6, 3], // front plaza
  [-13, -1.5, 13, -0.2, 2], // road
  [-14, 5, -8, 10, 1], [8, 5.5, 14, 10, 1], // sides
];
export function randomSpot(r = Math.random) {
  const total = SPOTS.reduce((a, s) => a + s[4], 0);
  let k = r() * total, s = SPOTS[0];
  for (const sp of SPOTS) { if ((k -= sp[4]) <= 0) { s = sp; break; } }
  return clampWalk(s[0] + r() * (s[2] - s[0]), s[1] + r() * (s[3] - s[1]));
}
