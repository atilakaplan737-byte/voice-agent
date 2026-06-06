-- ════════════════════════════════════════════════════════════════
--  Multi-Tenant: eigener Dashboard-Schlüssel pro Praxis
--  Im Supabase SQL Editor ausführen (einmalig).
--
--  Jede Praxis bekommt einen eigenen Schlüssel und sieht damit NUR ihre
--  eigenen Anrufe. Der globale DASHBOARD_API_KEY (Env) bleibt Master/Admin
--  und sieht weiterhin alles.
-- ════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- Spalte für den Praxis-Schlüssel (auto-generiert, eindeutig)
alter table public.practices
  add column if not exists dashboard_key text unique
  default encode(gen_random_bytes(16), 'hex');

-- Bestehende Praxen ohne Schlüssel nachträglich befüllen
update public.practices
   set dashboard_key = encode(gen_random_bytes(16), 'hex')
 where dashboard_key is null;

-- Schnell-Lookup beim Login
create index if not exists practices_dashboard_key_idx
  on public.practices (dashboard_key);

-- → Schlüssel der Praxen anzeigen (zum Aushändigen ans Personal):
--   select name, dashboard_key from public.practices order by name;
