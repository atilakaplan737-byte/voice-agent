-- ════════════════════════════════════════════════════════════════
--  Per-Praxis-Prompt: eigene Zusatz-Hinweise pro Praxis
--  Im Supabase SQL Editor ausführen (einmalig).
--
--  Der Voice-Agent bleibt EIN Template pro Branche. Praxis-spezifische
--  Wünsche kommen als Variable {{custom_instructions}} in den Prompt
--  (pro Praxis in Vapi als assistantOverrides.variableValues gesetzt).
-- ════════════════════════════════════════════════════════════════

alter table public.practices
  add column if not exists custom_instructions text;

-- Beispiel:
--   update public.practices
--      set custom_instructions = 'Bei Grippeimpfung auf Dienstag verweisen. Wir machen Hausbesuche.'
--    where name = 'Hausarztpraxis Dr. Müller';
