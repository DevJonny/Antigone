import { describe, expect, it } from 'vitest';
import type { GoogleEvent } from './calendar';
import { defaultRebookStart, rebookBody } from './rebook';

const timed: GoogleEvent = {
  id: 'e1',
  summary: 'Jane Smith',
  location: 'Clinic',
  start: { dateTime: '2026-11-03T10:00:00Z', timeZone: 'Europe/London' },
  end: { dateTime: '2026-11-03T11:30:00Z', timeZone: 'Europe/London' },
  extendedProperties: { private: { ag_notes: '1', ag_invoiced: 'x' } },
};

describe('rebookBody', () => {
  it('keeps the title, location and duration of a timed event', () => {
    const body = rebookBody(timed, '2026-11-10T14:00', { ag_client: 'jane smith' });
    const start = new Date('2026-11-10T14:00');
    expect(body.summary).toBe('Jane Smith');
    expect(body.location).toBe('Clinic');
    expect(body.start).toEqual({ dateTime: start.toISOString(), timeZone: 'Europe/London' });
    expect(Date.parse(body.end.dateTime!) - start.getTime()).toBe(90 * 60_000);
  });

  it('starts fresh, carrying only the given properties', () => {
    const body = rebookBody(timed, '2026-11-10T14:00', { ag_client: 'jane smith', ag_payLink: 'link' });
    expect(body.extendedProperties).toEqual({ private: { ag_client: 'jane smith', ag_payLink: 'link' } });
  });

  it('keeps the day count of an all-day event', () => {
    const allDay: GoogleEvent = { id: 'e2', summary: 'Retreat', start: { date: '2026-11-03' }, end: { date: '2026-11-05' } };
    const body = rebookBody(allDay, '2026-12-30', {});
    expect(body.start).toEqual({ date: '2026-12-30' });
    expect(body.end).toEqual({ date: '2027-01-01' });
  });
});

describe('defaultRebookStart', () => {
  it('suggests the same time a week later', () => {
    const start = new Date(2026, 10, 3, 9, 15);
    expect(defaultRebookStart(start.toISOString(), false)).toBe('2026-11-10T09:15');
  });

  it('suggests the same day a week later for all-day events', () => {
    expect(defaultRebookStart('2026-11-28', true)).toBe('2026-12-05');
  });
});
