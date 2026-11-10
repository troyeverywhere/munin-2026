-- =====================================================================
--  2026 문인 동문회 행사 사이트 · Supabase 설정
--
--  사용법: Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를
--  붙여 넣고 Run 을 누릅니다. 여러 번 실행해도 안전합니다.
--
--  실행 전에 맨 아래 "운영진 코드" 줄의 따옴표 안을 원하는 코드로 바꾸세요.
--  (운영진 화면 admin.html 에서 이 코드를 입력해야 공지·삭제가 됩니다.)
--
--  구조 요약
--  - 누구나 읽기만 할 수 있고, 쓰기는 모두 아래 함수(RPC)로만 합니다.
--  - 참여자는 폰에 저장된 비밀 토큰으로 자기 캐릭터·글만 고칠 수 있습니다.
--  - 이름·학번은 서버가 캐릭터 정보에서 채워 넣으므로 남인 척 글을 쓸 수 없습니다.
-- =====================================================================

create schema if not exists private;

-- 1) 참여자(캐릭터) -----------------------------------------------------
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  gen text not null check (gen ~ '^([0-9]{2}|교수|게스트)$'),
  name text not null check (char_length(name) between 1 and 12),
  look jsonb not null default '{}'::jsonb check (pg_column_size(look) < 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.player_tokens (
  player_id uuid primary key references public.players(id) on delete cascade,
  token uuid not null unique
);

-- 2) 소식 -----------------------------------------------------------------
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  player_id uuid references public.players(id) on delete cascade,
  gen text not null,
  name text not null,
  text text not null check (char_length(text) between 1 and 120),
  picked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists posts_created_idx on public.posts (created_at desc);

-- 3) 공지 -----------------------------------------------------------------
create table if not exists public.notices (
  id bigint generated always as identity primary key,
  text text not null check (char_length(text) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 4) 설정 (지금 진행 중인 식순 순서 등) -------------------------------------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.settings(key, value) values ('step', '{"index": 0}') on conflict do nothing;

-- 5) 운영진 코드 보관 ------------------------------------------------------
create table if not exists private.admin_code (code text primary key);

-- 6) 읽기 권한 -------------------------------------------------------------
alter table public.players  enable row level security;
alter table public.posts    enable row level security;
alter table public.notices  enable row level security;
alter table public.settings enable row level security;

drop policy if exists "players: read" on public.players;
drop policy if exists "posts: read" on public.posts;
drop policy if exists "notices: read" on public.notices;
drop policy if exists "settings: read" on public.settings;
create policy "players: read"  on public.players  for select to anon, authenticated using (true);
create policy "posts: read"    on public.posts    for select to anon, authenticated using (true);
create policy "notices: read"  on public.notices  for select to anon, authenticated using (true);
create policy "settings: read" on public.settings for select to anon, authenticated using (true);

revoke insert, update, delete on public.players, public.posts, public.notices, public.settings from anon, authenticated;
grant select on public.players, public.posts, public.notices, public.settings to anon, authenticated;
revoke all on schema private from anon, authenticated;

-- 7) 참여자 함수 -----------------------------------------------------------
-- 입장 또는 캐릭터 수정. 같은 토큰이면 수정, 처음이면 새로 만듭니다.
create or replace function public.join_event(p_token uuid, p_gen text, p_name text, p_look jsonb)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare pid uuid;
begin
  select player_id into pid from private.player_tokens where token = p_token;
  if pid is null then
    insert into public.players(gen, name, look) values (p_gen, btrim(p_name), coalesce(p_look, '{}'::jsonb)) returning id into pid;
    insert into private.player_tokens(player_id, token) values (pid, p_token);
  else
    update public.players set gen = p_gen, name = btrim(p_name), look = coalesce(p_look, look), updated_at = now() where id = pid;
  end if;
  return pid;
end $$;

