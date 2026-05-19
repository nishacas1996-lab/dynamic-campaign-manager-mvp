
drop table if exists public.audit_log cascade;
drop table if exists public.line_items cascade;
drop table if exists public.cities cascade;
drop table if exists public.transition_logs cascade;
drop table if exists public.weather_cache cascade;

create table public.line_items (
  id bigserial primary key,
  creative_id text not null,
  city text not null,
  state text not null default 'paused',
  bid double precision not null,
  daily_budget double precision not null,
  updated_at timestamptz not null default now()
);

create table public.transition_logs (
  id bigserial primary key,
  line_item_id bigint not null references public.line_items(id) on delete cascade,
  from_state text not null,
  to_state text not null,
  reason text not null,
  weather_snap jsonb,
  triggered_at timestamptz not null default now()
);

create table public.weather_cache (
  id bigserial primary key,
  city text not null unique,
  temp_c double precision not null,
  precip_mm double precision not null,
  condition text not null,
  fetched_at timestamptz not null default now()
);

alter table public.line_items enable row level security;
alter table public.transition_logs enable row level security;
alter table public.weather_cache enable row level security;

create policy "public read line_items" on public.line_items for select using (true);
create policy "public read transition_logs" on public.transition_logs for select using (true);
create policy "public read weather_cache" on public.weather_cache for select using (true);
