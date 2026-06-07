import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import express from 'express';
import cors from 'cors';
import webhookRouter from './routes/webhook';
import callsRouter from './routes/calls';
import appointmentsRouter from './routes/appointments';
import toolsRouter from './routes/tools';
import { isSupabaseConfigured } from './lib/supabase';
import { getVertical } from './lib/vertical';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

app.use(cors());
app.use(express.json({ limit: '1mb' })); // Transkripte können groß sein

// Vapi-Webhook (vom Telefonie-Agent)
app.use('/api/webhook', webhookRouter);

// Vapi ruft Tools live im Gespräch auf (Terminbuchung)
app.use('/api/tools', toolsRouter);

// Dashboard-API (fürs Praxis-Personal)
app.use('/api/calls', callsRouter);
app.use('/api/appointments', appointmentsRouter);

// Aktive Branchen-Config – das Frontend rendert Brand, Kategorien & Felder daraus.
app.get('/api/config', (_req, res) => {
  const v = getVertical();
  res.json({
    id: v.id,
    label: v.label,
    brand: v.brand,
    subject: v.subject,
    categories: v.categories,
    fields: v.fields.map(({ key, label, type }) => ({ key, label, type })),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    vertical: getVertical().id,
    supabase_configured: isSupabaseConfigured(),
    webhook_secret_set: Boolean(process.env.VAPI_WEBHOOK_SECRET),
  });
});

// Im Produktionsbetrieb: gebautes Frontend ausliefern
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientPath));
  app.get('*', (_req, res) => res.sendFile(path.join(clientPath, 'index.html')));
}

app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('❌ Server-Fehler:', err);
    res.status(500).json({ error: 'internal' });
  }
);

app.listen(PORT, () => {
  const v = getVertical();
  console.log(`${v.brand.emoji} ${v.brand.name}-Server läuft auf Port ${PORT}`);
  console.log(`   Branche:  ${v.id} (${v.label})`);
  console.log(`   Supabase: ${isSupabaseConfigured() ? 'OK' : 'NICHT konfiguriert'}`);
  console.log(`   Webhook:  POST /api/webhook/vapi`);
});
