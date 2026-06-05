/**
 * Verbindet einen bestehenden Vapi-Assistant per API mit unserem Server:
 *   - Server URL (Webhook) + Secret
 *   - serverMessages = ["end-of-call-report"]
 *   - analysisPlan (Zusammenfassung + Daten-Extraktion) aus der Vertical-Config
 *
 * Lässt Stimme, Modell und Prompt unangetastet (PATCH nur dieser Felder).
 *
 * Nötige Env (aus ../.env):
 *   VAPI_API_KEY        – Vapi PRIVATE key
 *   VAPI_ASSISTANT_ID   – ID des Assistants
 *   VAPI_SERVER_URL     – öffentliche Webhook-URL (…/api/webhook/vapi)
 *   VAPI_WEBHOOK_SECRET – muss zum Server passen (kann leer sein)
 *   VERTICAL            – Branche (default arzt)
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { getVertical } from '../lib/vertical';

async function main() {
  const apiKey = process.env.VAPI_API_KEY;
  const assistantId = process.env.VAPI_ASSISTANT_ID;
  const serverUrl = process.env.VAPI_SERVER_URL;
  const secret = process.env.VAPI_WEBHOOK_SECRET || '';

  const missing = [
    !apiKey && 'VAPI_API_KEY',
    !assistantId && 'VAPI_ASSISTANT_ID',
    !serverUrl && 'VAPI_SERVER_URL',
  ].filter(Boolean);
  if (missing.length) {
    console.error(`❌ Fehlt in .env: ${missing.join(', ')}`);
    process.exit(1);
  }

  const v = getVertical();

  // Struktur-Schema: universelle + branchenspezifische Felder
  const properties: Record<string, unknown> = {
    caller_name: { type: 'string', description: 'Name des Anrufers' },
    callback_number: { type: 'string', description: 'Rückrufnummer' },
    category: {
      type: 'string',
      enum: v.categories.map((c) => c.value),
      description: 'Art des Anliegens',
    },
    reason: { type: 'string', description: 'Anliegen in eigenen Worten, kurz' },
    urgency: {
      type: 'string',
      enum: ['niedrig', 'mittel', 'hoch', 'notfall'],
      description: 'Dringlichkeit',
    },
    appointment_requested: { type: 'boolean', description: 'Möchte der Anrufer einen Termin?' },
    appointment_preference: { type: 'string', description: "Gewünschter Zeitraum, z.B. 'morgen Vormittag'" },
  };
  for (const f of v.fields) {
    if (f.type === 'boolean') properties[f.key] = { type: 'boolean', description: f.extract };
    else if (f.type === 'enum') properties[f.key] = { type: 'string', enum: f.options ?? [], description: f.extract };
    else properties[f.key] = { type: 'string', description: f.extract };
  }

  // Aktuellen Assistant holen, um Modell/Stimme NICHT zu überschreiben –
  // wir ersetzen nur den System-Prompt im bestehenden Modell.
  const getRes = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!getRes.ok) {
    console.error(`❌ Assistant nicht gefunden (${getRes.status}). ID prüfen.`);
    process.exit(1);
  }
  const current = (await getRes.json()) as any;
  const model = {
    ...(current.model ?? { provider: 'openai', model: 'gpt-4o' }),
    messages: [{ role: 'system', content: v.agent.systemPrompt }],
  };

  const body = {
    model,
    server: { url: serverUrl, secret },
    serverMessages: ['end-of-call-report'],
    analysisPlan: {
      summaryPlan: { messages: [{ role: 'system', content: v.agent.summaryPrompt }] },
      structuredDataPlan: {
        enabled: true,
        messages: [{ role: 'system', content: v.agent.extractInstruction }],
        schema: { type: 'object', properties, required: ['category', 'urgency'] },
      },
    },
  };

  const res = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`❌ Vapi-API ${res.status}: ${text}`);
    process.exit(1);
  }

  console.log('✅ Assistant verbunden & Prompt synchronisiert:');
  console.log(`   Webhook:   ${serverUrl}`);
  console.log(`   Secret:    ${secret ? 'gesetzt' : '(keins)'}`);
  console.log(`   Prompt:    aktualisiert (inkl. Ziffer-für-Ziffer-Regel)`);
  console.log(`   Branche:   ${v.id} (${v.fields.length} Extra-Felder)`);
  console.log('   → Jetzt im Vapi-Dashboard "Talk to Assistant" testen und auflegen.');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
