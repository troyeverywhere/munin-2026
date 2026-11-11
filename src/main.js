// 폰 화면
import * as THREE from 'three';
import { createEngine } from './engine.js';
import { initData, join, post, deleteMine, broadcastMove, me, isDemo } from './data.js';
import { randomLook, characterGeometry } from './characters.js';
import { EVENT, PROGRAM, SEATING, seatFor, NETWORKING, AFTER, THANKS } from './content.js';

const $ = (s) => document.querySelector(s);
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}

const state = { players: new Map(), posts: [], notice: null, step: 0, online: 0, me: null, rerender: null, saidPosts: new Set() };
const genLabel = (g) => (g === '교수' ? '교수님' : g === '게스트' ? '게스트' : `${g}학번`);
const shortGen = (g) => (g === '교수' ? '교수' : g === '게스트' ? 'G' : g);
function when(iso) {
  const d = new Date(iso), s = (Date.now() - d) / 1000;
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function toast(text, ms = 2400) {
  const t = $('#toast'); t.textContent = text; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), ms);
}

// ---------- engine ----------
await (document.fonts ? Promise.race([document.fonts.load('800 20px "Pretendard Variable"'), new Promise((r) => setTimeout(r, 1500))]) : null);
const engine = createEngine($('#stage'), { view: 'phone' });

// ---------- sheet ----------
let sheetCleanup = null;
function openSheet(title, body, { foot = null, tall = false, cls = '', tab = null } = {}) {
  closeSheet(true);
  $('#sheetTitle').textContent = title;
  const b = $('#sheetBody'); b.replaceChildren(body); b.scrollTop = 0;
  const f = $('#sheetFoot'); if (foot) { f.replaceChildren(foot); f.hidden = false; } else f.hidden = true;
  const s = $('#sheet'); s.className = 'sheet' + (tall ? ' tall' : '') + (cls ? ' ' + cls : ''); s.hidden = false;
  $('#scrim').hidden = false;
  setTab(tab || 'map');
}
function closeSheet(silent) {
  $('#sheet').hidden = true; $('#scrim').hidden = true;
  state.rerender = null;
  if (sheetCleanup) { sheetCleanup(); sheetCleanup = null; }
  if (!silent) setTab('map');
}
$('#sheetClose').onclick = () => closeSheet();
$('#scrim').onclick = () => closeSheet();
function setTab(t) { document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t)); }

// ---------- join ----------
function genOptions() {
  const o = [h('option', { value: '' }, '학번 선택')];
  o.push(h('option', { value: '교수' }, '교수님'));
  for (let y = 26; y >= 8; y--) o.push(h('option', { value: String(y).padStart(2, '0') }, `${String(y).padStart(2, '0')}학번`));
  o.push(h('option', { value: '게스트' }, '게스트'));
  return o;
}
function openJoin(after) {
  const cur = state.me ? state.players.get(state.me) : null;
  let look = cur ? { ...cur.look } : randomLook();
  // preview
  const pv = h('div', { class: 'preview' });
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setSize(120, 150); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
  pv.append(r.domElement);
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight('#fff6ea', '#d9bc94', 2.0));
  const dl = new THREE.DirectionalLight('#ffe2bd', 2.0); dl.position.set(-2, 3, 4); sc.add(dl);
  const fl = new THREE.DirectionalLight('#ffffff', 0.9); fl.position.set(1.5, 1, 4); sc.add(fl);
  const cam = new THREE.PerspectiveCamera(26, 120 / 150, 0.1, 20); cam.position.set(0, 0.62, 2.5); cam.lookAt(0, 0.42, 0);
  const body = new THREE.Mesh(characterGeometry(look), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }));
  sc.add(body);
  let alive = true, t = 0;
  (function spin() { if (!alive) return; t += 0.016; body.rotation.y = Math.sin(t * 0.9) * 0.5; r.render(sc, cam); requestAnimationFrame(spin); })();
  const reroll = () => { look = randomLook(); body.geometry = characterGeometry(look); };

  const gen = h('select', { class: 'input', id: 'jgen', 'aria-label': '학번' }, genOptions());
  if (cur) gen.value = cur.gen;
  const name = h('input', { class: 'input', id: 'jname', maxlength: '12', placeholder: '이름', autocomplete: 'name', value: cur ? cur.name : '' });
  const go = h('button', { class: 'btn', type: 'button' }, cur ? '저장하기' : '입장하기');
  const validate = () => { go.disabled = !gen.value || !name.value.trim(); };
  gen.onchange = validate; name.oninput = validate; validate();
  go.onclick = async () => {
    go.disabled = true;
    try {
      const p = await join(gen.value, name.value.trim(), look);
      upsertPlayer(p);
      state.me = p.id; engine.setMe(p.id);
      closeSheet();
      engine.focus(p.id);
      if (!cur) { toast('입장했어요. 땅을 누르면 걸어가요'); $('#hint').hidden = false; setTimeout(() => ($('#hint').hidden = true), 5000); }
      else toast('저장했어요');
      if (after) setTimeout(after, 400);
    } catch (e) { console.error(e); toast('입장하지 못했어요. 잠시 후 다시 시도해 주세요'); go.disabled = false; }
  };
  const body2 = h('div', {},
    h('div', { class: 'join-top' }, h('div', { class: 'preview-col' }, pv,
      h('button', { class: 'reroll', type: 'button', onclick: reroll },
        h('span', { class: 'reroll-ico', 'aria-hidden': 'true' }, '↻'), '다시 뽑기')),
      h('p', {}, h('strong', {}, cur ? '내 캐릭터' : '연희관 앞마당에 오신 걸 환영해요'), cur ? '마음에 안 들면 다시 뽑아 보세요.' : '학번과 이름만 적으면 캐릭터는 자동으로 만들어져요. 마음에 안 들면 다시 뽑기를 눌러 주세요.')),
    h('div', { class: 'row' }, h('div', { class: 'field' }, h('label', { for: 'jgen' }, '학번'), gen), h('div', { class: 'field' }, h('label', { for: 'jname' }, '이름'), name)),
    h('p', { class: 'note' }, '입력한 학번·이름과 남긴 소식은 이 페이지를 연 모든 사람에게 보여요.'),
  );
  const foot = h('div', {}, go, cur ? null : h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => closeSheet() }, '먼저 둘러볼게요'));
  openSheet(cur ? '내 캐릭터' : '입장하기', body2, { foot });
  // register after openSheet: opening a sheet runs the previous sheet's cleanup
  sheetCleanup = () => { alive = false; r.dispose(); };
}

