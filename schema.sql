-- ════════════════════════════════════════════════════════════════
--  Voice-Agent – Supabase Schema (branchenunabhängig / Multi-Vertical)
--  Im Supabase SQL Editor ausführen (Project → SQL Editor → New query)
--
--  Eine Datenbank kann mehrere Branchen (arzt, physio, tierarzt …)
--  bedienen. Branchen-spezifische Felder liegen in calls.details (jsonb),
--  die Kategorie ist freier Text und wird in der App gegen die jeweilige
--  Vertical-Config (verticals/<id>.json) validiert.
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
--  Praxen (Kunden)
-- ──────────────────────────────────────────────
create table if not exists public.practices (
  id            uuid primary key default gen_random_uuid(),
  vertical      text not null default 'arzt',  -- 'arzt' | 'physio' | 'tierarzt' | …
  name          text not null,                 -- "Praxis Dr. Müller"
  phone         text,                          -- Haupt-Festnetznummer der Praxis
  vapi_number   text,                          -- die Nummer, auf die umgeleitet wird
  opening_hours text,                          -- Freitext, für Kontext im Prompt
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ──────────────────────────────────────────────
--  Anrufe / Leads (vom Voice-Agent erfasst)
-- ──────────────────────────────────────────────

-- Dringlichkeit (branchenübergreifend gleich)
do $$ begin
  create type call_urgency as enum ('niedrig', 'mittel', 'hoch', 'notfall');
exception when duplicate_object then null; end $$;

-- Bearbeitungsstatus fürs Personal (branchenübergreifend gleich)
do $$ begin
  create type call_status as enum ('neu', 'in_bearbeitung', 'erledigt');
exception when duplicate_object then null; end $$;

create table if not exists public.calls (
  id                uuid primary key default gen_random_uuid(),
  practice_id       uuid references public.practices(id) on delete cascade,

  -- Universelle, vom Agent extrahierte Felder
  caller_name       text,
  callback_number   text,
  category          text not null default 'sonstiges',  -- gegen Vertical-Config validiert
  reason            text,                                -- Anliegen in eigenen Worten
  urgency           call_urgency not null default 'mittel',

  -- Branchen-spezifische Felder (Schlüssel aus verticals/<id>.json "fields")
  details           jsonb not null default '{}'::jsonb,

  -- Terminwunsch
  appointment_requested  boolean not null default false,
  appointment_preference text,                  -- "morgen Vormittag", "diese Woche nachmittags"

  -- Gespräch
  summary           text,                        -- Kurzzusammenfassung
  transcript        text,                        -- volles Transkript
  recording_url     text,
  vapi_call_id      text unique,                 -- Idempotenz: kein Doppel-Insert

  -- Workflow
  status            call_status not null default 'neu',
  staff_note        text,                        -- Notiz des Personals
  handled_at        timestamptz,

  created_at        timestamptz not null default now()
);

create index if not exists calls_practice_created_idx
  on public.calls (practice_id, created_at desc);
create index if not exists calls_status_idx
  on public.calls (status);

-- ──────────────────────────────────────────────
--  Row Level Security
--  Zugriff läuft ausschließlich über den Server (Service-Role-Key),
--  der RLS umgeht. Anon-Key bekommt bewusst KEINEN Zugriff.
-- ──────────────────────────────────────────────
alter table public.practices enable row level security;
alter table public.calls enable row level security;
-- (keine Policies für anon/authenticated → nur Service-Role kommt rein)

-- ──────────────────────────────────────────────
--  Beispiel-Praxis zum Testen (Vertical an VERTICAL des Deployments anpassen)
-- ──────────────────────────────────────────────
insert into public.practices (vertical, name, phone, vapi_number, opening_hours)
values (
  'arzt',
  'Hausarztpraxis Dr. Müller',
  '+49 30 1234567',
  '+49 30 9999999',
  'Mo-Fr 8-12 und 15-18 Uhr'
)
on conflict do nothing;
