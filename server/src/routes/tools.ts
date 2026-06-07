import express from 'express';
import { DateTime } from 'luxon';
import { getSupabase } from '../lib/supabase';
import {
  generateSlots,
  isValidSlot,
  labelFor,
  type PracticeAppt,
} from '../lib/appointments';

// ──────────────────────────────────────────────
//  Vapi ruft diesen Endpoint LIVE während des Gesprächs auf (Tools/Functions):
//   • freie_slots   → freie Erstgespräch-Termine
//   • termin_buchen → Termin verbindlich eintragen (Doppelbuchungs-Schutz)
//  Antwortformat: { results: [{ toolCallId, result }] }
// ──────────────────────────────────────────────
const router = express.Router();

async function resolvePractice(call: any): Promise<any | null> {
  const supabase = getSupabase();
  const metaId =
    call?.assistantOverrides?.metadata?.practice_id ?? call?.metadata?.practice_id;
  if (metaId) {
    const { data } = await supabase.from('practices').select('*').eq('id', metaId).maybeSingle();
    if (data) return data;
  }
  const calledNumber =
    call?.phoneNumber?.number ?? call?.phoneCallProviderDetails?.to ?? null;
  if (calledNumber) {
    const { data } = await supabase
      .from('practices')
      .select('*')
      .eq('vapi_number', calledNumber)
      .maybeSingle();
    if (data) return data;
  }
  const { data: first } = await supabase
    .from('practices')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return first ?? null;
}

async function bookedMsFor(practiceId: string): Promise<Set<number>> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('appointments')
    .select('starts_at')
    .eq('practice_id', practiceId)
    .eq('status', 'gebucht')
    .gte('starts_at', new Date().toISOString());
  const set = new Set<number>();
  for (const r of data ?? []) set.add(DateTime.fromISO(r.starts_at as string).toMillis());
  return set;
}

async function handleFreieSlots(practice: any): Promise<string> {
  if (!practice?.appt_enabled)
    return 'Online-Terminbuchung ist für diese Praxis nicht aktiv. Bitte den Terminwunsch nur notieren, das Team ruft zurück.';
  const booked = await bookedMsFor(practice.id);
  const slots = generateSlots(practice as PracticeAppt, booked, 5);
  if (slots.length === 0)
    return 'Aktuell sind keine Erstgespräch-Termine frei. Bitte den Wunsch notieren, das Team meldet sich.';
  const lines = slots.map((s, i) => `${i + 1}) ${s.label} [id:${s.iso}]`).join('; ');
  return `Freie Erstgespräch-Termine: ${lines}. Biete dem Anrufer zwei bis drei davon an und buche den gewählten mit termin_buchen (slot_id = die id in eckigen Klammern).`;
}

async function handleBook(practice: any, args: any, callId: string | null): Promise<string> {
  if (!practice?.appt_enabled) return 'Terminbuchung ist für diese Praxis nicht aktiv.';
  const slotId = String(args?.slot_id ?? args?.slot ?? '').trim();
  const name = args?.patient_name ?? args?.name ?? null;
  const number = args?.callback_number ?? args?.number ?? null;
  if (!slotId) return 'Es fehlt die Termin-ID. Bitte zuerst freie_slots aufrufen.';

  const booked = await bookedMsFor(practice.id);
  if (!isValidSlot(practice as PracticeAppt, booked, slotId))
    return 'Dieser Termin ist leider nicht mehr verfügbar. Bitte einen anderen aus der Liste wählen.';

  const supabase = getSupabase();
  const startsAt = DateTime.fromISO(slotId).toUTC().toISO();
  const { error } = await supabase.from('appointments').insert({
    practice_id: practice.id,
    starts_at: startsAt,
    duration_min: practice.appt_slot_minutes ?? 30,
    kind: 'erstgespraech',
    patient_name: name,
    callback_number: number,
    vapi_call_id: callId,
  });
  if (error) {
    console.error('❌ Termin-Insert:', error.message);
    return 'Der Termin wurde gerade vergeben. Bitte einen anderen wählen.';
  }
  console.log(`📅 Termin gebucht: ${labelFor(slotId)} (${name ?? 'unbekannt'})`);
  return `Termin gebucht: Erstgespräch am ${labelFor(slotId)}. Bestätige dem Anrufer diesen Termin freundlich.`;
}

function safeParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

// POST /api/tools
router.post('/', async (req, res) => {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (secret && req.header('x-vapi-secret') !== secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const message = req.body?.message ?? {};
  const call = message.call ?? {};
  const toolCalls =
    message.toolCallList ??
    message.toolCalls ??
    (message.functionCall ? [{ id: 'fc', function: message.functionCall }] : []);

  try {
    const practice = await resolvePractice(call);
    const results: { toolCallId: string; result: string }[] = [];
    for (const tc of toolCalls) {
      const name = tc.function?.name ?? tc.name;
      const rawArgs =
        tc.function?.arguments ?? tc.function?.parameters ?? tc.arguments ?? {};
      const args = typeof rawArgs === 'string' ? safeParse(rawArgs) : rawArgs;

      let result = 'Unbekanntes Werkzeug.';
      if (name === 'freie_slots') result = await handleFreieSlots(practice);
      else if (name === 'termin_buchen') result = await handleBook(practice, args, call.id ?? null);

      results.push({ toolCallId: tc.id ?? 'tc', result });
    }
    return res.status(200).json({ results });
  } catch (err) {
    console.error('❌ /api/tools:', err);
    return res
      .status(200)
      .json({ results: [{ toolCallId: 'err', result: 'Technischer Fehler bei der Terminbuchung.' }] });
  }
});

export default router;
