import { useEffect, useState } from 'react';
import type { ApptSettings } from '../types';
import { fetchSettings, saveSettings } from '../lib/api';

const WEEKDAYS: [number, string][] = [
  [1, 'Montag'],
  [2, 'Dienstag'],
  [3, 'Mittwoch'],
  [4, 'Donnerstag'],
  [5, 'Freitag'],
  [6, 'Samstag'],
  [7, 'Sonntag'],
];

interface Props {
  practiceId?: string; // bei Admin die gewählte Praxis; bei Praxis-Login leer (eigene)
  onSaved: () => void;
}

export default function Settings({ practiceId, onSaved }: Props) {
  const [s, setS] = useState<ApptSettings | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    setErr('');
    setS(null);
    setSavedMsg('');
    fetchSettings(practiceId)
      .then(setS)
      .catch(() => setErr('Bitte oben eine Praxis wählen, um die Sprechzeiten zu bearbeiten.'));
  }, [practiceId]);

  if (err)
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
        {err}
      </div>
    );
  if (!s)
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Lädt …</div>;

  function update(patch: Partial<ApptSettings>) {
    setS((cur) => (cur ? { ...cur, ...patch } : cur));
    setSavedMsg('');
  }
  function updateWindow(i: number, patch: Partial<ApptSettings['appt_windows'][number]>) {
    setS((cur) =>
      cur
        ? { ...cur, appt_windows: cur.appt_windows.map((w, idx) => (idx === i ? { ...w, ...patch } : w)) }
        : cur
    );
    setSavedMsg('');
  }
  function addWindow() {
    update({ appt_windows: [...s!.appt_windows, { weekday: 1, start: '09:00', end: '11:00' }] });
  }
  function removeWindow(i: number) {
    update({ appt_windows: s!.appt_windows.filter((_, idx) => idx !== i) });
  }

  async function save() {
    setSaving(true);
    setErr('');
    setSavedMsg('');
    try {
      const saved = await saveSettings(s!, practiceId);
      setS(saved);
      setSavedMsg('Gespeichert ✓');
      onSaved();
    } catch {
      setErr('Speichern fehlgeschlagen – bitte prüfen, dass jede Startzeit vor der Endzeit liegt.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={s.appt_enabled}
            onChange={(e) => update({ appt_enabled: e.target.checked })}
            className="h-4 w-4"
          />
          <span className="text-sm font-medium text-slate-700">
            Online-Terminbuchung für Erstgespräche aktiv
          </span>
        </label>
        <p className="mt-1 pl-7 text-xs text-slate-400">
          Wenn aktiv, bietet der Telefon-Assistent bei Erstgesprächen freie Termine aus den
          unten festgelegten Zeiten an.
        </p>

        <div className="mt-4 flex flex-wrap gap-4 pl-7">
          <label className="text-sm">
            <span className="mr-2 text-slate-500">Dauer je Termin:</span>
            <select
              value={s.appt_slot_minutes}
              onChange={(e) => update({ appt_slot_minutes: Number(e.target.value) })}
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
            >
              {[15, 20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m} Min
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mr-2 text-slate-500">Vorlauf (Std.):</span>
            <input
              type="number"
              min={0}
              max={168}
              value={s.appt_lead_hours}
              onChange={(e) => update({ appt_lead_hours: Number(e.target.value) })}
              className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mr-2 text-slate-500">Buchbar bis (Tage):</span>
            <input
              type="number"
              min={1}
              max={90}
              value={s.appt_horizon_days}
              onChange={(e) => update({ appt_horizon_days: Number(e.target.value) })}
              className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Sprechzeiten für Erstgespräche</h3>
        <p className="mb-3 text-xs text-slate-400">
          Wochenfenster, in denen Erstgespräche möglich sind. Daraus werden die buchbaren
          Termine im gewählten Takt erzeugt.
        </p>

        <div className="space-y-2">
          {s.appt_windows.length === 0 && (
            <p className="text-sm text-slate-400">Noch keine Zeiten festgelegt.</p>
          )}
          {s.appt_windows.map((w, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select
                value={w.weekday}
                onChange={(e) => updateWindow(i, { weekday: Number(e.target.value) })}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              >
                {WEEKDAYS.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={w.start}
                onChange={(e) => updateWindow(i, { start: e.target.value })}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <span className="text-slate-400">–</span>
              <input
                type="time"
                value={w.end}
                onChange={(e) => updateWindow(i, { end: e.target.value })}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <button
                onClick={() => removeWindow(i)}
                className="ml-1 rounded-lg px-2 py-1 text-sm text-red-500 hover:bg-red-50"
                title="Entfernen"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addWindow}
          className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          + Zeitfenster hinzufügen
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? 'Speichert …' : 'Speichern'}
        </button>
        {savedMsg && <span className="text-sm text-emerald-600">{savedMsg}</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  );
}
