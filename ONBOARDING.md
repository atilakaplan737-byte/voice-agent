# Onboarding – neue Praxis anbinden

Schritt-für-Schritt, um eine Praxis live zu nehmen. Dauer: ca. 30–45 Min.

> **Branche festlegen:** Das Deployment läuft mit einem `VERTICAL`
> (`arzt` | `physio` | `tierarzt` …). Vapi-Assets vorher generieren:
> `npm run vapi:build -- <vertical>`. Die folgenden Beispiele nutzen `arzt`.

## 1. Vapi-Telefonnummer besorgen
- In **Vapi → Phone Numbers** eine Nummer kaufen/importieren.
  Für deutsche Anrufer am besten eine **deutsche Nummer** (Vapi via Twilio/Telnyx,
  oder eigene SIP-Nummer von z.B. sipgate importieren).
- Diese Nummer ist das Ziel der Rufumleitung der Praxis.

## 2. Assistant in Vapi anlegen
- Vorlage aus `vapi/<vertical>.assistant.json` verwenden (z.B. `vapi/arzt.assistant.json`),
  per Vapi-API anlegen oder Felder im Dashboard nachbauen.
- System-Prompt aus `vapi/<vertical>.prompt.md` einsetzen.
- **`server.url`** = `https://<dein-render-service>.onrender.com/api/webhook/vapi`
- **`server.secret`** = derselbe Wert wie `VAPI_WEBHOOK_SECRET` in der `.env`.
- `serverMessages` enthält `end-of-call-report`.
- Assistant der gekauften Nummer zuweisen.

### Praxis-spezifische Variablen
Pro Praxis `variableValues` setzen (am Assistant oder an der Nummer):
```json
{ "practice_name": "Hausarztpraxis Dr. Müller",
  "opening_hours": "Mo-Fr 8-12 und 15-18 Uhr" }
```

## 3. Praxis in der Datenbank anlegen
Im Supabase SQL Editor (`vertical` = Branche des Deployments):
```sql
insert into public.practices (vertical, name, phone, vapi_number, opening_hours)
values ('arzt', 'Hausarztpraxis Dr. Müller', '+49 30 1234567',
        '+49 30 9999999', 'Mo-Fr 8-12 und 15-18 Uhr');
```
Die `vapi_number` muss **exakt** die in Schritt 1 gekaufte Nummer sein
(Format wie von Vapi geliefert) – darüber ordnet der Webhook eingehende Anrufe
der richtigen Praxis zu. Alternativ `practice_id` als `metadata` am Assistant
hinterlegen (sauberer bei mehreren Praxen auf einer Nummer).

## 4. Rufumleitung in der Praxis einrichten ⭐ (der wichtigste Schritt)
Die Praxis-Telefonanlage soll **bei Nichtannahme** auf die Vapi-Nummer umleiten.
Je nach Anlage heißt das „verzögerte Rufumleitung" / „Rufumleitung bei keiner
Antwort" / „CFNR" (Call Forward No Reply).

- **Telekom / klassisches Festnetz:** oft per Tastenkombination,
  z.B. `*61*<Vapi-Nummer>*20#` (20 = Sekunden bis Umleitung).
- **VoIP-Anlage (z.B. Fritz!Box, 3CX, sipgate):** in der Weboberfläche unter
  *Telefonie → Rufumleitung* → „wenn nicht angenommen nach X Sek."
- Empfehlung: **20–30 Sekunden**, damit das Team zuerst die Chance hat.

> Tipp fürs Onboarding: Diesen Schritt am besten gemeinsam per Bildschirmteilen
> oder vor Ort machen – hier scheitern Kunden sonst.

## 5. Testen
1. Praxisnummer anrufen, **nicht** abnehmen → nach X Sek. übernimmt der Agent.
2. Ein Anliegen durchsprechen, auflegen.
3. Nach wenigen Sekunden erscheint der Anruf im Dashboard.

## 6. Übergabe ans Personal
- Dashboard-URL + Zugangsschlüssel (`DASHBOARD_API_KEY`) übergeben.
- Kurz zeigen: Anruf öffnen → Rückrufnummer → Status auf „erledigt" setzen.
- Empfehlung: Dashboard als Lesezeichen/Tab am Empfangs-PC offen lassen
  (auto-aktualisiert alle 30 Sek.).

## Checkliste
- [ ] Vapi-Nummer gekauft
- [ ] Assistant + Prompt + Webhook-URL + Secret gesetzt
- [ ] Variablen (practice_name, opening_hours) gesetzt
- [ ] Praxis in DB (`practices.vapi_number` = Vapi-Nummer)
- [ ] Rufumleitung bei Nichtannahme aktiv (20–30 Sek.)
- [ ] Testanruf erscheint im Dashboard
- [ ] AVV (Datenschutz) unterschrieben
- [ ] Personal eingewiesen
