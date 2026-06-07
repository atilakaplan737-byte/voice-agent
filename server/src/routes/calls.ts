import express from 'express';
import { z } from 'zod';
import { getSupabase } from '../lib/supabase';
import { dashboardAuth } from '../lib/dashboardAuth';

const router = express.Router();

// Multi-Tenant-Schutz (siehe lib/dashboardAuth)
router.use(dashboardAuth);

// GET /api/calls?practice_id=&status=
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabase();
    let query = supabase
      .from('calls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    // Nicht-Admins sind fest auf ihre Praxis beschränkt.
    if (!res.locals.isAdmin) {
      query = query.eq('practice_id', res.locals.practiceId);
    } else {
      const practiceId = req.query.practice_id;
      if (typeof practiceId === 'string' && practiceId) {
        query = query.eq('practice_id', practiceId);
      }
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
    let q = supabase.from('calls').update(update).eq('id', req.params.id);
    // Nicht-Admins dürfen nur eigene Anrufe ändern.
    if (!res.locals.isAdmin) {
      q = q.eq('practice_id', res.locals.practiceId);
    }
    const { data, error } = await q.select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'not_found' });
    res.json({ call: data });
  } catch (err) {
    console.error('❌ /api/calls PATCH:', err);
    res.status(500).json({ error: 'db_error' });
  }
});

// DELETE /api/calls/:id  → Eintrag endgültig löschen (DSGVO / Aufräumen)
router.delete('/:id', async (req, res) => {
  try {
    const supabase = getSupabase();
    let q = supabase.from('calls').delete().eq('id', req.params.id);
    // Nicht-Admins dürfen nur eigene Anrufe löschen.
    if (!res.locals.isAdmin) {
      q = q.eq('practice_id', res.locals.practiceId);
    }
    const { data, error } = await q.select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ /api/calls DELETE:', err);
    res.status(500).json({ error: 'db_error' });
  }
});

// GET /api/calls/meta/practices  → Praxen-Liste
//  Admin: alle. Praxis: nur sich selbst (fürs Frontend/Anzeige).
router.get('/meta/practices', async (_req, res) => {
  try {
    const supabase = getSupabase();
    let query = supabase
      .from('practices')
      .select('id, name')
      .eq('active', true)
      .order('name');
    if (!res.locals.isAdmin) {
      query = query.eq('id', res.locals.practiceId);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ practices: data ?? [] });
  } catch (err) {
    console.error('❌ practices:', err);
    res.status(500).json({ error: 'db_error' });
  }
});

export default router;
