export type CallUrgency = 'niedrig' | 'mittel' | 'hoch' | 'notfall';

export type CallStatus = 'neu' | 'in_bearbeitung' | 'erledigt';

export interface CallRow {
  id: string;
  practice_id: string | null;
  caller_name: string | null;
  callback_number: string | null;
  category: string; // gegen aktive Vertical-Config validiert
  reason: string | null;
  urgency: CallUrgency;
  details: Record<string, unknown>; // branchenspezifische Felder
  appointment_requested: boolean;
  appointment_preference: string | null;
  summary: string | null;
  transcript: string | null;
  recording_url: string | null;
  vapi_call_id: string | null;
  status: CallStatus;
  staff_note: string | null;
  handled_at: string | null;
  created_at: string;
}
