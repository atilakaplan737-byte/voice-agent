-- ════════════════════════════════════════════════════════════════
--  Löschkonzept / Speicherbegrenzung (Art. 5 DSGVO) – automatischer Job
--  Im Supabase SQL Editor ausführen (einmalig). Läuft danach täglich.
--
--  Politik (an Löschkonzept Dok. 08 angelehnt – Fristen bei Bedarf anpassen):
--   • nach 30 Tagen: sensibelste Inhalte (Transkript, ggf. Audio-Link) entfernen
--   • nach 90 Tagen: den Anruf-Eintrag vollständig löschen
-- ════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;

-- Aufräum-Funktion
create or replace function public.purge_old_calls()
returns void
language sql
security definer
set search_path = public
as $$
  -- 1) nach 30 Tagen: Freitext/Audio entfernen (Personenbezug stark reduzieren)
  update public.calls
     set transcript = null,
         recording_url = null
   where created_at < now() - interval '30 days'
     and (transcript is not null or recording_url is not null);

  -- 2) nach 90 Tagen: Eintrag ganz löschen
  delete from public.calls
   where created_at < now() - interval '90 days';
$$;

-- Täglichen Job einrichten (03:15 UTC). Vorherigen gleichnamigen Job sicher entfernen.
do $$
begin
  perform cron.unschedule('purge-old-calls');
exception when others then null;
end $$;

select cron.schedule(
  'purge-old-calls',
  '15 3 * * *',
  $$ select public.purge_old_calls(); $$
);

-- Kontrolle:
--   select * from cron.job;                 -- geplanter Job sichtbar?
--   select public.purge_old_calls();        -- manuell sofort ausführen (Test)
