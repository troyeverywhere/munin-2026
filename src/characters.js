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
  const c = new THREE.Color(color).convertSRGBToLinear();
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
  for (const sx of [-1, 1]) {
    part(L, sph(0.085, 10, 8), '#2e2824', 0.09 * sx, 0.045, 0.03, { s: [1, 0.55, 1.4] });
    part(L, new THREE.CapsuleGeometry(0.07, 0.16, 4, 8), '#4a4038', 0.09 * sx, 0.2, 0);
    part(L, new THREE.CapsuleGeometry(0.06, 0.2, 4, 8), shirt, 0.27 * sx, 0.56, 0, { rz: 0.22 * sx });
    part(L, sph(0.06, 10, 8), skin, 0.31 * sx, 0.4, 0.01);
  }
  part(L, new THREE.CapsuleGeometry(0.215, 0.22, 6, 16), shirt, 0, 0.6, 0, { s: [1, 1, 0.85] });
  part(L, sph(0.27, 24, 18), skin, 0, 1.08, 0);
  if (style === 'long') part(L, sph(0.29, 20, 14), hair, 0, 0.99, -0.08, { s: [1.02, 1.28, 0.82] });
  if (style === 'cap') {
    part(L, new THREE.SphereGeometry(0.29, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), shirt === '#2f3b4a' ? '#c64530' : '#2f3b4a', 0, 1.12, 0, { rx: -0.25 });
    part(L, new THREE.CylinderGeometry(0.2, 0.2, 0.03, 20, 1, false, 0, Math.PI), shirt === '#2f3b4a' ? '#c64530' : '#2f3b4a', 0, 1.2, 0.2, { rx: -0.2, ry: -Math.PI / 2 });
  } else {
    part(L, new THREE.SphereGeometry(0.287, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.46), hair, 0, 1.09, -0.02, { rx: -0.55 });
    for (const bx of [-0.13, 0, 0.13]) part(L, sph(0.09, 10, 8), hair, bx, 1.255, 0.16, { s: [1.25, 0.62, 0.7] });
  }
  if (style === 'bun') part(L, sph(0.12, 12, 10), hair, 0, 1.36, -0.15);
  for (const sx of [-1, 1]) {
    part(L, sph(0.034, 10, 8), '#2b2420', 0.095 * sx, 1.07, 0.255, { s: [0.85, 1.15, 0.5] });
    part(L, sph(0.011, 6, 4), '#ffffff', 0.095 * sx + 0.012, 1.087, 0.272);
    part(L, new THREE.CapsuleGeometry(0.011, 0.045, 2, 6), style === 'cap' ? '#2b2420' : hair, 0.095 * sx, 1.155, 0.25, { rz: Math.PI / 2 + 0.06 * sx });
    part(L, sph(0.048, 8, 6), '#f2a08c', 0.165 * sx, 1.0, 0.215, { s: [1, 0.6, 0.35] });
    if (glasses) part(L, new THREE.TorusGeometry(0.068, 0.012, 6, 18), '#3b322c', 0.095 * sx, 1.07, 0.268);
  }
  part(L, sph(0.016, 6, 4), '#7a3b30', 0, 0.985, 0.262, { s: [1.8, 0.7, 0.5] });
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
    this.tag = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.15), new THREE.MeshStandardMaterial({ map: tagTexture(gen), roughness: 0.8, transparent: true }));
    this.tag.position.set(0, 0.62, 0.188);
    this.group.add(this.tag);
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
    this.bubble.position.set(0, 1.95, 0);
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
