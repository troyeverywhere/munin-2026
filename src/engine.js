// 3D 장면 + 캐릭터 관리 + 카메라. 폰 화면(index)과 빔 화면(live)이 같이 씁니다.
import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { createWorld, randomSpot, clampWalk } from './world.js';
import { Person } from './characters.js';

function hashRand(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

export function createEngine(container, { view = 'phone' } = {}) {
  const isPhone = view === 'phone';
  const lowEnd = (navigator.hardwareConcurrency || 4) <= 4 || Math.min(screen.width, screen.height) < 380;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isPhone ? (lowEnd ? 1.5 : 2) : 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const { scene, hitTargets, ground } = createWorld({ quality: lowEnd ? 'low' : 'high' });
  const camera = new THREE.PerspectiveCamera(isPhone ? 42 : 30, 1, 0.1, 200);

  let controls = null;
  const home = isPhone
    ? { pos: new THREE.Vector3(0, 19, 19), target: new THREE.Vector3(0, 0.6, 2.4) }
    : { pos: new THREE.Vector3(0, 18.5, 40), target: new THREE.Vector3(0, 2.4, -1.2) };
  camera.position.copy(home.pos);
  camera.lookAt(home.target);
  if (isPhone) {
    controls = new MapControls(camera, renderer.domElement);
    controls.target.copy(home.target);
    controls.enableRotate = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.screenSpacePanning = false;
    controls.minDistance = 9;
    controls.maxDistance = 38;
    controls.zoomSpeed = 0.9;
    controls.addEventListener('change', () => {
      const t = controls.target;
      const cx = Math.max(-13, Math.min(13, t.x)), cz = Math.max(-4, Math.min(13.5, t.z));
      if (cx !== t.x || cz !== t.z) {
        const dx = cx - t.x, dz = cz - t.z;
        t.x = cx; t.z = cz; camera.position.x += dx; camera.position.z += dz;
      }
    });
    controls.update();
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h;
    // keep the whole width of the garden in view on narrow portrait screens
    if (!isPhone) camera.fov = w / h < 1.4 ? 38 : 30;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  // ---- people ----
  const people = new Map();
  let myId = null;
  const remoteMoveAt = new Map();

  function addPlayer(p) {
    if (people.has(p.id)) { people.get(p.id).update(p); return people.get(p.id); }
    const person = new Person(p, scene);
    const r = hashRand(String(p.id));
    const [x, z] = randomSpot(r);
    person.place(x, z);
    person.nextWander = performance.now() + 1000 + r() * 6000;
    people.set(p.id, person);
    return person;
  }
  function removePlayer(id) {
    const p = people.get(id);
    if (p) { p.dispose(scene); people.delete(id); }
  }
  function say(playerId, text, ms) {
    const p = people.get(playerId);
    if (p) p.say(text, ms);
  }
  function remoteMove(id, x, z) {
    const p = people.get(id);
    if (!p || id === myId) return;
    remoteMoveAt.set(id, performance.now());
    p.walkTo(...clampWalk(x, z));
  }

  // ---- taps ----
  const ray = new THREE.Raycaster();
  ray.camera = camera;
  const ndc = new THREE.Vector2();
  let down = null;
  const handlers = { place: null, ground: null, person: null };
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), n: e.isPrimary }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 450;
    down = null;
    if (moved > 10 || !quick) return;
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const bodies = [...people.values()].map((p) => p.body);
    const hits = ray.intersectObjects([...hitTargets, ...bodies], false);
    if (hits.length) {
      const o = hits[0].object;
      if (o.userData.place && handlers.place) return handlers.place(o.userData.place);
      const pid = o.parent && o.parent.userData.personId;
      if (pid && handlers.person) return handlers.person(pid);
    }
    const g = ray.intersectObject(ground, false)[0];
    if (g && handlers.ground) handlers.ground(g.point.x, g.point.z);
  });

  function walkMe(x, z) {
    const p = people.get(myId);
    if (!p) return null;
    const [cx, cz] = clampWalk(x, z);
    p.walkTo(cx, cz);
    showMarker(cx, cz);
    return [cx, cz];
  }

  // ---- tap marker: a bobbing pin + rippling rings where my character is heading ----
  const marker = new THREE.Group();
  {
    const red = new THREE.MeshBasicMaterial({ color: '#c64530', toneMapped: false });
    const cream = new THREE.MeshBasicMaterial({ color: '#fffaf2', toneMapped: false });
    const pin = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 20), red);
    cone.rotation.x = Math.PI; cone.position.y = 0.14;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), red); head.position.y = 0.33;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), cream); dot.position.set(0, 0.35, 0.1);
    pin.add(cone, head, dot);
    pin.name = 'pin';
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), new THREE.MeshBasicMaterial({ color: '#3b2a1e', transparent: true, opacity: 0.22, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; shadow.name = 'shadow';
    marker.add(pin, shadow);
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.27, 40), new THREE.MeshBasicMaterial({ color: '#fffaf2', transparent: true, depthWrite: false, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04 + i * 0.002; ring.userData.offset = i * 0.5; ring.name = 'ring';
      marker.add(ring);
    }
    marker.visible = false;
    marker.renderOrder = 4;
    scene.add(marker);
  }
  let markerT = 0, markerOut = -1;
  function showMarker(x, z) {
    marker.position.set(x, 0, z);
    marker.visible = true; marker.scale.setScalar(0.01);
    markerT = 0; markerOut = -1;
  }
  function tickMarker(dt) {
    if (!marker.visible) return;
    markerT += dt;
    const me = people.get(myId);
    if (markerOut < 0 && (!me || !me.target || markerT > 8)) markerOut = 0;
    let s;
    if (markerOut >= 0) { markerOut += dt; s = Math.max(0, 1 - markerOut / 0.25); if (s === 0) { marker.visible = false; return; } }
    else if (markerT < 0.3) { const k = markerT / 0.3; s = k < 0.6 ? (k / 0.6) * 1.25 : 1.25 - ((k - 0.6) / 0.4) * 0.25; } // pop in with a little overshoot
    else s = 1;
    marker.scale.setScalar(Math.max(0.01, s) * 1.9);
    const pin = marker.getObjectByName('pin');
    pin.position.y = 0.06 + Math.abs(Math.sin(markerT * 5)) * 0.14;
    pin.rotation.y += dt * 2.5;
    marker.getObjectByName('shadow').scale.setScalar(1 - Math.abs(Math.sin(markerT * 5)) * 0.25);
    marker.children.filter((c) => c.name === 'ring').forEach((r) => {
      const f = ((markerT + r.userData.offset) % 1);
      r.scale.setScalar(0.6 + f * 1.6);
      r.material.opacity = (1 - f) * 0.9;
    });
  }
  function focus(id) {
    const p = people.get(id);
    if (!p || !controls) return;
    const off = camera.position.clone().sub(controls.target);
    const to = new THREE.Vector3(p.pos.x, 0.6, p.pos.y);
    flyTo = { from: controls.target.clone(), to, off, t: 0 };
  }
  let flyTo = null;

  // ---- loop ----
  let last = performance.now();
  let running = true;
  const t0 = performance.now();
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { last = performance.now(); requestAnimationFrame(loop); } });
  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (const [id, p] of people) {
      if (id !== myId && !p.target && now > p.nextWander && now - (remoteMoveAt.get(id) || 0) > 20000) {
        p.walkTo(...randomSpot());
        p.nextWander = now + 5000 + Math.random() * 9000;
      }
      p.tick(dt, now);
    }
    tickMarker(dt);
    if (flyTo && controls) {
      flyTo.t = Math.min(1, flyTo.t + dt * 2);
      const k = 1 - Math.pow(1 - flyTo.t, 3);
      controls.target.lerpVectors(flyTo.from, flyTo.to, k);
      camera.position.copy(controls.target).add(flyTo.off);
      if (flyTo.t >= 1) flyTo = null;
    }
    if (controls) controls.update();
    else {
      const a = Math.sin((now - t0) / 1000 * 0.06) * 0.14;
      const r = Math.hypot(home.pos.x - home.target.x, home.pos.z - home.target.z);
      camera.position.set(home.target.x + Math.sin(a) * r, home.pos.y, home.target.z + Math.cos(a) * r);
      camera.lookAt(home.target);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  return {
    renderer, scene, camera, people,
    addPlayer, removePlayer, say, remoteMove, walkMe, focus,
    setMe(id) { myId = id; },
    on(evt, fn) { handlers[evt] = fn; },
    myPos() { const p = people.get(myId); return p ? [p.pos.x, p.pos.y] : null; },
  };
}
