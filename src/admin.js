// 운영진 화면
import { sb, admin } from './data.js';
import { PROGRAM } from './content.js';

const $ = (s) => document.querySelector(s);
const genLabel = (g) => (g === '교수' ? '교수님' : g === '게스트' ? '게스트' : `${g}학번`);
let step = 0, posts = [];

function msg(t) { $('#loginMsg').textContent = t; }
async function enter(code) {
  try {
    const ok = await admin.check(code);
    if (!ok) return msg('코드가 맞지 않아요.');
    $('#login').hidden = true; $('#panel').hidden = false;
    load();
  } catch (e) {
    msg(e.message && e.message.includes('admin_check') ? 'DB 설정(setup.sql)을 먼저 실행해 주세요.' : '확인하지 못했어요: ' + e.message);
  }
}
$('#enter').onclick = () => enter($('#code').value.trim());
$('#code').onkeydown = (e) => { if (e.key === 'Enter') enter($('#code').value.trim()); };
if (admin.code) enter(admin.code);

function renderSteps() {
  $('#steps').replaceChildren(...PROGRAM.map((p, i) => {
    const b = document.createElement('button'); b.type = 'button';
    b.className = i === step ? 'on' : '';
    b.textContent = `${p.time}  ${p.title}`;
    b.onclick = async () => { const { error } = await admin.step(i); if (!error) { step = i; renderSteps(); } };
    return b;
  }));
}
function renderPosts() {
  $('#pcount').textContent = `${posts.length}개`;
  $('#plist').replaceChildren(...[...posts].reverse().map((p) => {
    const row = document.createElement('div'); row.className = 'prow';
    const tx = document.createElement('div'); tx.className = 'tx';
    const sm = document.createElement('small'); sm.textContent = `${genLabel(p.gen)} ${p.name}`;
    tx.append(sm, document.createTextNode(p.text));
    const pick = document.createElement('button'); pick.type = 'button'; pick.className = 'mini' + (p.picked ? ' on' : '');
    pick.textContent = p.picked ? '읽을 소식 ✓' : '읽을 소식';
    pick.onclick = async () => { await admin.pick(p.id, !p.picked); load(); };
    const del = twoStep(document.createElement('button'), '삭제', '정말 삭제', async () => { await admin.del(p.id); load(); });
    del.className = 'mini danger';
    row.append(tx, pick, del);
    return row;
  }));
}
function twoStep(btn, label, confirmLabel, fn) {
  btn.type = 'button'; btn.textContent = label;
  let armed = false, t;
  btn.onclick = async () => {
    if (!armed) { armed = true; btn.textContent = confirmLabel; t = setTimeout(() => { armed = false; btn.textContent = label; }, 3000); return; }
    clearTimeout(t); armed = false; btn.textContent = label; await fn();
  };
  return btn;
}

let players = [];
async function load() {
  const [po, no, st, pl] = await Promise.all([
    sb.from('posts').select('*').order('created_at').limit(500),
    sb.from('notices').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1),
    sb.from('settings').select('*').eq('key', 'step').maybeSingle(),
    sb.from('players').select('*').order('created_at'),
  ]);
  const sig = JSON.stringify([(po.data || []).map((p) => [p.id, p.picked]), (pl.data || []).map((p) => [p.id, p.last_seen])]);
  posts = po.data || [];
  players = pl.data || [];
  step = st.data ? st.data.value.index ?? 0 : 0;
  showNotice(no.data && no.data[0]);
  if (sig !== load.sig) { load.sig = sig; renderPosts(); renderPlayers(); }
  renderSteps();
  clearTimeout(load.t); load.t = setTimeout(load, 3000);
}
function renderPlayers() {
  const now = Date.now();
  const on = players.filter((p) => p.last_seen && now - Date.parse(p.last_seen) < 2 * 60 * 1000).length;
  $('#plcount').textContent = `${players.length}명 · 지금 접속 ${on}명`;
  $('#players').replaceChildren(...players.map((p) => {
    const row = document.createElement('div'); row.className = 'prow';
    const tx = document.createElement('div'); tx.className = 'tx';
    const sm = document.createElement('small');
    const seen = p.last_seen ? new Date(p.last_seen).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
    sm.textContent = seen ? `마지막 접속 ${seen}` : '';
    tx.append(document.createTextNode(`${genLabel(p.gen)} ${p.name}`), sm);
    const del = twoStep(document.createElement('button'), '삭제', '정말 삭제', async () => { await admin.delPlayer(p.id); load(); });
    del.className = 'mini danger';
    row.append(tx, del);
    return row;
  }));
}
function showNotice(n) { $('#noticeNow').textContent = n ? `지금 떠 있는 공지: ${n.text}` : '지금 떠 있는 공지가 없어요.'; }
$('#noticeOn').onclick = async () => { const v = $('#noticeIn').value.trim(); if (!v) return; const { error } = await admin.notice(v); if (!error) { $('#noticeIn').value = ''; load(); } };
$('#noticeOff').onclick = async () => { await admin.notice(''); load(); };
twoStep($('#resetPosts'), '소식·공지만 지우기', '한 번 더 누르면 지워요', async () => { await admin.reset(false); load(); });
twoStep($('#resetAll'), '참석자까지 모두 지우기', '한 번 더 누르면 모두 지워요', async () => { await admin.reset(true); load(); });
