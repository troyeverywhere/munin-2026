// Supabase 연결. 실시간 연결 대신 몇 초마다 get_updates 를 불러서 바뀐 것만 반영합니다.
// (무료 플랜 실시간은 초당 100메시지 한도라 70명이 동시에 쓰면 끊길 수 있음)
// DB 설정 전이면 '미리보기' 모드로 예시 데이터를 보여줍니다.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { randomLook } from './characters.js';

// 신호가 약해 응답이 안 오면 10초 뒤 끊고 다음 시도로 넘어감
const fetchWithTimeout = (url, opts = {}) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10000);
  if (opts.signal) opts.signal.addEventListener('abort', () => ctl.abort());
  return fetch(url, { ...opts, signal: ctl.signal }).finally(() => clearTimeout(t));
};
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false }, global: { fetch: fetchWithTimeout } });

const LS = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); });
}

export const me = {
  token: LS.get('munin.token') || (() => { const t = uuid(); LS.set('munin.token', t); return t; })(),
  id: LS.get('munin.pid'),
};

let mode = 'live';
const H = {};

// what this screen already knows, so each poll only reports changes
const known = { lastPost: 0, since: '1970-01-01T00:00:00Z', posts: new Map(), players: new Map(), picked: new Set(), notice: null, step: -1 };

export const ACTIVE_MS = 10 * 60 * 1000; // 맵에는 10분 안에 접속한 사람만
export const ONLINE_MS = 2 * 60 * 1000;
export const isActive = (p) => !p.last_seen || Date.now() - Date.parse(p.last_seen) < ACTIVE_MS;
export const isOnline = (p) => !!p.last_seen && Date.now() - Date.parse(p.last_seen) < ONLINE_MS;

function demoData() {
  let s = 3; const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const gens = ['08', '11', '12', '13', '13', '15', '16', '17', '18', '19', '21', '22', '24', '교수'];
  const players = gens.map((gen, i) => ({ id: 'demo-' + i, gen, name: '예시', look: { ...randomLook(r), ...(gen === '교수' ? { hair: '#a8a198', glasses: true, shirt: '#2f3b4a', style: 'short' } : {}) } }));
  const lines = ['다들 반가워요!', '졸업하고 처음 와봐요', '08학번 손!', '단체사진 언제 찍어요?', '연희관 그대로네요', '다들 잘 지냈나요?'];
  const posts = lines.map((text, i) => ({ id: -1 - i, player_id: players[(i * 3) % players.length].id, gen: players[(i * 3) % players.length].gen, name: '예시', text, picked: false, created_at: new Date(Date.now() - (lines.length - i) * 60000).toISOString() }));
  return { players, posts, notice: null, step: 0, online: 1 };
}

let rpcMissing = false;
async function fetchUpdates() {
  if (!rpcMissing) {
    const { data, error } = await sb.rpc('get_updates', {
      p_token: me.id ? me.token : null,
      p_after_post: known.lastPost,
      p_players_since: known.since,
    });
    if (!error) return data;
    // setup.sql not re-run yet: fall back to plain table reads with the same shape
    if (!/get_updates|PGRST202|function/i.test(error.message + (error.code || ''))) throw error;
    rpcMissing = true;
  }
  const [pl, po, ids, no, st] = await Promise.all([
    sb.from('players').select('id, gen, name, look, updated_at'),
    sb.from('posts').select('*').gt('id', known.lastPost).order('id').limit(200),
    sb.from('posts').select('id, picked').order('id', { ascending: false }).limit(300),
    sb.from('notices').select('id, text').eq('active', true).order('created_at', { ascending: false }).limit(1),
    sb.from('settings').select('value').eq('key', 'step').maybeSingle(),
  ]);
  if (pl.error) throw pl.error;
  return {
    now: new Date().toISOString(),
    players: pl.data,
    player_ids: pl.data.map((p) => p.id),
    posts: po.data || [],
    post_ids: (ids.data || []).map((x) => x.id),
    picked_ids: (ids.data || []).filter((x) => x.picked).map((x) => x.id),
    notice: no.data && no.data[0] ? no.data[0] : null,
    step: st.data ? st.data.value.index ?? 0 : 0,
    online: pl.data.length,
  };
}

