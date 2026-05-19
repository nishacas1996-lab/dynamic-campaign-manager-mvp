
create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  temp_c numeric not null,
  condition text not null,
  humidity int not null,
  wind_kph numeric not null,
  updated_at timestamptz not null default now()
);

create table public.line_items (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  creative text not null,
  state text not null check (state in ('active','paused')),
  reason text not null,
  budget_usd numeric not null default 0,
  spend_usd numeric not null default 0,
  impressions int not null default 0,
  ctr numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (city_id, creative)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  line_item_id uuid not null references public.line_items(id) on delete cascade,
  from_state text not null,
  to_state text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.cities enable row level security;
alter table public.line_items enable row level security;
alter table public.audit_log enable row level security;

create policy "public read cities" on public.cities for select using (true);
create policy "public read line_items" on public.line_items for select using (true);
create policy "public read audit_log" on public.audit_log for select using (true);
