import { STAGE_LABEL } from '../list';
import { stageOf, type Appointment } from '../model';

const timeRange = (a: Appointment) => {
  if (a.allDay) return 'All day';
  const fmt = (s: string) => new Date(s).toLocaleTimeString('en-GB', { timeStyle: 'short' });
  return `${fmt(a.start)}–${fmt(a.end)}`;
};

interface Props {
  appt: Appointment;
  calendarName?: string;
  onToggleNotes: () => void;
  onInvoice: () => void;
  onRebook: () => void;
  onToggleHidden: () => void;
}

export function AppointmentCard({ appt, calendarName, onToggleNotes, onInvoice, onRebook, onToggleHidden }: Props) {
  const { props } = appt;
  const stage = stageOf(props);
  const hidden = Boolean(props.ag_hidden);

  return (
    <li className={`card stage-${stage}${hidden ? ' is-hidden' : ''}`}>
      <div className="card-head">
        <div>
          <h3>{appt.title}</h3>
          <p className="meta">
            {timeRange(appt)}
            {calendarName && ` · ${calendarName}`}
          </p>
        </div>
        <div className="card-side">
          <span className="stage-label">{STAGE_LABEL[stage]}</span>
          <button className="hide-button" onClick={onToggleHidden}>{hidden ? 'Unhide' : 'Hide'}</button>
        </div>
      </div>
      <div className="steps">
        <Step done={Boolean(props.ag_notes)} onClick={onToggleNotes}>Notes</Step>
        <Step done={Boolean(props.ag_invoiced)} onClick={onInvoice}>Invoice</Step>
        <Step done={Boolean(props.ag_rebooked)} onClick={onRebook}>Rebook</Step>
      </div>
    </li>
  );
}

function Step({ done, onClick, children }: { done: boolean; onClick: () => void; children: string }) {
  return (
    <button className={`step${done ? ' done' : ''}`} aria-pressed={done} onClick={onClick}>
      {done && <span aria-hidden>✓ </span>}
      {children}
    </button>
  );
}
