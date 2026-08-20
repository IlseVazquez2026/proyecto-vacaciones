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

-- Si tu proyecto usa RLS, ajusta estas políticas para el mismo patrón que
-- ya tengan tus otras tablas. Déjalo así solo si ya manejas acceso por otro medio.
