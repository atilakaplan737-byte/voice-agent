-- ════════════════════════════════════════════════════════════════
--  Terminbuchung – nur Erstgespräche (sicher planbar)
--  Im Supabase SQL Editor ausführen (einmalig).
-- ════════════════════════════════════════════════════════════════

-- ── Verfügbarkeit pro Praxis (feste Wochen-Fenster für Erstgespräche) ──
alter table public.practices
  add column if not exists appt_enabled       boolean not null default false,   -- Buchung an/aus
  add column if not exists appt_slot_minutes   int     not null default 30,       -- Dauer je Erstgespräch
  add column if not exists appt_horizon_days   int     not null default 21,       -- wie weit im Voraus buchbar
  add column if not exists appt_lead_hours     int     not null default 2,        -- Mindestvorlauf
  add column if not exists appt_windows        jsonb   not null default '[]'::jsonb; -- [{ "weekday":2, "start":"09:00", "end":"11:00" }]
--   weekday: 1=Mo, 2=Di, 3=Mi, 4=Do, 5=Fr, 6=Sa, 7=So  (Zeiten = Europe/Berlin)

-- ── Gebuchte Termine ──
create table if not exists public.appointments (
  id              uuid primary key default gen_random_uuid(),
  practice_id     uuid references public.practices(id) on delete cascade,
  starts_at       timestamptz not null,
  duration_min    int not null default 30,
  kind            text not null default 'erstgespraech',
  patient_name    text,
  callback_number text,
  status          text not null default 'gebucht',  -- gebucht | abgesagt
  vapi_call_id    text,
  created_at      timestamptz not null default now(),
  unique (practice_id, starts_at)                    -- verhindert Doppelbuchung
);

create index if not exists appointments_practice_starts_idx
  on public.appointments (practice_id, starts_at);

alter table public.appointments enable row level security;  -- nur Service-Role (wie calls)

-- ── Beispiel-Konfiguration für die Test-Praxis (anpassen) ──
-- update public.practices
--    set appt_enabled = true,
--        appt_slot_minutes = 30,
--        appt_windows = '[{"weekday":2,"start":"09:00","end":"11:00"},
--                         {"weekday":4,"start":"14:00","end":"16:00"}]'::jsonb
--  where name = 'Hausarztpraxis Dr. Müller';
