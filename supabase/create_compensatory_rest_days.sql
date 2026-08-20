-- Tabla para descansos compensatorios
-- Ejecutar en el SQL Editor de Supabase

create table if not exists public.compensatory_rest_days (
    id text primary key,
    collaboratorid text not null,
    event_date date not null,
    reason text not null,
    rest_date date not null,
    rest_type text not null default 'full_day',
    start_time time null,
    end_time time null,
    total_hours text null,
    status text not null default 'programmed',
    notes text null,
    lastupdate timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists idx_comp_rest_collaboratorid
    on public.compensatory_rest_days (collaboratorid);

create index if not exists idx_comp_rest_rest_date
    on public.compensatory_rest_days (rest_date);

create index if not exists idx_comp_rest_status
    on public.compensatory_rest_days (status);

create index if not exists idx_comp_rest_event_date
    on public.compensatory_rest_days (event_date);

-- Permisos para que la app web (anon/authenticated) pueda leer y escribir.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.compensatory_rest_days to anon, authenticated;

-- Si RLS está habilitado, estas policies permiten acceso total a la tabla.
alter table public.compensatory_rest_days enable row level security;

drop policy if exists "comp rest select" on public.compensatory_rest_days;
create policy "comp rest select"
on public.compensatory_rest_days
for select
using (true);

drop policy if exists "comp rest insert" on public.compensatory_rest_days;
create policy "comp rest insert"
on public.compensatory_rest_days
for insert
with check (true);

drop policy if exists "comp rest update" on public.compensatory_rest_days;
create policy "comp rest update"
on public.compensatory_rest_days
for update
using (true)
with check (true);

drop policy if exists "comp rest delete" on public.compensatory_rest_days;
create policy "comp rest delete"
on public.compensatory_rest_days
for delete
using (true);
