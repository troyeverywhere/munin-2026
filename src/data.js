// Supabase 연결. DB 설정 전이면 '미리보기' 모드로 예시 데이터를 보여줍니다.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { randomLook } from './characters.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 8 } } });

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
  viewer: uuid(),
};

let mode = 'live';
let channel = null;
const H = {};

function demoData() {
  let s = 3; const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const gens = ['08', '11', '12', '13', '13', '15', '16', '17', '18', '19', '21', '22', '24', '교수'];
  const players = gens.map((gen, i) => ({ id: 'demo-' + i, gen, name: '예시', look: { ...randomLook(r), ...(gen === '교수' ? { hair: '#a8a198', glasses: true, shirt: '#2f3b4a', style: 'short' } : {}) } }));
  const lines = ['다들 반가워요!', '졸업하고 처음 와봐요', '08학번 손!', '단체사진 언제 찍어요?', '연희관 그대로네요', '다들 잘 지냈나요?'];
  const posts = lines.map((text, i) => ({ id: -1 - i, player_id: players[(i * 3) % players.length].id, gen: players[(i * 3) % players.length].gen, name: '예시', text, picked: false, created_at: new Date(Date.now() - (lines.length - i) * 60000).toISOString() }));
  return { players, posts, notice: null, step: 0 };
}

export async function initData(handlers) {
  Object.assign(H, handlers);
  const [pl, po, no, st] = await Promise.all([
    sb.from('players').select('id, gen, name, look, created_at').order('created_at'),
    sb.from('posts').select('*').order('created_at', { ascending: false }).limit(150),
    sb.from('notices').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1),
    sb.from('settings').select('*').eq('key', 'step').maybeSingle(),
  ]);
  if (pl.error) {
    console.warn('DB not ready, preview mode:', pl.error.message);
    mode = 'demo';
    const d = demoData();
    setupPresence();
    return { mode, ...d };
  }
  if (me.id && !pl.data.find((p) => p.id === me.id)) { me.id = null; }
  subscribe();
  setupPresence();
  return {
    mode,
    players: pl.data,
    posts: (po.data || []).reverse(),
    notice: no.data && no.data[0] ? no.data[0] : null,
    step: st.data ? st.data.value.index ?? 0 : 0,
  };
}

function subscribe() {
  sb.channel('db')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, (p) => H.onPlayer && H.onPlayer(p.eventType, p.new, p.old))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (p) => H.onPost && H.onPost(p.eventType, p.new, p.old))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, async () => {
      const { data } = await sb.from('notices').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1);
      H.onNotice && H.onNotice(data && data[0] ? data[0] : null);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (p) => {
      if (p.new && p.new.key === 'step') H.onStep && H.onStep(p.new.value.index ?? 0);
    })
    .subscribe();
}

function setupPresence() {
  channel = sb.channel('room', { config: { presence: { key: me.viewer }, broadcast: { self: false } } });
  channel
    .on('presence', { event: 'sync' }, () => {
      const st = channel.presenceState();
      const ids = new Set();
      let viewers = 0;
      for (const k of Object.keys(st)) {
        const metas = st[k];
        if (metas.some((m) => !m.live)) viewers++;
        for (const m of metas) if (m.pid) ids.add(m.pid);
      }
      H.onOnline && H.onOnline(viewers, ids);
    })
    .on('broadcast', { event: 'move' }, ({ payload }) => H.onMove && H.onMove(payload.id, payload.x, payload.z))
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await channel.track({ pid: me.id || null, live: !!H.isLive });
    });
}

export function isDemo() { return mode === 'demo'; }

export async function join(gen, name, look) {
  if (mode === 'demo') {
    me.id = me.id || 'me-demo';
    return { id: me.id, gen, name, look };
  }
  const { data, error } = await sb.rpc('join_event', { p_token: me.token, p_gen: gen, p_name: name, p_look: look });
  if (error) throw error;
  me.id = data; LS.set('munin.pid', data);
  if (channel) channel.track({ pid: me.id, live: false });
  return { id: data, gen, name, look };
}

export async function post(text) {
  if (mode === 'demo') return { id: -Date.now() };
  const { data, error } = await sb.rpc('post_message', { p_token: me.token, p_text: text });
  if (error) throw error;
  return { id: data };
}

export async function deleteMine(id) {
  if (mode === 'demo') return;
  const { error } = await sb.rpc('delete_my_post', { p_token: me.token, p_id: id });
  if (error) throw error;
}

let lastMove = 0;
export function broadcastMove(x, z) {
  const now = performance.now();
  if (!channel || !me.id || now - lastMove < 120) return;
  lastMove = now;
  channel.send({ type: 'broadcast', event: 'move', payload: { id: me.id, x: +x.toFixed(2), z: +z.toFixed(2) } });
}

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
  reset(all) { return sb.rpc('admin_reset', { p_code: this.code, p_all: all }); },
};
