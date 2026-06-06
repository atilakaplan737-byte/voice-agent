import { useEffect, useState, useCallback } from 'react';
import type { Call, CallStatus, Practice, VerticalConfig } from './types';
import {
  fetchCalls,
  fetchConfig,
  fetchPractices,
  updateCall,
  getKey,
  setKey,
} from './lib/api';
import {
  categoryLabelFor,
  urgencyLabel,
  urgencyClass,
  statusLabel,
  statusClass,
  formatDate,
} from './lib/labels';
import CallDetail from './components/CallDetail';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Alle' },
  { value: 'neu', label: 'Neu' },
  { value: 'in_bearbeitung', label: 'In Bearbeitung' },
  { value: 'erledigt', label: 'Erledigt' },
];

/** Brand-Farben der Branche als CSS-Variablen setzen (themed das ganze UI). */
function applyBrandColors(config: VerticalConfig) {
  const root = document.documentElement;
  for (const [shade, hex] of Object.entries(config.brand.color)) {
    root.style.setProperty(`--brand-${shade}`, hex);
  }
  document.title = `${config.brand.name} – Anruf-Dashboard`;
}

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getKey()));
  const [keyInput, setKeyInput] = useState('');
  const [config, setConfig] = useState<VerticalConfig | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [practiceId, setPracticeId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Call | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Branchen-Config laden (öffentlich, kein Login nötig) → Brand & Labels.
  useEffect(() => {
    fetchConfig()
      .then((c) => {
        setConfig(c);
        applyBrandColors(c);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchCalls(practiceId, statusFilter);
      setCalls(data);
    } catch (e) {
      if (e instanceof Error && e.message === 'unauthorized') {
        setAuthed(false);
        setError('Falscher Zugangsschlüssel.');
      } else {
        setError('Fehler beim Laden.');
      }
    } finally {
      setLoading(false);
    }
  }, [practiceId, statusFilter]);

  useEffect(() => {
    if (!authed) return;
    fetchPractices().then(setPractices).catch(() => {});
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    load();
  }, [authed, load]);

  // Auto-Refresh alle 30s – neue Anrufe erscheinen ohne Reload
  useEffect(() => {
    if (!authed) return;
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [authed, load]);

  async function handleUpdate(
    id: string,
    patch: { status?: CallStatus; staff_note?: string }
  ) {
    const updated = await updateCall(id, patch);
    setCalls((cs) => cs.map((c) => (c.id === id ? updated : c)));
    setSelected((s) => (s && s.id === id ? updated : s));
  }

  const brandName = config?.brand.name ?? 'Voice-Agent';
  const brandEmoji = config?.brand.emoji ?? '📞';

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold">
            {brandEmoji} {brandName}
          </h1>
          <p className="mb-6 text-sm text-slate-500">Anruf-Dashboard – bitte anmelden.</p>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Zugangsschlüssel"
            className="mb-3 w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <button
            onClick={() => {
              setKey(keyInput);
              setAuthed(true);
              setError('');
            }}
            className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Anmelden
          </button>
        </div>
      </div>
    );
  }

  const newCount = calls.filter((c) => c.status === 'neu').length;

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {brandEmoji} {brandName} – Anrufe
          </h1>
          <p className="text-sm text-slate-500">
            {practices.length === 1 ? `${practices[0].name} · ` : ''}
            {newCount > 0 ? `${newCount} neue Anrufe` : 'Keine neuen Anrufe'}
          </p>
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          ↻ Aktualisieren
        </button>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {practices.length > 1 && (
          <select
            value={practiceId}
            onChange={(e) => setPracticeId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">Alle Praxen</option>
            {practices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                statusFilter === f.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading && calls.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">Lädt …</p>
        ) : calls.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">
            Noch keine Anrufe erfasst.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Zeit</th>
                <th className="px-4 py-3">Anrufer</th>
                <th className="px-4 py-3">Anliegen</th>
                <th className="px-4 py-3">Dringl.</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={`cursor-pointer border-b border-slate-50 hover:bg-slate-50 ${
                    c.status === 'neu' ? 'font-medium' : ''
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {formatDate(c.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {c.caller_name || <span className="text-slate-400">unbekannt</span>}
                    {c.callback_number && (
                      <span className="block font-mono text-xs font-normal text-slate-400">
                        {c.callback_number}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-700">
                      {categoryLabelFor(config, c.category)}
                    </span>
                    {c.reason && (
                      <span className="block max-w-xs truncate text-xs font-normal text-slate-400">
                        {c.reason}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${urgencyClass[c.urgency]}`}>
                      {urgencyLabel[c.urgency]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[c.status]}`}>
                      {statusLabel[c.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <CallDetail
          call={selected}
          config={config}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