// ---------- compose ----------
function openCompose() {
  if (!state.me) return openJoin(openCompose);
  const ta = h('textarea', { class: 'input', maxlength: '120', placeholder: '요즘 어떻게 지내세요?', 'aria-label': '소식' });
  const cnt = h('div', { class: 'counter' }, '0 / 120');
  const go = h('button', { class: 'btn', type: 'button', disabled: true }, '남기기');
  ta.oninput = () => { cnt.textContent = `${ta.value.length} / 120`; go.disabled = !ta.value.trim(); };
  go.onclick = async () => {
    go.disabled = true;
    try { await sendPost(ta.value.trim()); closeSheet(); }
    catch (e) { console.error(e); toast(String(e.message || '').includes('too fast') ? '조금만 천천히 남겨 주세요' : '남기지 못했어요. 다시 시도해 주세요'); go.disabled = false; }
  };
  openSheet('소식 남기기', h('div', {}, ta, cnt, h('p', { class: 'note' }, '남긴 소식은 맵에서 내 캐릭터 말풍선으로 뜨고, 게시판에도 쌓여요.')), { foot: go });
  setTimeout(() => ta.focus(), 250);
}
async function sendPost(text) {
  const { id } = await post(text);
  const mine = state.players.get(state.me);
  addPost({ id, player_id: state.me, gen: mine.gen, name: mine.name, text, created_at: new Date().toISOString(), picked: false });
}
function addPost(p) {
  if (state.posts.find((x) => x.id === p.id)) return;
  state.posts.push(p);
  if (!state.saidPosts.has(p.id)) { state.saidPosts.add(p.id); engine.say(p.player_id, p.text); }
  state.rerender && state.rerender();
}

