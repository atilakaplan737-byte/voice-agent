import { useState } from 'react';
import type { Call, CallStatus, VerticalConfig } from '../types';
import {
  categoryLabelFor,
  urgencyLabel,
  urgencyClass,
  statusLabel,
  formatDate,
} from '../lib/labels';

interface Props {
  call: Call;
  config: VerticalConfig | null;
  onClose: () => void;
  onUpdate: (id: string, patch: { status?: CallStatus; staff_note?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const STATUS_FLOW: CallStatus[] = ['neu', 'in_bearbeitung', 'erledigt'];

/** Wert eines Detail-Feldes menschenlesbar machen. */
function formatDetail(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  return String(value);
}

export default function CallDetail({ call, config, onClose, onUpdate, onDelete }: Props) {
  const [note, setNote] = useState(call.staff_note ?? '');
  const [saving, setSaving] = useState(false);

  async function setStatus(status: CallStatus) {
    setSaving(true);
    await onUpdate(call.id, { status });
    setSaving(false);
  }

  async function saveNote() {
    setSaving(true);
    await onUpdate(call.id, { staff_note: note });
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm('Diesen Anruf endgültig löschen? Das kann nicht rückgängig gemacht werden.')) return;
    setSaving(true);
    await onDelete(call.id);
    // Schließen übernimmt der Aufrufer (Eintrag ist dann weg)
  }

  const fields = config?.fields ?? [];

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {call.caller_name || 'Unbekannter Anrufer'}
            </h2>
            <p className="text-sm text-slate-500">{formatDate(call.created_at)}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${urgencyClass[call.urgency]}`}>
            {urgencyLabel[call.urgency]}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {categoryLabelFor(config, call.category)}
          </span>
          {call.appointment_requested && (
            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">
              Terminwunsch
            </span>
          )}
        </div>

        <dl className="space-y-3 text-sm">
          {call.callback_number && (
            <div>
              <dt className="text-xs font-medium text-slate-500">Rückrufnummer</dt>
              <dd>
                <a
                  href={`tel:${call.callback_number.replace(/\s/g, '')}`}
                  className="inline-flex items-center gap-1 font-mono text-brand-700 hover:underline"
                >
                  📞 {call.callback_number}
                </a>
              </dd>
            </div>
          )}
          {/* Branchenspezifische Felder aus der Config */}
          {fields.map((f) => (
            <Field key={f.key} label={f.label} value={formatDetail(call.details?.[f.key])} />
          ))}
          <Field label="Anliegen" value={call.reason} />
          {call.appointment_requested && (
            <Field label="Terminwunsch" value={call.appointment_preference} />
          )}
          <Field label="Zusammenfassung" value={call.summary} />
        </dl>

        {call.recording_url && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-medium text-slate-500">Aufnahme</p>
            <audio controls src={call.recording_url} className="w-full" />
          </div>
        )}

        {call.transcript && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-brand-600">
              Volltranskript anzeigen
            </summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              {call.transcript}
            </pre>
          </details>
        )}

        <div className="mt-6 border-t pt-4">
          <p className="mb-2 text-xs font-medium text-slate-500">Status</p>
          <div className="flex gap-2">
            {STATUS_FLOW.map((s) => (
              <button
                key={s}
                disabled={saving}
                onClick={() => setStatus(s)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                  call.status === s
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {statusLabel[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-slate-500">Notiz</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="Notiz fürs Team …"
          />
          <button
            onClick={saveNote}
            disabled={saving}
            className="mt-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Notiz speichern
          </button>
        </div>

        <div className="mt-6 border-t pt-4">
          <button
            onClick={handleDelete}
            disabled={saving}
            className="text-sm font-medium text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
          >
            🗑️ Anruf endgültig löschen
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className={`text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
