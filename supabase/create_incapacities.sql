create table if not exists public.incapacities (
    id text primary key,
    collaboratorid text not null,
    start_date date not null,
    end_date date not null,
    type text not null default 'full_day',
    notes text null,
    lastupdate timestamptz not null default now(),
    created_at timestamptz not null default now(),
    constraint incapacities_dates_valid check (end_date >= start_date),
    constraint incapacities_type_full_day check (type = 'full_day')
);

create index if not exists idx_incapacities_collaboratorid
    on public.incapacities (collaboratorid);

create index if not exists idx_incapacities_start_date
    on public.incapacities (start_date);

create index if not exists idx_incapacities_end_date
    on public.incapacities (end_date);

grant select, insert, update, delete on public.incapacities to anon, authenticated;

alter table public.incapacities enable row level security;

drop policy if exists "incapacities select" on public.incapacities;
create policy "incapacities select" on public.incapacities for select using (true);

drop policy if exists "incapacities insert" on public.incapacities;
create policy "incapacities insert" on public.incapacities for insert with check (true);

drop policy if exists "incapacities update" on public.incapacities;
create policy "incapacities update" on public.incapacities for update using (true) with check (true);

drop policy if exists "incapacities delete" on public.incapacities;
create policy "incapacities delete" on public.incapacities for delete using (true);
