import fs from 'fs';
import path from 'path';

// ──────────────────────────────────────────────
//  Vertical-Config = eine Branche (arzt, physio, tierarzt …).
//  Single source of truth liegt in /verticals/<id>.json.
//  Branchenübergreifend gleich: urgency, status.
// ──────────────────────────────────────────────

export interface VerticalField {
  key: string;
  label: string;
  type: 'string' | 'boolean' | 'enum';
  options?: string[];
  extract: string; // Anweisung für die Strukturextraktion
}

export interface VerticalCategory {
  value: string;
  label: string;
}

export interface VerticalConfig {
  id: string;
  label: string;
  brand: {
    name: string;
    emoji: string;
    tagline: string;
    color: Record<string, string>;
  };
  subject: { noun: string; extract: string };
  categories: VerticalCategory[];
  fields: VerticalField[];
  agent: {
    assistantName: string;
    firstMessage: string;
    /** Im JSON als string[] (Zeilen) hinterlegt, hier zu einem Text zusammengefügt. */
    systemPrompt: string;
    summaryPrompt: string;
    extractInstruction: string;
  };
}

/** Findet den /verticals-Ordner – egal ob aus src/ (tsx) oder dist/ gestartet. */
function verticalsDir(): string {
  const candidates = [
    path.resolve(__dirname, '../../../verticals'), // server/src/lib | server/dist/lib → repo-root
    path.resolve(process.cwd(), '../verticals'), // cwd = server/
    path.resolve(process.cwd(), 'verticals'), // cwd = repo-root
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  throw new Error(
    `Verzeichnis "verticals" nicht gefunden. Gesucht in:\n${candidates.join('\n')}`
  );
}

function joinLines(v: string[] | string): string {
  return Array.isArray(v) ? v.join('\n') : v;
}

function loadConfig(id: string): VerticalConfig {
  const file = path.join(verticalsDir(), `${id}.json`);
  if (!fs.existsSync(file)) {
    const available = listVerticalIds().join(', ');
    throw new Error(
      `Unbekannte VERTICAL "${id}". Keine Datei ${id}.json. Verfügbar: ${available}`
    );
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
  // systemPrompt darf im JSON ein Array von Zeilen sein → zusammenfügen.
  raw.agent.systemPrompt = joinLines(raw.agent.systemPrompt);
  return raw as VerticalConfig;
}

export function listVerticalIds(): string[] {
  return fs
    .readdirSync(verticalsDir())
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
}

let cached: VerticalConfig | null = null;

/** Die aktive Branche der Deployment – via VERTICAL (default 'arzt'). */
export function getVertical(): VerticalConfig {
  if (cached) return cached;
  const id = process.env.VERTICAL || 'arzt';
  cached = loadConfig(id);
  return cached;
}

/** Beliebige Branche per id laden (für das Vapi-Build-Script). */
export function getVerticalById(id: string): VerticalConfig {
  return loadConfig(id);
}

/** Gültige Kategorie-Werte der aktiven Branche. */
export function categoryValues(cfg: VerticalConfig): string[] {
  return cfg.categories.map((c) => c.value);
}
