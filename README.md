# 📞 Voice-Agent – Telefon-Assistent für Praxen (Multi-Branche)

Wenn in der Praxis niemand ans Telefon gehen kann, übernimmt ein KI-Sprachassistent:
Er nimmt das Anliegen des Anrufers auf, erfasst die wichtigen Daten + Terminwünsche
und schreibt alles strukturiert in eine Tabelle. Das Praxisteam sieht die Anrufe im
Dashboard und ruft zurück.

**Eine Codebasis – viele Branchen.** Eine `VERTICAL`-Variable wählt die Branche
(`arzt`, `physio`, `tierarzt` …). Jede Branche ist **eine JSON-Datei** unter
[`verticals/`](./verticals). Eine neue Branche = eine neue Datei, **kein Code**.

```
 Anrufer ──(keiner geht ran)──▶ Rufumleitung ──▶ Vapi Voice-Agent
                                                      │  (Gespräch auf Deutsch)
                                                      ▼
                                  POST /api/webhook/vapi  ──▶  Supabase (Tabelle "calls")
                                                                      │
                                              Praxis-Personal ──▶ React-Dashboard
```

## Stack
- **verticals/** – Branchen-Configs (JSON). Single source of truth für Brand,
  Kategorien, erfasste Felder und den Vapi-Prompt.
- **server/** – Node + TypeScript + Express. Webhook für Vapi + Dashboard-API.
  Liest die aktive Branche über `VERTICAL` und liefert sie als `/api/config`.
- **client/** – React + Vite + Tailwind. Dashboard, rendert Brand/Kategorien/Felder
  **dynamisch** aus `/api/config` (auch die Farben via CSS-Variablen).
- **Supabase** – Datenbank (`practices`, `calls`). Branchenspezifische Felder
  liegen generisch in `calls.details` (jsonb).
- **Vapi** – Telefonie + STT + LLM + TTS. Assets pro Branche generiert (siehe unten).

## Schnellstart (lokal)

```bash
# 1. Abhängigkeiten
npm run install:all

# 2. Env anlegen und ausfüllen (inkl. VERTICAL=arzt|physio|tierarzt)
cp .env.example .env

# 3. Supabase-Schema einspielen
#    Supabase → SQL Editor → Inhalt von schema.sql ausführen

# 4. Vapi-Assets für die Branche generieren
npm run vapi:build -- arzt        # → vapi/arzt.assistant.json + vapi/arzt.prompt.md

# 5. Dev starten (Server :3001, Client :5173)
npm run dev
```

Dashboard: <http://localhost:5173> — anmelden mit `DASHBOARD_API_KEY` aus der `.env`.

### Webhook lokal testen (ohne echten Anruf)
Vapi muss deinen Server erreichen → mit einem Tunnel (z.B. `ngrok http 3001`)
oder direkt per curl simulieren (Beispiel Branche `arzt`):

```bash
curl -X POST http://localhost:3001/api/webhook/vapi \
  -H "Content-Type: application/json" \
  -H "x-vapi-secret: $VAPI_WEBHOOK_SECRET" \
  -d '{"message":{"type":"end-of-call-report","call":{"id":"test-1"},
       "analysis":{"summary":"Frau Meyer möchte einen Termin.",
       "structuredData":{"caller_name":"Frau Meyer","callback_number":"017612345678",
       "patient_name":"Anna Meyer","birthdate":"14.03.1980","insurance":"gesetzlich",
       "category":"termin_wunsch","reason":"Kontrolltermin","urgency":"mittel",
       "appointment_requested":true,"appointment_preference":"diese Woche nachmittags"}},
       "transcript":"..."}}'
```

Danach erscheint der Anruf im Dashboard.

## Neue Branche anlegen (das Template-System)
Siehe **[verticals/README.md](./verticals/README.md)** – kurz:
1. `verticals/<id>.json` aus einer bestehenden kopieren und anpassen
   (Brand, Kategorien, `fields`, Prompt).
2. `npm run vapi:build -- <id>` → erzeugt die Vapi-Assets.
3. `VERTICAL=<id>` setzen und deployen. Fertig.

## Deployment
- **Server + Dashboard:** Render (`render.yaml` liegt bei). `VERTICAL` + Env-Variablen
  im Render-Dashboard setzen. Free-Plan reicht für den Start.
- Pro Branche ein eigener Render-Service (eigenes `VERTICAL`), oder ein Service je Kunde.
- Nach dem Deploy die Webhook-URL `https://<dein-service>.onrender.com/api/webhook/vapi`
  in Vapi (`server.url`) eintragen.

## Onboarding einer neuen Praxis
Siehe **[ONBOARDING.md](./ONBOARDING.md)** – Rufumleitung einrichten, Vapi-Nummer,
Praxis in DB anlegen.

## ⚠️ Datenschutz (DSGVO)
Es werden personenbezogene (bei Arzt/Physio: **Gesundheits-**)Daten verarbeitet:
- **AVV** (Auftragsverarbeitungsvertrag) mit jeder Praxis abschließen.
- Anrufer am Gesprächsanfang über die Aufnahme informieren (steht im Prompt).
- Aufnahmen/Transkripte nur so lange speichern wie nötig (Löschkonzept).
- EU-Datenresidenz bevorzugen (Supabase-Region EU, Vapi/Modelle EU wo möglich).
- Bei Arztpraxen zusätzlich ärztliche Schweigepflicht beachten – der Agent macht
  **keine** medizinischen Aussagen (im Prompt verankert).
