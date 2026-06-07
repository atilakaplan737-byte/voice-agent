import express from 'express';
import { z } from 'zod';
import { getSupabase } from '../lib/supabase';
import { dashboardAuth } from '../lib/dashboardAuth';

// ──────────────────────────────────────────────
//  Verfügbarkeits-Einstellungen pro Praxis (Erstgespräch-Sprechzeiten).
//  GET/PATCH – ersetzt das manuelle SQL.
// ──────────────────────────────────────────────
const router = express.Router();
router.use(dashboardAuth);

const APPT_FIELDS =
  'appt_enabled, appt_slot_minutes, appt_horizon_days, appt_lead_hours, appt_windows';

/** Auf welche Praxis bezieht sich der Request? (eigene, oder Admin mit ?practice_id=) */
function targetPractice(req: express.Request, res: express.Response): string | null {
  if (!res.locals.isAdmin) return res.locals.practiceId;
  const pid = req.query.practice_id;
  return typeof pid === 'string' && pid ? pid : null;
}

// GET /api/settings  → aktuelle Verfügbarkeits-Konfig
router.get('/', async (req, res) => {
  const practiceId = targetPractice(req, res);
  if (!practiceId) return res.status(400).json({ error: 'need_practice' });
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('practices')
      .select(APPT_FIELDS)
      .eq('id', practiceId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'not_found' });
    res.json(data);
  } catch (err) {
    console.error('❌ /api/settings GET:', err);
    res.status(500).json({ error: 'db_error' });
  }
});

const windowSchema = z
  .object({
    weekday: z.number().int().min(1).max(7),
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  })
  .refine((w) => w.start < w.end, { message: 'start muss vor end liegen' });

const settingsSchema = z.object({
  appt_enabled: z.boolean(),
  appt_slot_minutes: z.number().int().min(5).max(240),
  appt_horizon_days: z.number().int().min(1).max(90).optional(),
  appt_lead_hours: z.number().int().min(0).max(168).optional(),
  appt_windows: z.array(windowSchema).max(50),
});

// PATCH /api/settings  → Verfügbarkeit speichern
router.patch('/', async (req, res) => {
  const practiceId = targetPractice(req, res);
  if (!practiceId) return res.status(400).json({ error: 'need_practice' });

  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.issues });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('practices')
      .update(parsed.data)
      .eq('id', practiceId)
      .select(APPT_FIELDS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'not_found' });
    res.json(data);
  } catch (err) {
    console.error('❌ /api/settings PATCH:', err);
    res.status(500).json({ error: 'db_error' });
  }
});

export default router;
