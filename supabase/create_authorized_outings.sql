create table if not exists public.authorized_outings (
    id text primary key,
    collaboratorid text not null,
    outing_date date not null,
    reason text not null,
    departure_time time not null,
    notes text null,
    lastupdate timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists idx_authorized_outings_collaboratorid
    on public.authorized_outings (collaboratorid);

create index if not exists idx_authorized_outings_date
    on public.authorized_outings (outing_date);

grant select, insert, update, delete on public.authorized_outings to anon, authenticated;

alter table public.authorized_outings enable row level security;

drop policy if exists "authorized outings select" on public.authorized_outings;
create policy "authorized outings select" on public.authorized_outings for select using (true);

drop policy if exists "authorized outings insert" on public.authorized_outings;
create policy "authorized outings insert" on public.authorized_outings for insert with check (true);

drop policy if exists "authorized outings update" on public.authorized_outings;
create policy "authorized outings update" on public.authorized_outings for update using (true) with check (true);

drop policy if exists "authorized outings delete" on public.authorized_outings;
create policy "authorized outings delete" on public.authorized_outings for delete using (true);
