import express from 'express';
import { z } from 'zod';
import { getSupabase } from '../lib/supabase';

const router = express.Router();

// ──────────────────────────────────────────────
//  Einfacher Schutz fürs Dashboard (MVP).
//  Frontend sendet  Authorization: Bearer <DASHBOARD_API_KEY>.
//  Für Produktion später durch Supabase-Auth / pro-Praxis-Login ersetzen.
// ──────────────────────────────────────────────
router.use((req, res, next) => {
  const key = process.env.DASHBOARD_API_KEY;
  if (!key) return next(); // nicht konfiguriert → offen (nur lokal sinnvoll)
  const auth = req.header('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== key) return res.status(401).json({ error: 'unauthorized' });
  next();
});

// GET /api/calls?practice_id=&status=
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabase();
    let query = supabase
      .from('calls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    const practiceId = req.query.practice_id;
    if (typeof practiceId === 'string' && practiceId) {
      query = query.eq('practice_id', practiceId);
    }
    const status = req.query.status;
    if (typeof status === 'string' && status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ calls: data ?? [] });
  } catch (err) {
    console.error('❌ /api/calls GET:', err);
    res.status(500).json({ error: 'db_error' });
  }
});

const patchSchema = z.object({
  status: z.enum(['neu', 'in_bearbeitung', 'erledigt']).optional(),
  staff_note: z.string().max(2000).nullable().optional(),
});

// PATCH /api/calls/:id
router.patch('/:id', async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body' });
  }
  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === 'erledigt') {
    update.handled_at = new Date().toISOString();
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('calls')
      .update(update)
      .eq('id', req.params.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'not_found' });
    res.json({ call: data });
  } catch (err) {
    console.error('❌ /api/calls PATCH:', err);
    res.status(500).json({ error: 'db_error' });
  }
});

// GET /api/calls/practices  → Liste der Praxen fürs Dropdown
router.get('/meta/practices', async (_req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('practices')
      .select('id, name')
      .eq('active', true)
      .order('name');
    if (error) throw error;
    res.json({ practices: data ?? [] });
  } catch (err) {
    console.error('❌ practices:', err);
    res.status(500).json({ error: 'db_error' });
  }
});

export default router;
