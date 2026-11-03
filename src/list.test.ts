import { describe, expect, it } from 'vitest';
import { listView, STAGES } from './list';
import type { AgProps, Appointment } from './model';

const ALL = STAGES.map((s) => s.stage);
const local = (day: number, hour: number) => new Date(2026, 10, day, hour).toISOString();

const appt = (id: string, props: AgProps, day = 3, hour = 10): Appointment => ({
  id,
  calendarId: 'c1',
  title: id,
  start: local(day, hour),
  end: local(day, hour + 1),
  allDay: false,
  props,
});

const done = { ag_notes: '1', ag_invoiced: 'x', ag_rebooked: 'e9' };
const ids = (days: [string, Appointment[]][]) => days.flatMap(([, appts]) => appts.map((a) => a.id));

describe('listView', () => {
  const appts = [
    appt('todo', {}),
    appt('notes', { ag_notes: '1' }),
    appt('complete', done),
    appt('dismissed', { ag_hidden: '1' }),
  ];

  it('hides completed and dismissed entries when asked', () => {
    expect(ids(listView(appts, { hideTucked: true, stages: ALL }).days)).toEqual(['todo', 'notes']);
  });

  it('shows everything when not hiding', () => {
    expect(ids(listView(appts, { hideTucked: false, stages: ALL }).days)).toEqual(['todo', 'notes', 'complete', 'dismissed']);
  });

  it('drops the Rebooked filter only while completed entries are hidden', () => {
    const stages = (hideTucked: boolean) => listView(appts, { hideTucked, stages: ALL }).filters.map((f) => f.stage);
    expect(stages(true)).toEqual(['start', 'notes', 'invoiced']);
    expect(stages(false)).toEqual(ALL);
  });

  it('keeps only the selected statuses', () => {
    expect(ids(listView(appts, { hideTucked: false, stages: ['notes', 'rebooked'] }).days)).toEqual(['notes', 'complete']);
  });

  it('counts each status among the entries not hidden', () => {
    expect(listView(appts, { hideTucked: true, stages: [] }).counts).toEqual({ start: 1, notes: 1, invoiced: 0, rebooked: 0 });
  });

  it('groups by local day in the given order', () => {
    const days = listView([appt('a', {}, 3, 9), appt('b', {}, 3, 15), appt('c', {}, 4, 9)], { hideTucked: true, stages: ALL }).days;
    expect(days.map(([key, a]) => [key, a.map((x) => x.id)])).toEqual([
      ['2026-11-03', ['a', 'b']],
      ['2026-11-04', ['c']],
    ]);
  });

  it('keys all-day entries by their date', () => {
    const allDay = { ...appt('a', {}), start: '2026-11-05', end: '2026-11-06', allDay: true };
    expect(listView([allDay], { hideTucked: true, stages: ALL }).days[0][0]).toBe('2026-11-05');
  });
});