// ---------- board ----------
function avatar(gen, playerId) {
  const pl = state.players.get(playerId);
  const bg = pl && pl.look && pl.look.shirt ? pl.look.shirt : '#9a7350';
  const light = ['#f0e6d4', '#e0a33a'].includes(bg);
  return h('div', { class: 'avatar', style: `background:${bg};color:${light ? '#3b2a1e' : '#fff'}` }, shortGen(gen));
}
function openBoard() {
  const list = h('div', { class: 'msgs' });
  const render = () => {
    if (!state.posts.length) return list.replaceChildren(h('div', { class: 'empty' }, '아직 소식이 없어요. 첫 소식을 남겨 주세요.'));
    list.replaceChildren(...state.posts.slice(-150).map((p) => {
      const mine = p.player_id && p.player_id === state.me;
      return h('div', { class: 'msg' + (mine ? ' mine' : '') }, avatar(p.gen, p.player_id),
        h('div', { class: 'msg-body' },
          h('span', { class: 'msg-meta' }, `${genLabel(p.gen)} ${p.name} · ${when(p.created_at)}`),
          h('div', { class: 'msg-text' }, p.text),
          mine ? h('button', { class: 'msg-del', type: 'button', onclick: async () => { try { await deleteMine(p.id); removePost(p.id); } catch { toast('지우지 못했어요'); } } }, '지우기') : null));
    }));
  };
  render();
  const ta = h('textarea', { class: 'input', maxlength: '120', placeholder: '소식 남기기', 'aria-label': '소식' });
  const go = h('button', { class: 'btn', type: 'button' }, '남기기');
  go.onclick = async () => {
    const v = ta.value.trim(); if (!v) return;
    if (!state.me) return openJoin(openBoard);
    go.disabled = true;
    try { await sendPost(v); ta.value = ''; } catch (e) { toast(String(e.message || '').includes('too fast') ? '조금만 천천히 남겨 주세요' : '남기지 못했어요'); }
    go.disabled = false;
  };
  const foot = state.me ? h('div', { class: 'composer' }, ta, go) : h('button', { class: 'btn', type: 'button', onclick: () => openJoin(openBoard) }, '입장하고 소식 남기기');
  openSheet('게시판', list, { foot, tall: true, tab: 'board' });
  state.rerender = () => { const atBottom = $('#sheetBody').scrollHeight - $('#sheetBody').scrollTop - $('#sheetBody').clientHeight < 80; render(); if (atBottom) $('#sheetBody').scrollTop = 1e6; };
  requestAnimationFrame(() => ($('#sheetBody').scrollTop = 1e6));
}
function removePost(id) {
  state.posts = state.posts.filter((p) => p.id !== id);
  state.rerender && state.rerender();
}

// ---------- info ----------
function openInfo() {
  const body = h('div');
  const render = () => {
    const mine = state.me ? state.players.get(state.me) : null;
    const seat = mine ? seatFor(mine.gen) : null;
    body.replaceChildren(
      h('div', { class: 'sec' }, h('div', { class: 'meta-row' }, h('span', {}, EVENT.date), h('span', {}, '·'), h('span', {}, EVENT.time))),
      h('div', { class: 'sec' }, h('h3', {}, '식순'),
        h('ol', { class: 'timeline' }, ...PROGRAM.map((p, i) => h('li', { class: i === state.step ? 'now' : '' },
          h('span', { class: 't' }, p.time),
          h('div', {}, h('div', { class: 'ti' }, p.title, i === state.step ? h('span', { class: 'now-badge' }, '지금') : null), p.desc ? h('div', { class: 'd' }, p.desc) : null))))),
      h('div', { class: 'sec' }, h('h3', {}, '1부 자리 안내'),
        h('div', { class: 'seats' }, ...SEATING.map((s) => h('div', { class: 'seat' + (seat === s ? ' mine' : '') }, h('b', {}, s.line), h('span', {}, s.who)))),
        h('p', { class: 'note' }, seat ? `${genLabel(mine.gen)}은 ${seat.line} 근처에 앉으시면 됩니다. 정해진 자리는 아니에요.` : '학번대별로 느슨하게 나눴어요. 정해진 자리는 아니에요.')),
      h('div', { class: 'sec' }, h('h3', {}, '2부 관심사별 네트워킹'), NETWORKING.confirmed ? null : h('div', { class: 'placeholder' }, NETWORKING.note)),
      h('div', { class: 'sec' }, h('h3', {}, '뒤풀이'), h('div', { class: 'placeholder' }, AFTER.text)),
      h('div', { class: 'sec' }, h('h3', {}, 'Thanks to'), thanksBody()),
    );
  };
  render();
  openSheet('안내소', body, { tall: true, tab: 'info' });
  state.rerender = render;
}
function thanksBody() {
  if (!THANKS.confirmed) return h('div', { class: 'placeholder' }, THANKS.note);
  return h('div', {}, h('p', {}, THANKS.funders.join(' · ')), THANKS.luckyDraw.length ? h('p', { class: 'note' }, '럭키드로우 경품 후원: ' + THANKS.luckyDraw.join(' · ')) : null);
}

