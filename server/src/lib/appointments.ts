import { DateTime } from 'luxon';

// ──────────────────────────────────────────────
//  Termin-Slots für Erstgespräche generieren.
//  Alle Zeiten in Europe/Berlin (DST-sicher dank luxon),
//  gespeichert/zurückgegeben als UTC-ISO.
// ──────────────────────────────────────────────
export const ZONE = 'Europe/Berlin';

export interface ApptWindow {
  weekday: number; // 1=Mo … 7=So
  start: string; // "09:00"
  end: string; // "11:00"
}

export interface PracticeAppt {
  appt_enabled: boolean;
  appt_slot_minutes: number;
  appt_horizon_days: number;
  appt_lead_hours: number;
  appt_windows: ApptWindow[] | unknown;
}

export interface Slot {
  iso: string; // UTC-ISO, eindeutige Kennung des Termins
  label: string; // "Dienstag, 10. Juni, 09:00 Uhr"
}

function windows(p: PracticeAppt): ApptWindow[] {
  return Array.isArray(p.appt_windows) ? (p.appt_windows as ApptWindow[]) : [];
}

/** Menschlich lesbares Label eines Zeitpunkts (Europe/Berlin, Deutsch). */
export function labelFor(iso: string): string {
  return DateTime.fromISO(iso).setZone(ZONE).setLocale('de').toFormat("cccc, d. LLLL, HH:mm 'Uhr'");
}

/**
 * Freie Slots erzeugen.
 * @param p           Verfügbarkeits-Konfig der Praxis
 * @param bookedMs    Set der bereits belegten Startzeitpunkte (epoch ms)
 * @param max         max. Anzahl Vorschläge
 */
export function generateSlots(p: PracticeAppt, bookedMs: Set<number>, max = 6): Slot[] {
  const slotMin = p.appt_slot_minutes || 30;
  const horizon = p.appt_horizon_days || 21;
  const lead = p.appt_lead_hours ?? 2;

  const now = DateTime.now().setZone(ZONE);
  const earliest = now.plus({ hours: lead });
  const wins = windows(p);
  const out: Slot[] = [];

  for (let d = 0; d <= horizon; d++) {
    const day = now.plus({ days: d });
    for (const w of wins.filter((x) => Number(x.weekday) === day.weekday)) {
      const [sh, sm] = String(w.start).split(':').map(Number);
      const [eh, em] = String(w.end).split(':').map(Number);
      const dayEnd = day.set({ hour: eh, minute: em, second: 0, millisecond: 0 });
      let cur = day.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
      while (cur.plus({ minutes: slotMin }) <= dayEnd) {
        if (cur > earliest && !bookedMs.has(cur.toMillis())) {
          const iso = cur.toUTC().toISO({ suppressMilliseconds: true });
          if (iso) out.push({ iso, label: cur.setLocale('de').toFormat("cccc, d. LLLL, HH:mm 'Uhr'") });
        }
        cur = cur.plus({ minutes: slotMin });
      }
    }
  }
  out.sort((a, b) => a.iso.localeCompare(b.iso));
  return out.slice(0, max);
}

export interface ScheduleSlot {
  iso: string;
  date: string; // "2026-06-09"
  dayLabel: string; // "Montag, 9. Juni"
  time: string; // "09:00"
  status: 'frei' | 'gebucht';
  patient_name: string | null;
  callback_number: string | null;
  appointment_id: string | null;
}

export interface BookedInfo {
  id: string;
  patient_name: string | null;
  callback_number: string | null;
}

/**
 * Vollständiger Belegungsplan fürs Dashboard: ALLE Slots der nächsten Tage,
 * jeweils als 'frei' oder 'gebucht' (mit Patient) markiert.
 */
export function buildSchedule(
  p: PracticeAppt,
  booked: Map<number, BookedInfo>,
  days = 14
): ScheduleSlot[] {
  const slotMin = p.appt_slot_minutes || 30;
  const today = DateTime.now().setZone(ZONE).startOf('day');
  const wins = windows(p);
  const out: ScheduleSlot[] = [];

  for (let d = 0; d <= days; d++) {
    const day = today.plus({ days: d });
    for (const w of wins.filter((x) => Number(x.weekday) === day.weekday)) {
      const [sh, sm] = String(w.start).split(':').map(Number);
      const [eh, em] = String(w.end).split(':').map(Number);
      const dayEnd = day.set({ hour: eh, minute: em, second: 0, millisecond: 0 });
      let cur = day.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
      while (cur.plus({ minutes: slotMin }) <= dayEnd) {
        const iso = cur.toUTC().toISO({ suppressMilliseconds: true });
        const b = booked.get(cur.toMillis());
        if (iso) {
          out.push({
            iso,
            date: day.toISODate() ?? '',
            dayLabel: day.setLocale('de').toFormat('cccc, d. LLLL'),
            time: cur.toFormat('HH:mm'),
            status: b ? 'gebucht' : 'frei',
            patient_name: b?.patient_name ?? null,
            callback_number: b?.callback_number ?? null,
            appointment_id: b?.id ?? null,
          });
        }
        cur = cur.plus({ minutes: slotMin });
      }
    }
  }
  out.sort((a, b) => a.iso.localeCompare(b.iso));
  return out;
}

/** Prüft, ob ein gewünschter Zeitpunkt (iso) ein gültiger, freier Slot ist. */
export function isValidSlot(p: PracticeAppt, bookedMs: Set<number>, iso: string): boolean {
  const target = DateTime.fromISO(iso);
  if (!target.isValid) return false;
  const ms = target.toMillis();
  // großzügiges max, damit auch weiter entfernte gültige Slots gefunden werden
  return generateSlots(p, bookedMs, 1000).some((s) => DateTime.fromISO(s.iso).toMillis() === ms);
}
