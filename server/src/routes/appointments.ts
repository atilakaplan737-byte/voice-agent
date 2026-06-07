import express from 'express';
import { DateTime } from 'luxon';
import { getSupabase } from '../lib/supabase';
import { dashboardAuth } from '../lib/dashboardAuth';
import { buildSchedule, type BookedInfo, type PracticeAppt } from '../lib/appointments';

const router = express.Router();
router.use(dashboardAuth);

// GET /api/appointments/schedule?days=&practice_id=  → voller Belegungsplan (frei/gebucht)
router.get('/schedule', async (req, res) => {
  try {
    const supabase = getSupabase();
    let practiceId: string | null = res.locals.practiceId;
    if (res.locals.isAdmin) {
      practiceId =
        typeof req.query.practice_id === 'string' && req.query.practice_id
          ? req.query.practice_id
          : null;
      if (!practiceId) return res.json({ schedule: [], enabled: false, needPractice: true });
    }

    const { data: p } = await supabase
      .from('practices')
      .select('appt_enabled, appt_slot_minutes, appt_horizon_days, appt_lead_hours, appt_windows')
      .eq('id', practiceId)
      .maybeSingle();
    if (!p || !p.appt_enabled) return res.json({ schedule: [], enabled: false });

    const days = Math.min(Number(req.query.days) || 14, 60);
    const { data: appts } = await supabase
      .from('appointments')
      .select('id, starts_at, patient_name, callback_number')
      .eq('practice_id', practiceId)
      .eq('status', 'gebucht');

    const booked = new Map<number, BookedInfo>();
    for (const a of appts ?? []) {
      booked.set(DateTime.fromISO(a.starts_at as string).toMillis(), {
        id: a.id as string,
        patient_name: (a.patient_name as string) ?? null,
        callback_number: (a.callback_number as string) ?? null,
      });
    }

    const schedule = buildSchedule(p as unknown as PracticeAppt, booked, days);
    res.json({ schedule, enabled: true });
  } catch (err) {
    console.error('❌ /api/appointments/schedule:', err);
    res.status(500).json({ error: 'db_error' });
  }
});

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
