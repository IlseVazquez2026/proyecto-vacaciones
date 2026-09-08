-- Script completo para instalaciones donde la tabla todavía no existe.
-- El motivo se conserva por compatibilidad histórica, pero es opcional.
create table if not exists public.offsite_meetings (
    id text primary key,
    collaboratorid text not null,
    meeting_date date not null,
    reason text null,
    start_time time not null,
    end_time time not null,
    total_hours text not null,
    notes text null,
    lastupdate timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists idx_offsite_meetings_collaboratorid
    on public.offsite_meetings (collaboratorid);

create index if not exists idx_offsite_meetings_date
    on public.offsite_meetings (meeting_date);

grant select, insert, update, delete on public.offsite_meetings to anon, authenticated;

alter table public.offsite_meetings enable row level security;

drop policy if exists "offsite meetings select" on public.offsite_meetings;
create policy "offsite meetings select" on public.offsite_meetings for select using (true);

drop policy if exists "offsite meetings insert" on public.offsite_meetings;
create policy "offsite meetings insert" on public.offsite_meetings for insert with check (true);

drop policy if exists "offsite meetings update" on public.offsite_meetings;
create policy "offsite meetings update" on public.offsite_meetings for update using (true) with check (true);

drop policy if exists "offsite meetings delete" on public.offsite_meetings;
create policy "offsite meetings delete" on public.offsite_meetings for delete using (true);

-- Compatible con una tabla creada anteriormente con reason NOT NULL.
alter table public.offsite_meetings
    alter column reason drop not null;
