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
    pick.onclick = async () => { await admin.pick(p.id, !p.picked); };
    const del = twoStep(document.createElement('button'), '삭제', '정말 삭제', async () => { await admin.del(p.id); });
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

async function load() {
  const [po, no, st] = await Promise.all([
    sb.from('posts').select('*').order('created_at').limit(500),
    sb.from('notices').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1),
    sb.from('settings').select('*').eq('key', 'step').maybeSingle(),
  ]);
  posts = po.data || [];
  step = st.data ? st.data.value.index ?? 0 : 0;
  showNotice(no.data && no.data[0]);
  renderSteps(); renderPosts();
  sb.channel('admin')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (p) => {
      if (p.eventType === 'INSERT') posts.push(p.new);
      else if (p.eventType === 'DELETE') posts = posts.filter((x) => x.id !== p.old.id);
      else posts = posts.map((x) => (x.id === p.new.id ? p.new : x));
      renderPosts();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, async () => {
      const { data } = await sb.from('notices').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1);
      showNotice(data && data[0]);
    })
    .subscribe();
}
function showNotice(n) { $('#noticeNow').textContent = n ? `지금 떠 있는 공지: ${n.text}` : '지금 떠 있는 공지가 없어요.'; }
$('#noticeOn').onclick = async () => { const v = $('#noticeIn').value.trim(); if (!v) return; const { error } = await admin.notice(v); if (!error) $('#noticeIn').value = ''; };
$('#noticeOff').onclick = () => admin.notice('');
twoStep($('#resetPosts'), '소식·공지만 지우기', '한 번 더 누르면 지워요', async () => { await admin.reset(false); posts = []; renderPosts(); });
twoStep($('#resetAll'), '참석자까지 모두 지우기', '한 번 더 누르면 모두 지워요', async () => { await admin.reset(true); posts = []; renderPosts(); });