// ---------- slides / people / photos ----------
function openSlides() {
  const f = h('iframe', { class: 'slides-frame', src: './slides/', title: '진행 장표' });
  openSheet('진행 장표', f, { tall: true, cls: 'slides', tab: 'slides' });
}
function openPeople() {
  const sel = h('select', { class: 'input filter', 'aria-label': '학번으로 찾기' }, h('option', { value: '' }, '전체 보기'));
  const gens = [...new Set([...state.players.values()].map((p) => p.gen))].sort((a, b) => order(a) - order(b));
  for (const g of gens) sel.append(h('option', { value: g }, genLabel(g)));
  const list = h('div', { class: 'people' });
  const render = () => {
    const ps = [...state.players.values()].filter((p) => !sel.value || p.gen === sel.value).sort((a, b) => order(a.gen) - order(b.gen));
    if (!ps.length) return list.replaceChildren(h('div', { class: 'empty' }, '아직 입장한 사람이 없어요.'));
    list.replaceChildren(...ps.map((p) => h('button', { class: 'person-row', type: 'button', onclick: () => { closeSheet(); engine.focus(p.id); engine.say(p.id, `${genLabel(p.gen)} ${p.name}`, 3500); } },
      avatar(p.gen, p.id), h('span', { class: 'nm' }, `${p.name}${p.id === state.me ? ' (나)' : ''}`), h('span', { class: 'go' }, genLabel(p.gen)))));
  };
  sel.onchange = render; render();
  openSheet(`참석자 ${state.players.size}명`, h('div', {}, sel, list), { tall: true, tab: 'people' });
  state.rerender = render;
}
const order = (g) => (g === '교수' ? -1 : g === '게스트' ? 999 : (+g >= 80 ? +g - 100 : +g));
function openPhotos() {
  openSheet('사진관', h('div', {}, h('div', { class: 'placeholder' }, '사진관은 행사 당일 열려요. 오늘 찍은 사진을 여기에 올리면, 고른 사진을 동문회 사진 아카이브에도 남겨 둘게요.')));
}
function openThanks() { openSheet('Thanks to', h('div', {}, thanksBody())); }

// ---------- wiring ----------
document.querySelectorAll('.tabbar button').forEach((b) => (b.onclick = () => {
  const t = b.dataset.tab;
  if (t === 'map') return closeSheet();
  ({ board: openBoard, info: openInfo, slides: openSlides, people: openPeople })[t]();
}));
$('#composeBtn').onclick = openCompose;
engine.on('place', (p) => ({ board: openBoard, info: openInfo, slides: openSlides, photos: openPhotos, thanks: openThanks })[p]());
engine.on('person', (id) => {
  const p = state.players.get(id); if (!p) return;
  if (id === state.me) return openJoin();
  const last = [...state.posts].reverse().find((x) => x.player_id === id);
  engine.say(id, last ? last.text : `${genLabel(p.gen)} ${p.name}`, 4000);
  toast(`${genLabel(p.gen)} ${p.name}`);
});
engine.on('ground', (x, z) => {
  if (!state.me) { toast('입장하면 캐릭터가 생겨요'); return; }
  const to = engine.walkMe(x, z);
  if (to) broadcastMove(to[0], to[1]);
});

function upsertPlayer(p) {
  state.players.set(p.id, { ...(state.players.get(p.id) || {}), ...p });
  engine.addPlayer(state.players.get(p.id));
  state.rerender && state.rerender();
}
function showNotice(n) {
  state.notice = n;
  const dismissed = (() => { try { return localStorage.getItem('munin.noticeClosed'); } catch { return null; } })();
  if (!n || String(n.id) === dismissed) { $('#notice').hidden = true; return; }
  $('#noticeText').textContent = n.text; $('#notice').hidden = false;
}
$('#noticeClose').onclick = () => { $('#notice').hidden = true; try { localStorage.setItem('munin.noticeClosed', String(state.notice && state.notice.id)); } catch { /* */ } };

// ---------- data ----------
const init = await initData({
  onPlayer(type, n, o) {
    if (type === 'DELETE') { state.players.delete(o.id); engine.removePlayer(o.id); state.rerender && state.rerender(); }
    else upsertPlayer(n);
  },
  onPost(type, n, o) {
    if (type === 'INSERT') addPost(n);
    else if (type === 'DELETE') removePost(o.id);
    else if (type === 'UPDATE') { const i = state.posts.findIndex((x) => x.id === n.id); if (i >= 0) state.posts[i] = n; }
  },
  onNotice: showNotice,
  onStep(i) { state.step = i; state.rerender && state.rerender(); },
  onOnline(n) { $('#onlineCount').textContent = String(n); },
  onMove: (id, x, z) => engine.remoteMove(id, x, z),
});
$('#demoChip').hidden = !isDemo();
for (const p of init.players) upsertPlayer(p);
state.posts = init.posts;
state.posts.forEach((p) => state.saidPosts.add(p.id));
state.step = init.step;
showNotice(init.notice);
if (me.id && state.players.has(me.id)) { state.me = me.id; engine.setMe(me.id); }
// recent posts appear as bubbles once, staggered
state.posts.slice(-4).forEach((p, i) => setTimeout(() => engine.say(p.player_id, p.text, 6000), 800 + i * 1400));

if (!state.me) setTimeout(() => { if ($('#sheet').hidden) openJoin(); }, 900);
