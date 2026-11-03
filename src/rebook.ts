import type { GoogleEvent } from './calendar';
import type { AgProps } from './model';

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

/** Formats a date for a `datetime-local` input, in local time. */
function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// All-day dates are parsed as UTC midnight so day arithmetic ignores DST.
const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);

export function defaultRebookStart(start: string, allDay: boolean): string {
  if (allDay) return addDays(start, 7);
  const d = new Date(start);
  d.setDate(d.getDate() + 7);
  return toLocalInput(d);
}

/**
 * Builds the follow-up event: same title, place and length, at `newStart`
 * (`YYYY-MM-DD` for all-day events, a local `YYYY-MM-DDTHH:mm` otherwise).
 */
export function rebookBody(original: GoogleEvent, newStart: string, props: AgProps): Omit<GoogleEvent, 'id'> {
  const base = {
    summary: original.summary,
    description: original.description,
    location: original.location,
    colorId: original.colorId,
    extendedProperties: { private: props },
  };

  if (original.start.date) {
    const days = (Date.parse(original.end.date!) - Date.parse(original.start.date)) / DAY_MS;
    return { ...base, start: { date: newStart }, end: { date: addDays(newStart, days) } };
  }

  const duration = Date.parse(original.end.dateTime!) - Date.parse(original.start.dateTime!);
  const start = new Date(newStart);
  const end = new Date(start.getTime() + duration);
  return {
    ...base,
    start: { dateTime: start.toISOString(), timeZone: original.start.timeZone },
    end: { dateTime: end.toISOString(), timeZone: original.end.timeZone },
  };
}
