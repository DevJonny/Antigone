import type { AgPatch, AgProps, Appointment } from './model';

const BASE = 'https://www.googleapis.com/calendar/v3';

export class AuthError extends Error {}
export class NotFoundError extends Error {}

export interface CalendarInfo {
  id: string;
  name: string;
  primary: boolean;
  colour?: string;
}

type EventTime = { dateTime?: string; date?: string; timeZone?: string };

export interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  colorId?: string;
  start: EventTime;
  end: EventTime;
  extendedProperties?: { private?: AgProps };
}

async function call<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (res.status === 401) throw new AuthError('Your Google session has expired.');
  if (res.status === 404 || res.status === 410) throw new NotFoundError(path);
  if (!res.ok) throw new Error(`Google Calendar error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

const enc = encodeURIComponent;

export function toAppointment(calendarId: string, ev: GoogleEvent): Appointment {
  return {
    id: ev.id,
    calendarId,
    title: ev.summary ?? '(No title)',
    start: ev.start.dateTime ?? ev.start.date!,
    end: ev.end.dateTime ?? ev.end.date!,
    allDay: !ev.start.dateTime,
    props: ev.extendedProperties?.private ?? {},
  };
}

export async function listCalendars(token: string): Promise<CalendarInfo[]> {
  const res = await call<{ items: { id: string; summary: string; primary?: boolean; backgroundColor?: string }[] }>(
    token,
    '/users/me/calendarList?minAccessRole=writer',
  );
  return res.items.map((c) => ({ id: c.id, name: c.summary, primary: Boolean(c.primary), colour: c.backgroundColor }));
}

export async function listEvents(token: string, calendarId: string, timeMin: Date, timeMax: Date): Promise<Appointment[]> {
  const out: Appointment[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await call<{ items: GoogleEvent[]; nextPageToken?: string }>(
      token,
      `/calendars/${enc(calendarId)}/events?${params}`,
    );
    out.push(...res.items.filter((e) => e.status !== 'cancelled').map((e) => toAppointment(calendarId, e)));
    pageToken = res.nextPageToken;
  } while (pageToken);
  return out;
}

export function getEvent(token: string, calendarId: string, eventId: string) {
  return call<GoogleEvent>(token, `/calendars/${enc(calendarId)}/events/${enc(eventId)}`);
}

/** Patch merges keys, so only the changed properties are sent; `null` deletes one. */
export async function patchProps(token: string, calendarId: string, eventId: string, props: AgPatch) {
  const ev = await call<GoogleEvent>(token, `/calendars/${enc(calendarId)}/events/${enc(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ extendedProperties: { private: props } }),
  });
  return toAppointment(calendarId, ev);
}

export async function insertEvent(token: string, calendarId: string, body: Omit<GoogleEvent, 'id'>) {
  const ev = await call<GoogleEvent>(token, `/calendars/${enc(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return toAppointment(calendarId, ev);
}
