import { clientKey, paymentOf, type Appointment } from './model';

export type PeriodKind = 'taxYear' | 'month';

/** A reporting period from `start` (inclusive) to `end` (exclusive), in local time. */
export interface Period {
  kind: PeriodKind;
  start: Date;
  end: Date;
  label: string;
}

export interface Report {
  appointments: number;
  clients: number;
  payment: { link: number; cash: number; transfer: number; unpaid: number };
  rebooking: { rebooked: number; completed: number; open: number };
}

/** The UK tax year starting 6 April of `year`. */
function taxYear(year: number): Period {
  return {
    kind: 'taxYear',
    start: new Date(year, 3, 6),
    end: new Date(year + 1, 3, 6),
    label: `${year}/${String(year + 1).slice(2)} tax year`,
  };
}

function month(year: number, m: number): Period {
  const start = new Date(year, m, 1);
  return {
    kind: 'month',
    start,
    end: new Date(year, m + 1, 1),
    label: start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
  };
}

/** The period of `kind` that contains `date`. */
export function periodContaining(kind: PeriodKind, date: Date): Period {
  if (kind === 'month') return month(date.getFullYear(), date.getMonth());
  const year = date.getFullYear();
  return taxYear(date < new Date(year, 3, 6) ? year - 1 : year);
}

/** The period `by` steps before (negative) or after (positive) `p`. */
export function shiftPeriod(p: Period, by: number): Period {
  return p.kind === 'month'
    ? month(p.start.getFullYear(), p.start.getMonth() + by)
    : taxYear(p.start.getFullYear() + by);
}

/** Appointments in `period` that have already started, leaving out dismissed ones. */
export function buildReport(appointments: Appointment[], period: Period, now: Date): Report {
  const seen = appointments.filter((a) => {
    const start = Date.parse(a.start);
    return !a.props.ag_hidden && start >= period.start.getTime() && start < period.end.getTime() && start <= now.getTime();
  });
  const report: Report = {
    appointments: seen.length,
    clients: new Set(seen.map((a) => a.props.ag_client ?? clientKey(a.title))).size,
    payment: { link: 0, cash: 0, transfer: 0, unpaid: 0 },
    rebooking: { rebooked: 0, completed: 0, open: 0 },
  };
  for (const a of seen) {
    report.payment[paymentOf(a.props) ?? 'unpaid']++;
    report.rebooking[a.props.ag_rebooked ? 'rebooked' : a.props.ag_done ? 'completed' : 'open']++;
  }
  return report;
}
