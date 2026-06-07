import type {
  Appointment,
  Call,
  CallStatus,
  Practice,
  ScheduleSlot,
  VerticalConfig,
} from '../types';

// Dashboard-Key wird im Browser (localStorage) gehalten – MVP.
const KEY_STORAGE = 'voiceagent_dashboard_key';

export function getKey(): string {
  return localStorage.getItem(KEY_STORAGE) ?? '';
}
export function setKey(k: string): void {
  localStorage.setItem(KEY_STORAGE, k);
}

function authHeaders(): HeadersInit {
  const k = getKey();
  return k ? { Authorization: `Bearer ${k}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchConfig(): Promise<VerticalConfig> {
  const res = await fetch('/api/config');
  return handle<VerticalConfig>(res);
}

export async function fetchCalls(
  practiceId?: string,
  status?: string
): Promise<Call[]> {
  const params = new URLSearchParams();
  if (practiceId) params.set('practice_id', practiceId);
  if (status) params.set('status', status);
  const res = await fetch(`/api/calls?${params.toString()}`, {
    headers: authHeaders(),
  });
  const data = await handle<{ calls: Call[] }>(res);
  return data.calls;
}

export async function updateCall(
  id: string,
  patch: { status?: CallStatus; staff_note?: string | null }
): Promise<Call> {
  const res = await fetch(`/api/calls/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(patch),
  });
  const data = await handle<{ call: Call }>(res);
  return data.call;
}

export async function deleteCall(id: string): Promise<void> {
  const res = await fetch(`/api/calls/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handle<{ ok: boolean }>(res);
}

export async function fetchAppointments(practiceId?: string): Promise<Appointment[]> {
  const params = new URLSearchParams();
  if (practiceId) params.set('practice_id', practiceId);
  const res = await fetch(`/api/appointments?${params.toString()}`, {
    headers: authHeaders(),
  });
  const data = await handle<{ appointments: Appointment[] }>(res);
  return data.appointments;
}

export async function fetchSchedule(
  practiceId?: string
): Promise<{ schedule: ScheduleSlot[]; enabled: boolean }> {
  const params = new URLSearchParams();
  if (practiceId) params.set('practice_id', practiceId);
  const res = await fetch(`/api/appointments/schedule?${params.toString()}`, {
    headers: authHeaders(),
  });
  return handle<{ schedule: ScheduleSlot[]; enabled: boolean }>(res);
}

export async function cancelAppointment(id: string): Promise<void> {
  const res = await fetch(`/api/appointments/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handle<{ ok: boolean }>(res);
}

export async function fetchPractices(): Promise<Practice[]> {
  const res = await fetch('/api/calls/meta/practices', {
    headers: authHeaders(),
  });
  const data = await handle<{ practices: Practice[] }>(res);
  return data.practices;
}
