// 점토 피규어 캐릭터. 부위를 한 덩어리로 합쳐 한 사람당 그리기 1~2번으로 끝냅니다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { textTexture, bubbleSprite } from './world.js';

export const SKINS = ['#f5d3b3', '#f1c9a3', '#e8bc96', '#d9a77e', '#b98560'];
export const HAIRS = ['#22201e', '#3a2a22', '#6b4430', '#a8732f', '#a8a198'];
export const SHIRTS = ['#c64530', '#e0a33a', '#6b8e4e', '#3f7a8c', '#5b5fa8', '#2f3b4a', '#b5654a', '#f0e6d4', '#8a5a8c', '#7d9a6a'];
export const STYLES = [
  { id: 'short', label: '짧은 머리' },
  { id: 'long', label: '긴 머리' },
  { id: 'bun', label: '묶은 머리' },
  { id: 'cap', label: '모자' },
];

export function randomLook(r = Math.random) {
  const p = (a) => a[Math.floor(r() * a.length)];
  return { skin: p(SKINS), hair: p(HAIRS.slice(0, 4)), shirt: p(SHIRTS), style: p(STYLES).id, glasses: r() < 0.25 };
}

const charMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
const geoCache = new Map();
const tagCache = new Map();

function part(list, geo, color, x, y, z, o = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0)), new THREE.Vector3(...(o.s || [1, 1, 1])));
  g.applyMatrix4(m);
  const c = new THREE.Color(color); // already linear (ColorManagement)
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  list.push(g);
}

export function characterGeometry(look) {
  const key = JSON.stringify(look);
  if (geoCache.has(key)) return geoCache.get(key);
  const { skin = '#f1c9a3', hair = '#3a2a22', shirt = '#c64530', style = 'short', glasses = false } = look || {};
  const L = [];
  const sph = (r, a = 16, b = 12) => new THREE.SphereGeometry(r, a, b);
  // 콩떡: one smooth bean. upper part skin, lower part clothes.
  const R = 0.34, CY = 0.38, SC = [1, 1.2, 0.92];
  const split = Math.PI * 0.42;
  part(L, new THREE.SphereGeometry(R, 36, 22, 0, Math.PI * 2, split, Math.PI - split), shirt, 0, CY, 0, { s: SC });
  part(L, new THREE.SphereGeometry(R, 36, 22, 0, Math.PI * 2, 0, split), skin, 0, CY, 0, { s: SC });
  for (const sx of [-1, 1]) {
    part(L, sph(0.07, 12, 8), '#3b322c', 0.11 * sx, 0.03, 0.04, { s: [1, 0.6, 1.3] });
    part(L, sph(0.06, 12, 8), shirt, 0.33 * sx, 0.33, 0, { s: [0.7, 1, 0.8] });
  }
  const capColor = shirt === '#2f3b4a' ? '#c64530' : '#2f3b4a';
  if (style === 'cap') {
    part(L, new THREE.SphereGeometry(R * 1.05, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.36).rotateX(-0.3), capColor, 0, CY, -0.01, { s: SC });
    part(L, new THREE.CylinderGeometry(0.2, 0.2, 0.03, 24, 1, false, 0, Math.PI), capColor, 0, 0.7, 0.27, { rx: 0.3, ry: -Math.PI / 2 });
  } else {
    // hair cap: hairline low at the front, down to the nape at the back
    part(L, new THREE.SphereGeometry(R * 1.04, 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.375).rotateX(-0.48), hair, 0, CY, -0.01, { s: SC });
    // bangs fill the forehead
    for (const [bx, by, bz, rz] of [[-0.14, 0.685, 0.215, 0.35], [0, 0.705, 0.245, 0], [0.14, 0.685, 0.215, -0.35]])
      part(L, sph(0.1, 14, 10), hair, bx, by, bz, { s: [1.3, 0.55, 0.62], rz });
    for (const sx of [-1, 1]) part(L, sph(0.09, 12, 10), hair, 0.27 * sx, 0.6, 0.09, { s: [0.55, 1.05, 0.8] });
  }
  if (style === 'long') {
    part(L, sph(R * 0.98, 24, 16), hair, 0, 0.5, -0.07, { s: [1.03, 0.98, 0.8] });
    for (const sx of [-1, 1]) part(L, sph(0.12, 14, 10), hair, 0.29 * sx, 0.45, 0.02, { s: [0.5, 1.25, 0.7] });
  }
  if (style === 'bun') part(L, sph(0.1, 14, 10), hair, 0, 0.86, -0.06);
  for (const sx of [-1, 1]) {
    part(L, sph(0.036, 14, 10), '#2b2420', 0.1 * sx, 0.59, 0.29, { s: [0.85, 1.2, 0.45] });
    part(L, sph(0.012, 6, 4), '#ffffff', 0.1 * sx + 0.011, 0.606, 0.305);
    part(L, sph(0.046, 12, 8), '#f39a86', 0.175 * sx, 0.53, 0.265, { s: [1, 0.55, 0.3] });
    if (glasses) part(L, new THREE.TorusGeometry(0.062, 0.011, 6, 20), '#3b322c', 0.1 * sx, 0.59, 0.305);
  }
  part(L, new THREE.TorusGeometry(0.03, 0.008, 6, 14, Math.PI), '#2b2420', 0, 0.528, 0.308, { rz: Math.PI });
  const g = mergeGeometries(L, false);
  g.computeBoundingSphere();
  geoCache.set(key, g);
  return g;
}

