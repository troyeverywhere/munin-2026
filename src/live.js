// 빔 큰 화면: 맵 전체 + QR + 참여 인원 + 공지 + 최근 소식
import QRCode from 'qrcode';
import { createEngine } from './engine.js';
import { initData } from './data.js';
import { PROGRAM } from './content.js';

const $ = (s) => document.querySelector(s);
const genLabel = (g) => (g === '교수' ? '교수님' : g === '게스트' ? '게스트' : `${g}학번`);

await (document.fonts ? Promise.race([document.fonts.load('800 20px "Pretendard Variable"'), new Promise((r) => setTimeout(r, 1500))]) : null);
const engine = createEngine($('#stage'), { view: 'live' });

const joinUrl = new URL('./', location.href).href;
$('#qr').src = await QRCode.toDataURL(joinUrl, { margin: 1, width: 440, color: { dark: '#3b2a1e', light: '#fffaf2' } });

const players = new Map();
let posts = [];
let lastPostAt = Date.now();
function feed() {
  const picked = posts.filter((p) => p.picked).slice(-2);
  const recent = posts.filter((p) => !p.picked).slice(-3 + picked.length);
  const items = [...picked, ...recent].slice(-3);
  $('#feed').replaceChildren(...items.map((p) => {
    const d = document.createElement('div'); d.className = 'item' + (p.picked ? ' picked' : '');
    const w = document.createElement('div'); w.className = 'who'; w.textContent = `${genLabel(p.gen)} ${p.name}`;
    const t = document.createElement('div'); t.className = 'tx'; t.textContent = p.text;
    d.append(w, t); return d;
  }));
}
function step(i) {
  const p = PROGRAM[i];
  $('#step').hidden = !p;
  if (p) $('#step').textContent = `지금 · ${p.title}`;
}
function notice(n) {
  $('#notice').hidden = !n;
  if (n) $('#noticeText').textContent = n.text;
}

const init = await initData({
  isLive: true,
  onPlayer(type, n, o) {
    if (type === 'DELETE') { players.delete(o.id); engine.removePlayer(o.id); }
    else { players.set(n.id, n); engine.addPlayer(n); }
  },
  onPost(type, n, o) {
    if (type === 'INSERT') { posts.push(n); engine.say(n.player_id, n.text, 10000); lastPostAt = Date.now(); }
    else if (type === 'DELETE') posts = posts.filter((p) => p.id !== o.id);
    else if (type === 'UPDATE') posts = posts.map((p) => (p.id === n.id ? n : p));
    feed();
  },
  onNotice: notice,
  onStep: step,
  onOnline(n) { $('#count').textContent = String(n); },
  onMove: (id, x, z) => engine.remoteMove(id, x, z),
});
for (const p of init.players) { players.set(p.id, p); engine.addPlayer(p); }
posts = init.posts;
feed(); step(init.step); notice(init.notice);
// keep the map lively: replay a recent post now and then when it is quiet
setInterval(() => {
  if (!posts.length || Date.now() - lastPostAt < 15000) return;
  const p = posts[Math.floor(Math.random() * Math.min(posts.length, 20)) + Math.max(0, posts.length - 20)] || posts[posts.length - 1];
  if (p) engine.say(p.player_id, p.text, 7000);
  lastPostAt = Date.now() - 6000;
}, 4000);
