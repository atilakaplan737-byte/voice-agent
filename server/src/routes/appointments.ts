import express from 'express';
import { getSupabase } from '../lib/supabase';
import { dashboardAuth } from '../lib/dashboardAuth';

const router = express.Router();
router.use(dashboardAuth);

// GET /api/appointments  → gebuchte Termine (scoped auf die eigene Praxis)
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabase();
    let query = supabase
      .from('appointments')
      .select('*')
      .eq('status', 'gebucht')
      .order('starts_at', { ascending: true })
      .limit(300);

    if (!res.locals.isAdmin) {
      query = query.eq('practice_id', res.locals.practiceId);
    } else if (typeof req.query.practice_id === 'string' && req.query.practice_id) {
      query = query.eq('practice_id', req.query.practice_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ appointments: data ?? [] });
  } catch (err) {
    console.error('❌ /api/appointments GET:', err);
    res.status(500).json({ error: 'db_error' });
  }
});

// DELETE /api/appointments/:id  → Termin absagen (löschen → Slot wird wieder frei)
router.delete('/:id', async (req, res) => {
  try {
    const supabase = getSupabase();
    let q = supabase.from('appointments').delete().eq('id', req.params.id);
    if (!res.locals.isAdmin) q = q.eq('practice_id', res.locals.practiceId);
    const { data, error } = await q.select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ /api/appointments DELETE:', err);
    res.status(500).json({ error: 'db_error' });
  }
});

export default router;
