/**
 * Generiert aus einer Vertical-Config (verticals/<id>.json) die fertigen
 * Vapi-Artefakte:
 *   vapi/<id>.assistant.json   – per Vapi-API anlegen oder im Dashboard nachbauen
 *   vapi/<id>.prompt.md        – der System-Prompt zum Reinkopieren
 *
 * Aufruf:  npm run vapi:build -- <vertical>      (z.B. arzt | physio | tierarzt)
 *          npm run vapi:build                    (nimmt VERTICAL, sonst 'arzt')
 */
import fs from 'fs';
import path from 'path';
import { getVerticalById, listVerticalIds } from '../lib/vertical';
import type { VerticalField } from '../lib/vertical';

const id = process.argv[2] || process.env.VERTICAL || 'arzt';

function fieldToSchema(f: VerticalField) {
  const base: Record<string, unknown> = { description: f.extract };
  if (f.type === 'boolean') return { ...base, type: 'boolean' };
  if (f.type === 'enum') return { ...base, type: 'string', enum: f.options ?? [] };
  return { ...base, type: 'string' };
}

function build() {
  const v = getVerticalById(id);

  // ── Struktur-Schema: universelle + branchenspezifische Felder ──
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
    appointment_requested: {
      type: 'boolean',
      description: 'Möchte der Anrufer einen Termin?',
    },
    appointment_preference: {
      type: 'string',
      description: "Gewünschter Zeitraum, z.B. 'morgen Vormittag'",
    },
  };
  for (const f of v.fields) properties[f.key] = fieldToSchema(f);

  const assistant = {
    _comment: `Generiert aus verticals/${id}.json via "npm run vapi:build -- ${id}". 'server.url' = deine Webhook-URL, 'server.secret' = VAPI_WEBHOOK_SECRET.`,
    name: v.agent.assistantName,
    firstMessageMode: 'assistant-speaks-first',
    firstMessage: v.agent.firstMessage,
    transcriber: { provider: 'deepgram', model: 'nova-2', language: 'de' },
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.4,
      messages: [{ role: 'system', content: v.agent.systemPrompt }],
    },
    voice: {
      provider: '11labs',
      voiceId: 'EXAVITQu4vr4xnSDxMaL',
      model: 'eleven_multilingual_v2',
      _comment_voice: 'Deutsche, warme Stimme im ElevenLabs-Account wählen.',
    },
    server: {
      url: 'https://DEINE-RENDER-URL.onrender.com/api/webhook/vapi',
      secret: 'ein-langes-zufaelliges-geheimnis',
      _comment_secret: 'MUSS identisch zu VAPI_WEBHOOK_SECRET in der Server-.env sein.',
    },
    serverMessages: ['end-of-call-report'],
    endCallFunctionEnabled: true,
    silenceTimeoutSeconds: 20,
    maxDurationSeconds: 600,
    analysisPlan: {
      summaryPlan: {
        enabled: true,
        messages: [{ role: 'system', content: v.agent.summaryPrompt }],
      },
      structuredDataPlan: {
        enabled: true,
        messages: [{ role: 'system', content: v.agent.extractInstruction }],
        schema: { type: 'object', properties, required: ['category', 'urgency'] },
      },
    },
  };

  const vapiDir = path.resolve(__dirname, '../../../vapi');
  fs.mkdirSync(vapiDir, { recursive: true });

  const jsonPath = path.join(vapiDir, `${id}.assistant.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(assistant, null, 2) + '\n');

  const promptPath = path.join(vapiDir, `${id}.prompt.md`);
  const promptDoc = [
    `# System-Prompt – ${v.label} (${v.brand.name})`,
    '',
    'Gehört in Vapi unter **Assistant → Model → System Prompt**.',
    '`{{practice_name}}` und `{{opening_hours}}` werden pro Praxis über',
    '`assistantOverrides.variableValues` befüllt.',
    '',
    '---',
    '',
    v.agent.systemPrompt,
    '',
  ].join('\n');
  fs.writeFileSync(promptPath, promptDoc);

  console.log(`✅ ${v.brand.emoji} ${v.label} generiert:`);
  console.log(`   ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`   ${path.relative(process.cwd(), promptPath)}`);
}

try {
  build();
} catch (err) {
  console.error(`❌ ${(err as Error).message}`);
  console.error(`   Verfügbare Branchen: ${listVerticalIds().join(', ')}`);
  process.exit(1);
}
