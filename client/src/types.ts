export type CallUrgency = 'niedrig' | 'mittel' | 'hoch' | 'notfall';
export type CallStatus = 'neu' | 'in_bearbeitung' | 'erledigt';

export interface Call {
  id: string;
  practice_id: string | null;
  caller_name: string | null;
  callback_number: string | null;
  category: string; // Wert aus der aktiven Vertical-Config
  reason: string | null;
  urgency: CallUrgency;
  details: Record<string, unknown>; // branchenspezifische Felder
  appointment_requested: boolean;
  appointment_preference: string | null;
  summary: string | null;
  transcript: string | null;
  recording_url: string | null;
  status: CallStatus;
  staff_note: string | null;
  handled_at: string | null;
  created_at: string;
}

export interface Practice {
  id: string;
  name: string;
}

export interface Appointment {
  id: string;
  practice_id: string | null;
  starts_at: string;
  duration_min: number;
  kind: string;
  patient_name: string | null;
  callback_number: string | null;
  status: string;
  created_at: string;
}

export interface ApptWindow {
  weekday: number; // 1=Mo … 7=So
  start: string; // "09:00"
  end: string; // "11:00"
}

export interface ApptSettings {
  appt_enabled: boolean;
  appt_slot_minutes: number;
  appt_horizon_days: number;
  appt_lead_hours: number;
  appt_windows: ApptWindow[];
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

// ── Branchen-Config, kommt von GET /api/config ──
export interface VerticalField {
  key: string;
  label: string;
  type: 'string' | 'boolean' | 'enum';
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
  subject: { noun: string };
  categories: VerticalCategory[];
  fields: VerticalField[];
}
