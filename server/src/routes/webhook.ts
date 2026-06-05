import express from 'express';
import { z } from 'zod';
import { getSupabase } from '../lib/supabase';
import { getVertical, categoryValues } from '../lib/vertical';
import type { CallUrgency } from '../types';

const router = express.Router();

// ──────────────────────────────────────────────
//  Schema der "structuredData", die der Vapi-Assistant am Ende des
//  Gesprächs extrahiert (siehe Script build-vapi). Universelle Felder
//  + branchenspezifische Felder (Keys aus der Vertical-Config).
//  Alles optional + tolerant, weil ein Anrufer auch auflegen kann.
// ──────────────────────────────────────────────
const URGENCIES: CallUrgency[] = ['niedrig', 'mittel', 'hoch', 'notfall'];

const structuredSchema = z
  .object({
    caller_name: z.string().nullish(),
    callback_number: z.string().nullish(),
    category: z.string().nullish(),
    reason: z.string().nullish(),
    urgency: z.string().nullish(),
    appointment_requested: z.boolean().nullish(),
    appointment_preference: z.string().nullish(),
  })
  .passthrough(); // branchenspezifische Felder kommen über passthrough rein

function normCategory(v: unknown): string {
  const valid = categoryValues(getVertical());
  return typeof v === 'string' && valid.includes(v) ? v : 'sonstiges';
}
function normUrgency(v: unknown): CallUrgency {
  return URGENCIES.includes(v as CallUrgency) ? (v as CallUrgency) : 'mittel';
}

/** Branchenspezifische Felder (laut Vertical-Config) aus der Extraktion ziehen. */
function extractDetails(sd: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of getVertical().fields) {
    const val = sd[field.key];
    if (val !== undefined && val !== null && val !== '') {
      out[field.key] = val;
    }
  }
  return out;
}

/**
 * Findet die Praxis, zu der ein Anruf gehört.
 *  1. metadata.practice_id (sauberster Weg – beim Assistant hinterlegt)
 *  2. die angerufene Vapi-Nummer (practices.vapi_number)
 *  3. Fallback: erste aktive Praxis
 */
async function resolvePracticeId(call: any): Promise<string | null> {
  const supabase = getSupabase();

  const metaId =
    call?.assistantOverrides?.metadata?.practice_id ??
    call?.metadata?.practice_id;
  if (metaId) return metaId;

  const calledNumber =
    call?.phoneNumber?.number ?? call?.phoneCallProviderDetails?.to ?? null;
  if (calledNumber) {
    const { data } = await supabase
      .from('practices')
      .select('id')
      .eq('vapi_number', calledNumber)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  const { data: first } = await supabase
    .from('practices')
    .select('id')
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return first?.id ?? null;
}

// POST /api/webhook/vapi
router.post('/vapi', async (req, res) => {
  // 1) Webhook-Schutz: Vapi sendet das Secret als Header
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (secret) {
    const got = req.header('x-vapi-secret');
    if (got !== secret) {
      console.warn('⚠️  Webhook mit falschem/fehlendem Secret abgelehnt');
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  const message = req.body?.message ?? {};
  const type = message?.type;

  // Vapi schickt viele Event-Typen – uns interessiert nur der Report.
  if (type !== 'end-of-call-report') {
    return res.status(200).json({ ignored: type ?? 'unknown' });
  }

  try {
    const call = message.call ?? {};
    const analysis = message.analysis ?? {};
    const raw = analysis.structuredData ?? message.structuredData ?? {};
    const parsed = structuredSchema.safeParse(raw);
    const sd = parsed.success ? parsed.data : {};

    const vapiCallId: string | null = call.id ?? message.call?.id ?? null;
    const practiceId = await resolvePracticeId(call);

    const row = {
      practice_id: practiceId,
      caller_name: sd.caller_name ?? null,
      callback_number: sd.callback_number ?? call?.customer?.number ?? null,
      category: normCategory(sd.category),
      reason: sd.reason ?? null,
      urgency: normUrgency(sd.urgency),
      details: extractDetails(sd as Record<string, unknown>),
      appointment_requested: Boolean(sd.appointment_requested),
      appointment_preference: sd.appointment_preference ?? null,
      summary: analysis.summary ?? message.summary ?? null,
      transcript: message.transcript ?? null,
      recording_url:
        message.recordingUrl ?? message.artifact?.recordingUrl ?? null,
      vapi_call_id: vapiCallId,
    };

    const supabase = getSupabase();
    // upsert auf vapi_call_id → idempotent (Vapi kann doppelt zustellen)
    const { error } = await supabase
      .from('calls')
      .upsert(row, { onConflict: 'vapi_call_id', ignoreDuplicates: false });

    if (error) {
      console.error('❌ Supabase-Insert fehlgeschlagen:', error);
      return res.status(500).json({ error: 'db_error' });
    }

    console.log(
      `✅ Anruf gespeichert: ${row.caller_name ?? 'unbekannt'} – ${row.category} (${row.urgency})`
    );
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('❌ Webhook-Fehler:', err);
    return res.status(500).json({ error: 'internal' });
  }
});

export default router;
