import { describe, expect, it } from 'vitest';
import { applyEdits, clientKey, defaultPayMethod, findPayLink, paymentOf, queueEdit, stageOf, type Appointment } from './model';

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

  it('counts completing without rebooking as the last step', () => {
    expect(stageOf({ ag_notes: '1', ag_invoiced: 'x', ag_done: '1' })).toBe('rebooked');
    expect(stageOf({ ag_notes: '1', ag_done: '1' })).toBe('notes');
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

describe('paymentOf', () => {
  it('is undefined until invoiced', () => {
    expect(paymentOf({ ag_paidBy: 'cash' })).toBeUndefined();
  });

  it('reads the method, the legacy cash flag, or defaults to a link', () => {
    expect(paymentOf({ ag_invoiced: 'x', ag_paidBy: 'transfer' })).toBe('transfer');
    expect(paymentOf({ ag_invoiced: 'x', ag_cash: '1' })).toBe('cash');
    expect(paymentOf({ ag_invoiced: 'x' })).toBe('link');
  });
});

describe('defaultPayMethod', () => {
  it("uses the client's most recently invoiced method", () => {
    const target = appt();
    const older = appt({ id: 'e2', props: { ag_invoiced: '2026-10-01T00:00:00Z', ag_paidBy: 'cash' } });
    const newer = appt({ id: 'e3', props: { ag_invoiced: '2026-10-20T00:00:00Z', ag_paidBy: 'transfer' } });
    expect(defaultPayMethod(target, [newer, target, older])).toBe('transfer');
  });

  it('ignores other clients and falls back to a link', () => {
    const other = appt({ id: 'e2', title: 'Bob', props: { ag_invoiced: 'x', ag_paidBy: 'cash' } });
    expect(defaultPayMethod(appt(), [other])).toBe('link');
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