-- 소식 남기기 (같은 사람은 4초에 한 번까지)
create or replace function public.post_message(p_token uuid, p_text text)
returns bigint language plpgsql security definer set search_path = public, private as $$
declare p record; new_id bigint;
begin
  select pl.* into p from public.players pl join private.player_tokens t on t.player_id = pl.id where t.token = p_token;
  if p is null then raise exception 'not joined'; end if;
  if exists (select 1 from public.posts where player_id = p.id and created_at > now() - interval '4 seconds') then
    raise exception 'too fast';
  end if;
  insert into public.posts(player_id, gen, name, text) values (p.id, p.gen, p.name, btrim(p_text)) returning id into new_id;
  return new_id;
end $$;

-- 내 소식 지우기
create or replace function public.delete_my_post(p_token uuid, p_id bigint)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  delete from public.posts
  where id = p_id and player_id = (select player_id from private.player_tokens where token = p_token);
end $$;

-- 8) 운영진 함수 (운영진 코드가 맞을 때만) -----------------------------------
create or replace function public.admin_check(p_code text)
returns boolean language sql security definer set search_path = private as $$
  -- 예시 코드를 그대로 두면 운영진 기능이 열리지 않습니다.
  select exists (select 1 from private.admin_code where code = p_code and code <> '여기에-운영진-코드');
$$;

create or replace function public.admin_notice(p_code text, p_text text)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not public.admin_check(p_code) then raise exception 'wrong code'; end if;
  update public.notices set active = false where active;
  if coalesce(btrim(p_text), '') <> '' then
    insert into public.notices(text) values (btrim(p_text));
  end if;
end $$;

create or replace function public.admin_step(p_code text, p_index int)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not public.admin_check(p_code) then raise exception 'wrong code'; end if;
  insert into public.settings(key, value, updated_at) values ('step', jsonb_build_object('index', p_index), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

create or replace function public.admin_delete_post(p_code text, p_id bigint)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not public.admin_check(p_code) then raise exception 'wrong code'; end if;
  delete from public.posts where id = p_id;
end $$;

create or replace function public.admin_pick_post(p_code text, p_id bigint, p_picked boolean)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not public.admin_check(p_code) then raise exception 'wrong code'; end if;
  update public.posts set picked = p_picked where id = p_id;
end $$;

-- 초기화: p_all = false 면 소식·공지만, true 면 참여자까지 모두 지웁니다.
create or replace function public.admin_reset(p_code text, p_all boolean default false)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not public.admin_check(p_code) then raise exception 'wrong code'; end if;
  delete from public.posts where true;
  delete from public.notices where true;
  if p_all then delete from public.players where true; end if;
end $$;

revoke all on function public.join_event(uuid, text, text, jsonb) from public;
revoke all on function public.post_message(uuid, text) from public;
revoke all on function public.delete_my_post(uuid, bigint) from public;
revoke all on function public.admin_check(text) from public;
revoke all on function public.admin_notice(text, text) from public;
revoke all on function public.admin_step(text, int) from public;
revoke all on function public.admin_delete_post(text, bigint) from public;
revoke all on function public.admin_pick_post(text, bigint, boolean) from public;
revoke all on function public.admin_reset(text, boolean) from public;
grant execute on function public.join_event(uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.post_message(uuid, text) to anon, authenticated;
grant execute on function public.delete_my_post(uuid, bigint) to anon, authenticated;
grant execute on function public.admin_check(text) to anon, authenticated;
grant execute on function public.admin_notice(text, text) to anon, authenticated;
grant execute on function public.admin_step(text, int) to anon, authenticated;
grant execute on function public.admin_delete_post(text, bigint) to anon, authenticated;
grant execute on function public.admin_pick_post(text, bigint, boolean) to anon, authenticated;
grant execute on function public.admin_reset(text, boolean) to anon, authenticated;

-- 9) 실시간 반영 -----------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['players', 'posts', 'notices', 'settings'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- 10) 운영진 코드: 따옴표 안을 원하는 코드로 바꾼 뒤 실행하세요 -------------------
--     (이미 실행했다면 delete from private.admin_code; 후 다시 넣으면 바뀝니다.)
insert into private.admin_code(code) values ('여기에-운영진-코드') on conflict do nothing;
