# Branchen-Configs (Verticals)

Jede Datei `<id>.json` ist **eine Branche** – die einzige Stelle, an der sich
Arzt / Physio / Tierarzt unterscheiden. Der Server lädt die über `VERTICAL`
gewählte Datei; Dashboard und Vapi-Prompt werden daraus erzeugt.

## Aufbau einer Config

| Feld | Bedeutung |
|---|---|
| `id` | technischer Name = Dateiname, = Wert für `VERTICAL` |
| `label` | Klartext, z.B. „Arztpraxis" |
| `brand.name` / `emoji` / `tagline` | Dashboard-Branding |
| `brand.color` | Farbpalette (50/100/500/600/700) – wird als CSS-Variablen ins UI gesetzt |
| `subject.noun` | Worum es geht: „Patient", „Tier" … |
| `categories[]` | Anliegen-Arten `{ value, label }`. `sonstiges` sollte es immer geben (Fallback) |
| `fields[]` | **branchenspezifische** Felder, die der Agent erfasst → landen in `calls.details` |
| `agent.firstMessage` | erster gesprochener Satz |
| `agent.systemPrompt` | System-Prompt als **Array von Zeilen** (wird mit `\n` verbunden) |
| `agent.summaryPrompt` | Anweisung für die Gesprächs-Zusammenfassung |
| `agent.extractInstruction` | Anweisung für die Struktur-Extraktion |

`{{practice_name}}` und `{{opening_hours}}` im Prompt werden pro Praxis über Vapi
`variableValues` befüllt.

### Ein `fields`-Eintrag
```json
{ "key": "insurance", "label": "Versicherung", "type": "enum",
  "options": ["gesetzlich", "privat"], "extract": "gesetzlich oder privat versichert" }
```
- `key` → Schlüssel in `calls.details` **und** im Vapi-Struktur-Schema (gleich halten!).
- `type` → `string` | `boolean` | `enum` (bei `enum` zusätzlich `options`).
- `label` → Anzeige im Dashboard.
- `extract` → Beschreibung für das Extraktions-Modell.

Universelle Felder (`caller_name`, `callback_number`, `category`, `reason`,
`urgency`, `appointment_requested`, `appointment_preference`) sind fest verbaut –
**nicht** in `fields` wiederholen.

## Neue Branche in 3 Schritten
```bash
# 1. Vorlage kopieren und anpassen
cp verticals/arzt.json verticals/zahnarzt.json   # id, brand, categories, fields, prompt editieren

# 2. Vapi-Assets generieren
npm run vapi:build -- zahnarzt                    # → vapi/zahnarzt.assistant.json + .prompt.md

# 3. Deployment auf die Branche stellen
#    .env / Render:  VERTICAL=zahnarzt
```

Danach in Vapi den Assistant aus `vapi/zahnarzt.assistant.json` anlegen, Webhook-URL
+ Secret eintragen – siehe [../ONBOARDING.md](../ONBOARDING.md).
