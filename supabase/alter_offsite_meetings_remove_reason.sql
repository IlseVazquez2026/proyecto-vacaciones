-- El motivo ya no se solicita al registrar juntas.
-- Se conserva la columna para no perder datos históricos, pero ahora es opcional.
alter table public.offsite_meetings
    alter column reason drop not null;
