-- LoreKeep online play. Paste this whole file into Supabase → SQL Editor → Run. Safe to run again.
-- Uses its own lk_ tables, so it never touches the old Combat Control tables.

-- ---------- tables ----------
create table if not exists public.lk_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our campaign',
  code text not null unique,
  dm_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.lk_members (
  campaign_id uuid not null references public.lk_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'player' check (role in ('dm', 'player')),
  display_name text not null default '',
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

-- Everything in a campaign is a JSON document: col = 'table' (battle, town, notes…) or chars / chests / wiki / trades / seats.
create table if not exists public.lk_docs (
  campaign_id uuid not null references public.lk_campaigns(id) on delete cascade,
  col text not null,
  id text not null,
  data jsonb not null,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, col, id)
);
create index if not exists lk_docs_campaign on public.lk_docs (campaign_id);

-- ---------- helpers ----------
create or replace function public.lk_is_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from lk_members where campaign_id = c and user_id = auth.uid())
$$;
create or replace function public.lk_is_dm(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from lk_members where campaign_id = c and user_id = auth.uid() and role = 'dm')
$$;

-- ---------- row-level security ----------
alter table public.lk_campaigns enable row level security;
alter table public.lk_members enable row level security;
alter table public.lk_docs enable row level security;

drop policy if exists lk_c_sel on public.lk_campaigns;
create policy lk_c_sel on public.lk_campaigns for select to authenticated using (public.lk_is_member(id));
drop policy if exists lk_c_upd on public.lk_campaigns;
create policy lk_c_upd on public.lk_campaigns for update to authenticated using (dm_id = auth.uid()) with check (dm_id = auth.uid());
drop policy if exists lk_c_del on public.lk_campaigns;
create policy lk_c_del on public.lk_campaigns for delete to authenticated using (dm_id = auth.uid());

drop policy if exists lk_m_sel on public.lk_members;
create policy lk_m_sel on public.lk_members for select to authenticated using (public.lk_is_member(campaign_id));
drop policy if exists lk_m_del on public.lk_members;
create policy lk_m_del on public.lk_members for delete to authenticated using (user_id = auth.uid() or public.lk_is_dm(campaign_id));

-- Members of a campaign read and write its documents (the app decides who sees which buttons).
drop policy if exists lk_d_sel on public.lk_docs;
create policy lk_d_sel on public.lk_docs for select to authenticated using (public.lk_is_member(campaign_id));
drop policy if exists lk_d_ins on public.lk_docs;
create policy lk_d_ins on public.lk_docs for insert to authenticated with check (public.lk_is_member(campaign_id));
drop policy if exists lk_d_upd on public.lk_docs;
create policy lk_d_upd on public.lk_docs for update to authenticated using (public.lk_is_member(campaign_id)) with check (public.lk_is_member(campaign_id));
drop policy if exists lk_d_del on public.lk_docs;
create policy lk_d_del on public.lk_docs for delete to authenticated using (public.lk_is_member(campaign_id));

-- ---------- actions ----------
-- Start a campaign: you become its DM. Returns the campaign row (with its 6-letter join code).
create or replace function public.lk_create_campaign(p_name text, p_display_name text)
returns public.lk_campaigns language plpgsql security definer set search_path = public as $$
declare c lk_campaigns; new_code text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  loop
    new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when length(new_code) = 6 and not exists (select 1 from lk_campaigns where code = new_code);
  end loop;
  insert into lk_campaigns (name, code, dm_id) values (coalesce(nullif(trim(p_name), ''), 'Our campaign'), new_code, auth.uid()) returning * into c;
  insert into lk_members (campaign_id, user_id, role, display_name) values (c.id, auth.uid(), 'dm', coalesce(trim(p_display_name), ''));
  return c;
end $$;

-- Join with a code. Joining again just updates your name (the DM keeps the DM role).
create or replace function public.lk_join_campaign(p_code text, p_display_name text)
returns public.lk_campaigns language plpgsql security definer set search_path = public as $$
declare c lk_campaigns;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into c from lk_campaigns where code = upper(trim(p_code));
  if c.id is null then raise exception 'No campaign has that code'; end if;
  insert into lk_members (campaign_id, user_id, role, display_name) values (c.id, auth.uid(), 'player', coalesce(trim(p_display_name), ''))
  on conflict (campaign_id, user_id) do update set display_name = excluded.display_name;
  return c;
end $$;

-- Delete my account and everything I own (required for app stores). Campaigns I run go with it.
create or replace function public.lk_delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.lk_create_campaign(text, text) from public, anon;
revoke all on function public.lk_join_campaign(text, text) from public, anon;
revoke all on function public.lk_delete_my_account() from public, anon;
grant execute on function public.lk_create_campaign(text, text) to authenticated;
grant execute on function public.lk_join_campaign(text, text) to authenticated;
grant execute on function public.lk_delete_my_account() to authenticated;
grant select, insert, update, delete on public.lk_docs to authenticated;
grant select, delete on public.lk_members to authenticated;
grant select, update, delete on public.lk_campaigns to authenticated;

-- ---------- live updates ----------
alter table public.lk_docs replica identity full;
do $$ begin
  begin alter publication supabase_realtime add table public.lk_docs; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.lk_members; exception when duplicate_object then null; end;
end $$;