function tagTexture(gen) {
  const label = gen === '교수' ? '교수' : gen === '게스트' ? 'G' : gen;
  if (!tagCache.has(label)) tagCache.set(label, textTexture(label, { w: 160, h: 100, size: label.length > 2 ? 44 : 60, bg: '#fbf4e6', fg: '#3b2a1e', radius: 20, weight: 900 }));
  return tagCache.get(label);
}

export class Person {
  constructor({ id, gen, name, look }, scene) {
    this.id = id; this.gen = gen; this.name = name;
    this.group = new THREE.Group();
    this.body = new THREE.Mesh(characterGeometry(look), charMat);
    this.body.castShadow = true;
    this.group.add(this.body);
    this.tag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.124), new THREE.MeshStandardMaterial({ map: tagTexture(gen), roughness: 0.8, transparent: true }));
    this.tag.position.set(0, 0.3, 0.318);
    this.group.add(this.tag);
    this.group.scale.setScalar(1.2);
    this.group.userData.personId = id;
    this.pos = new THREE.Vector2(0, 0);
    this.target = null;
    this.speed = 1.2;
    this.phase = Math.random() * 10;
    this.bubble = null;
    this.bubbleUntil = 0;
    this.nextWander = 0;
    scene.add(this.group);
  }
  update(info) {
    if (info.look) this.body.geometry = characterGeometry(info.look);
    if (info.gen && info.gen !== this.gen) { this.gen = info.gen; this.tag.material.map = tagTexture(info.gen); this.tag.material.needsUpdate = true; }
    if (info.name) this.name = info.name;
  }
  place(x, z) { this.pos.set(x, z); this.group.position.set(x, 0, z); }
  walkTo(x, z) { this.target = new THREE.Vector2(x, z); }
  say(text, ms = 7000) {
    if (this.bubble) { this.group.remove(this.bubble); this.bubble.material.map.dispose(); this.bubble.material.dispose(); }
    this.bubble = bubbleSprite(text);
    this.bubble.position.set(0, 1.25, 0);
    this.bubble.scale.multiplyScalar(1 / 1.2);
    this.group.add(this.bubble);
    this.bubbleUntil = performance.now() + ms;
  }
  tick(dt, now) {
    let moving = false;
    if (this.target) {
      const d = this.target.clone().sub(this.pos);
      const len = d.length();
      if (len < 0.05) { this.target = null; }
      else {
        moving = true;
        const step = Math.min(len, this.speed * dt);
        this.pos.addScaledVector(d.normalize(), step);
        const ang = Math.atan2(d.x, d.y);
        let cur = this.group.rotation.y;
        let diff = ((ang - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        this.group.rotation.y = cur + diff * Math.min(1, dt * 8);
      }
    } else {
      // ease back to facing the camera when idle
      const cur = this.group.rotation.y;
      const diff = ((0 - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.group.rotation.y = cur + diff * Math.min(1, dt * 2);
    }
    this.phase += dt * (moving ? 10 : 2);
    const bob = moving ? Math.abs(Math.sin(this.phase)) * 0.08 : Math.sin(this.phase) * 0.01;
    this.group.position.set(this.pos.x, bob, this.pos.y);
    this.body.rotation.z = moving ? Math.sin(this.phase) * 0.06 : 0;
    if (this.bubble && now > this.bubbleUntil) {
      this.group.remove(this.bubble); this.bubble.material.map.dispose(); this.bubble.material.dispose(); this.bubble = null;
    }
    return moving;
  }
  dispose(scene) {
    scene.remove(this.group);
    this.tag.material.dispose();
    if (this.bubble) { this.bubble.material.map.dispose(); this.bubble.material.dispose(); }
  }
}