function absorb(d, initial) {
  const out = { players: [], posts: [] };
  known.since = d.now;
  // players: new or changed
  for (const p of d.players) {
    const prev = known.players.get(p.id);
    known.players.set(p.id, p);
    if (initial) out.players.push(p);
    else if (!prev || prev.updated_at !== p.updated_at || prev.last_seen !== p.last_seen) H.onPlayer && H.onPlayer('UPSERT', p);
  }
  // players: deleted
  const ids = new Set(d.player_ids);
  for (const id of [...known.players.keys()]) if (!ids.has(id)) { known.players.delete(id); if (!initial) H.onPlayer && H.onPlayer('DELETE', null, { id }); }
  // posts: new
  const picked = new Set(d.picked_ids);
  for (const p of d.posts) {
    known.lastPost = Math.max(known.lastPost, p.id);
    if (known.posts.has(p.id)) continue;
    known.posts.set(p.id, p);
    if (initial) out.posts.push(p); else H.onPost && H.onPost('INSERT', p);
  }
  // posts: deleted (only judge within the window the server reported)
  const recent = new Set(d.post_ids);
  const floor = d.post_ids.length ? Math.min(...d.post_ids) : Infinity;
  for (const id of [...known.posts.keys()]) {
    if ((id >= floor || !d.post_ids.length) && !recent.has(id)) { known.posts.delete(id); if (!initial) H.onPost && H.onPost('DELETE', null, { id }); }
  }
  // posts: picked flag changes
  for (const [id, p] of known.posts) {
    const v = picked.has(id);
    if (p.picked !== v) { p.picked = v; if (!initial) H.onPost && H.onPost('UPDATE', { ...p }); }
  }
  // notice, step, online
  const nid = d.notice ? d.notice.id : null;
  if (nid !== (known.notice && known.notice.id)) { known.notice = d.notice; if (!initial) H.onNotice && H.onNotice(d.notice); }
  if (d.step !== known.step) { known.step = d.step; if (!initial) H.onStep && H.onStep(d.step); }
  H.onOnline && H.onOnline(d.online);
  return out;
}

let timer = null, fails = 0;
function schedule(ms) {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    if (document.hidden) return schedule(10000);
    try { absorb(await fetchUpdates(), false); fails = 0; H.onConn && H.onConn(true); }
    catch (e) { console.warn('poll failed', e.message); if (++fails >= 2) H.onConn && H.onConn(false); }
    schedule(H.isLive ? 2500 : 3000);
  }, ms);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && mode === 'live') schedule(50); });

export async function initData(handlers) {
  Object.assign(H, handlers);
  let d = null;
  // 행사장 통신이 잠깐 끊겨도 미리보기(가짜 데이터)로 빠지지 않게 몇 번 다시 시도
  for (let k = 0; k < 4 && !d; k++) {
    try { d = await fetchUpdates(); } catch (e) { console.warn('first load failed', k, e.message); await new Promise((r) => setTimeout(r, 700 * (k + 1))); }
  }
  if (!d) {
    if (new URLSearchParams(location.search).has('demo')) { mode = 'demo'; return { mode, ...demoData() }; }
    // 빈 화면으로 시작하고 계속 다시 시도 → 연결되면 사람·소식이 채워짐
    H.onConn && H.onConn(false);
    schedule(2000);
    return { mode, players: [], posts: [], notice: null, step: 0, online: 0 };
  }
  const first = absorb(d, true);
  if (me.id && !known.players.has(me.id)) me.id = null;
  schedule(H.isLive ? 2500 : 3000);
  return { mode, players: first.players, posts: first.posts, notice: d.notice, step: d.step, online: d.online };
}

export function isDemo() { return mode === 'demo'; }
export function refreshSoon() { if (mode === 'live') schedule(300); }

export async function join(gen, name, look) {
  if (mode === 'demo') { me.id = me.id || 'me-demo'; return { id: me.id, gen, name, look }; }
  const { data, error } = await sb.rpc('join_event', { p_token: me.token, p_gen: gen, p_name: name, p_look: look });
  if (error) throw error;
  me.id = data; LS.set('munin.pid', data);
  return { id: data, gen, name, look, last_seen: new Date().toISOString() };
}

export async function post(text) {
  if (mode === 'demo') return { id: -Date.now() };
  const { data, error } = await sb.rpc('post_message', { p_token: me.token, p_text: text });
  if (error) throw error;
  known.lastPost = Math.max(known.lastPost, 0); // the poll will pick it up; caller shows it right away
  return { id: data };
}
export function markKnownPost(p) { known.posts.set(p.id, p); }

export async function deleteMine(id) {
  if (mode === 'demo') return;
  const { error } = await sb.rpc('delete_my_post', { p_token: me.token, p_id: id });
  if (error) throw error;
  known.posts.delete(id);
}

// 다른 사람 화면으로 이동을 보내지 않습니다(메시지 폭주 방지). 다른 캐릭터는 각자 화면에서 알아서 돌아다닙니다.
export function broadcastMove() {}

// admin
export const admin = {
  code: LS.get('munin.admin') || '',
  async check(code) {
    const { data, error } = await sb.rpc('admin_check', { p_code: code });
    if (error) throw error;
    if (data) { this.code = code; LS.set('munin.admin', code); }
    return data;
  },
  notice(text) { return sb.rpc('admin_notice', { p_code: this.code, p_text: text }); },
  step(i) { return sb.rpc('admin_step', { p_code: this.code, p_index: i }); },
  del(id) { return sb.rpc('admin_delete_post', { p_code: this.code, p_id: id }); },
  pick(id, v) { return sb.rpc('admin_pick_post', { p_code: this.code, p_id: id, p_picked: v }); },
  delPlayer(id) { return sb.rpc('admin_delete_player', { p_code: this.code, p_id: id }); },
  reset(all) { return sb.rpc('admin_reset', { p_code: this.code, p_all: all }); },
  updates(after = 0, since = '1970-01-01T00:00:00Z') { return sb.rpc('get_updates', { p_token: null, p_after_post: after, p_players_since: since }); },
};
