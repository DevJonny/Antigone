import { describe, expect, it } from 'vitest';
import type { AgProps, Appointment } from './model';
import { buildReport, periodContaining, shiftPeriod } from './report';

const now = new Date(2026, 10, 14, 12); // 14 Nov 2026, noon local time

let n = 0;
const appt = (title: string, day: Date, props: AgProps = {}): Appointment => ({
  id: `e${n++}`,
  calendarId: 'c1',
  title,
  start: day.toISOString(),
  end: new Date(day.getTime() + 3_600_000).toISOString(),
  allDay: false,
  props,
});

describe('periods', () => {
  it('runs the tax year from 6 April to 5 April', () => {
    const p = periodContaining('taxYear', now);
    expect([p.start, p.end, p.label]).toEqual([new Date(2026, 3, 6), new Date(2027, 3, 6), '2026/27 tax year']);
  });

  it('puts 1 to 5 April in the previous tax year', () => {
    expect(periodContaining('taxYear', new Date(2027, 3, 5)).label).toBe('2026/27 tax year');
    expect(periodContaining('taxYear', new Date(2027, 3, 6)).label).toBe('2027/28 tax year');
  });

  it('steps months across a year boundary', () => {
    const jan = shiftPeriod(periodContaining('month', now), 2);
    expect([jan.start, jan.label]).toEqual([new Date(2027, 0, 1), 'January 2027']);
  });

  it('steps tax years', () => {
    expect(shiftPeriod(periodContaining('taxYear', now), -1).label).toBe('2025/26 tax year');
  });
});

describe('buildReport', () => {
  const nov = (d: number, h = 10) => new Date(2026, 10, d, h);
  const all = [
    appt('Jane Smith', nov(2), { ag_invoiced: 'x', ag_paidBy: 'link', ag_rebooked: 'e9' }),
    appt('jane  smith', nov(9), { ag_invoiced: 'x', ag_cash: '1', ag_done: '1' }),
    appt('Bob', nov(10), { ag_invoiced: 'x', ag_paidBy: 'transfer' }),
    appt('Amy', nov(11)),
    appt('Hidden', nov(12), { ag_hidden: '1' }),
    appt('Later today', nov(14, 15)),
    appt('Next week', nov(21)),
    appt('October', new Date(2026, 9, 30, 10)),
  ];
  const november = periodContaining('month', now);
  const report = buildReport(all, november, now);

  it('counts appointments that have happened in the period, leaving out hidden ones', () => {
    expect(report.appointments).toBe(4);
  });

  it('counts each client once', () => {
    expect(report.clients).toBe(3);
  });

  it('breaks down payment method, counting legacy cash', () => {
    expect(report.payment).toEqual({ link: 1, cash: 1, transfer: 1, unpaid: 1 });
  });

  it('splits rebooked, completed without rebooking, and undecided', () => {
    expect(report.rebooking).toEqual({ rebooked: 1, completed: 1, open: 2 });
  });

  it('is empty for a period with nothing in it', () => {
    expect(buildReport(all, shiftPeriod(november, -2), now).appointments).toBe(0);
  });

  it('spans the whole tax year', () => {
    expect(buildReport(all, periodContaining('taxYear', now), now).appointments).toBe(5);
  });
});
