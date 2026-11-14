import { useEffect, useRef, useState } from 'react';
import type { Appointment } from '../model';
import { buildReport, periodContaining, shiftPeriod, type Period, type PeriodKind } from '../report';
import { Icon } from './Icon';
import { Modal } from './Modal';

interface Props {
  /** Saved appointments, used when the period can't be fetched. */
  cached: Appointment[];
  loadRange: (from: Date, to: Date) => Promise<Appointment[] | null>;
  onClose: () => void;
}

interface Loaded {
  period: Period;
  appointments: Appointment[];
  live: boolean;
  failed: boolean;
}

const KINDS: { kind: PeriodKind; label: string }[] = [
  { kind: 'taxYear', label: 'Tax year' },
  { kind: 'month', label: 'Month' },
];

const dateFmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function ReportDialog({ cached, loadRange, onClose }: Props) {
  const [now] = useState(() => new Date());
  const [period, setPeriod] = useState(() => periodContaining('taxYear', now));
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const cachedRef = useRef(cached);
  cachedRef.current = cached;

  useEffect(() => {
    let current = true;
    const done = (appointments: Appointment[] | null, failed = false) => {
      if (current) setLoaded({ period, appointments: appointments ?? cachedRef.current, live: appointments !== null, failed });
    };
    loadRange(period.start, period.end).then(done, () => done(null, true));
    return () => {
      current = false;
    };
  }, [period, loadRange]);

  const loading = loaded?.period !== period;
  const report = loaded && buildReport(loaded.appointments, loaded.period, now);
  const last = new Date(period.end.getTime() - 86_400_000);
  const pct = (n: number) => (report && report.appointments > 0 ? `${Math.round((n / report.appointments) * 100)}%` : '');

  return (
    <Modal title="Report" onClose={onClose}>
      <div className="segmented" role="radiogroup" aria-label="Period">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            role="radio"
            aria-checked={period.kind === k.kind}
            onClick={() => period.kind !== k.kind && setPeriod(periodContaining(k.kind, now))}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="period-nav">
        <button className="icon-button" aria-label="Previous period" onClick={() => setPeriod(shiftPeriod(period, -1))}>
          <Icon name="chevronLeft" size={24} />
        </button>
        <div>
          <strong>{period.label}</strong>
          <span>{dateFmt(period.start)} – {dateFmt(last)}</span>
        </div>
        <button
          className="icon-button"
          aria-label="Next period"
          disabled={shiftPeriod(period, 1).start > now}
          onClick={() => setPeriod(shiftPeriod(period, 1))}
        >
          <Icon name="chevronRight" size={24} />
        </button>
      </div>

      {report && (
        <div className={`report${loading ? ' is-loading' : ''}`} aria-busy={loading}>
          <h3 className="section">Seen</h3>
          <Rows rows={[['Clients', report.clients, ''], ['Appointments', report.appointments, '']]} />

          <h3 className="section">Payment</h3>
          <Rows
            rows={[
              ['SumUp', report.payment.link, pct(report.payment.link)],
              ['Cash', report.payment.cash, pct(report.payment.cash)],
              ['Bank transfer', report.payment.transfer, pct(report.payment.transfer)],
              ['Not invoiced yet', report.payment.unpaid, pct(report.payment.unpaid)],
            ]}
          />

          <h3 className="section">Rebooking</h3>
          <Rows
            rows={[
              ['Rebooked', report.rebooking.rebooked, pct(report.rebooking.rebooked)],
              ['Not rebooked', report.rebooking.completed, pct(report.rebooking.completed)],
              ['Not decided yet', report.rebooking.open, pct(report.rebooking.open)],
            ]}
          />
        </div>
      )}

      <p className="hint">
        {loading
          ? 'Loading…'
          : loaded?.failed
            ? "Couldn't load from Google, so this only counts appointments saved on this device (about the last 90 days)."
            : !loaded?.live
              ? 'Offline, so this only counts appointments saved on this device (about the last 90 days).'
              : 'Counts appointments that have already happened, leaving out hidden ones.'}
      </p>

      <div className="actions">
        <button className="primary" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

function Rows({ rows }: { rows: [label: string, count: number, share: string][] }) {
  return (
    <ul className="report-group">
      {rows.map(([label, count, share]) => (
        <li key={label}>
          <span>{label}</span>
          <span className="report-value">
            {share && <span className="report-share">{share}</span>}
            {count}
          </span>
        </li>
      ))}
    </ul>
  );
}
