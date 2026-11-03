import { describe, expect, it } from 'vitest';
import { applyEdits, clientKey, findPayLink, queueEdit, stageOf, type Appointment } from './model';

const appt = (over: Partial<Appointment> = {}): Appointment => ({
  id: 'e1',
  calendarId: 'c1',
  title: 'Jane Smith',
  start: '2026-11-03T10:00:00Z',
  end: '2026-11-03T11:00:00Z',
  allDay: false,
  props: {},
  ...over,
});

describe('stageOf', () => {
  it('is start when nothing is done', () => {
    expect(stageOf({})).toBe('start');
  });

  it('advances through each step in order', () => {
    expect(stageOf({ ag_notes: '1' })).toBe('notes');
    expect(stageOf({ ag_notes: '1', ag_invoiced: 'x' })).toBe('invoiced');
    expect(stageOf({ ag_notes: '1', ag_invoiced: 'x', ag_rebooked: 'e2' })).toBe('rebooked');
  });

  it('stays orange when rebooked but not invoiced', () => {
    expect(stageOf({ ag_notes: '1', ag_rebooked: 'e2' })).toBe('notes');
  });

  it('stays red when later steps are done without notes', () => {
    expect(stageOf({ ag_invoiced: 'x', ag_rebooked: 'e2' })).toBe('start');
  });
});

describe('clientKey', () => {
  it('ignores case and surrounding or repeated whitespace', () => {
    expect(clientKey('  Jane   SMITH ')).toBe('jane smith');
  });
});

describe('findPayLink', () => {
  it('prefers the link on the event itself', () => {
    const own = appt({ props: { ag_payLink: 'own' } });
    const other = appt({ id: 'e2', props: { ag_payLink: 'other' } });
    expect(findPayLink(own, [other, own])).toBe('own');
  });

  it('falls back to another event for the same client', () => {
    const target = appt();
    const other = appt({ id: 'e2', title: 'jane smith', props: { ag_payLink: 'link' } });
    expect(findPayLink(target, [target, other])).toBe('link');
  });

  it('ignores other clients', () => {
    const target = appt();
    const other = appt({ id: 'e2', title: 'Bob', props: { ag_payLink: 'link' } });
    expect(findPayLink(target, [target, other])).toBeUndefined();
  });
});

describe('edit queue', () => {
  it('merges edits to the same event', () => {
    const q1 = queueEdit([], { calendarId: 'c1', eventId: 'e1', props: { ag_notes: '1' } });
    const q2 = queueEdit(q1, { calendarId: 'c1', eventId: 'e1', props: { ag_hidden: '1' } });
    expect(q2).toEqual([{ calendarId: 'c1', eventId: 'e1', props: { ag_notes: '1', ag_hidden: '1' } }]);
  });

  it('keeps later values over earlier ones', () => {
    const q1 = queueEdit([], { calendarId: 'c1', eventId: 'e1', props: { ag_notes: '1' } });
    const q2 = queueEdit(q1, { calendarId: 'c1', eventId: 'e1', props: { ag_notes: null } });
    expect(q2[0].props).toEqual({ ag_notes: null });
  });

  it('applies edits over cached events, with null removing a value', () => {
    const events = [appt({ props: { ag_notes: '1', ag_client: 'jane smith' } }), appt({ id: 'e2' })];
    const applied = applyEdits(events, [
      { calendarId: 'c1', eventId: 'e1', props: { ag_notes: null, ag_hidden: '1' } },
    ]);
    expect(applied[0].props).toEqual({ ag_client: 'jane smith', ag_hidden: '1' });
    expect(applied[1]).toBe(events[1]);
  });
});
