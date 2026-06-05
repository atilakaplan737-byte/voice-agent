import type { CallUrgency, CallStatus, VerticalConfig } from '../types';

// Kategorie-Labels kommen aus der Branchen-Config (dynamisch).
export function categoryLabelFor(config: VerticalConfig | null, value: string): string {
  const found = config?.categories.find((c) => c.value === value);
  return found?.label ?? value;
}

// Dringlichkeit & Status sind branchenübergreifend gleich.
export const urgencyLabel: Record<CallUrgency, string> = {
  niedrig: 'Niedrig',
  mittel: 'Mittel',
  hoch: 'Hoch',
  notfall: 'Notfall',
};

export const urgencyClass: Record<CallUrgency, string> = {
  niedrig: 'bg-slate-100 text-slate-600',
  mittel: 'bg-sky-100 text-sky-700',
  hoch: 'bg-amber-100 text-amber-800',
  notfall: 'bg-red-100 text-red-700',
};

export const statusLabel: Record<CallStatus, string> = {
  neu: 'Neu',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
};

export const statusClass: Record<CallStatus, string> = {
  neu: 'bg-brand-100 text-brand-700',
  in_bearbeitung: 'bg-amber-100 text-amber-800',
  erledigt: 'bg-emerald-100 text-emerald-700',
};

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
