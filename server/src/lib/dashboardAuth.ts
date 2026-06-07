import type { RequestHandler } from 'express';
import { getSupabase } from './supabase';

// ──────────────────────────────────────────────
//  Multi-Tenant-Auth fürs Dashboard (geteilt von /calls und /appointments).
//   • Bearer == DASHBOARD_API_KEY  → Admin (alle Praxen)
//   • Bearer == practices.dashboard_key → diese eine Praxis
//   • sonst → 401
//  Ergebnis in res.locals: { isAdmin, practiceId, practiceName }
// ──────────────────────────────────────────────
export const dashboardAuth: RequestHandler = async (req, res, next) => {
  const auth = req.header('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  const master = process.env.DASHBOARD_API_KEY;
  if (master && token === master) {
    res.locals.isAdmin = true;
    res.locals.practiceId = null;
    return next();
  }

  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('practices')
      .select('id, name')
      .eq('dashboard_key', token)
      .eq('active', true)
      .maybeSingle();
    if (!data) return res.status(401).json({ error: 'unauthorized' });
    res.locals.isAdmin = false;
    res.locals.practiceId = data.id;
    res.locals.practiceName = data.name;
    return next();
  } catch (err) {
    console.error('❌ Auth-Lookup:', err);
    return res.status(500).json({ error: 'db_error' });
  }
};
