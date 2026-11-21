import { useState, type FormEvent } from 'react';
import { STAGE_LABEL } from '../list';
import { paymentOf, stageOf, TASK_MAX, tasksOf, type Appointment, type Task } from '../model';

const PAID_LABEL = { link: 'Invoice', cash: 'Cash', transfer: 'Transfer' } as const;
import { Icon } from './Icon';

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
  onAddTask: (text: string) => void;
  onToggleTask: (task: Task) => void;
  onRemoveTask: (task: Task) => void;
}

export function AppointmentCard({ appt, calendarName, onToggleNotes, onInvoice, onRebook, onToggleHidden, ...tasks }: Props) {
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
          <button className="text hide-button" onClick={onToggleHidden}>{hidden ? 'Unhide' : 'Hide'}</button>
        </div>
      </div>
      <div className="steps">
        <Step done={Boolean(props.ag_notes)} onClick={onToggleNotes}>Notes</Step>
        <Step done={Boolean(props.ag_invoiced)} onClick={onInvoice}>{PAID_LABEL[paymentOf(props) ?? 'link']}</Step>
        <Step done={Boolean(props.ag_rebooked || props.ag_done)} onClick={onRebook}>{props.ag_done ? 'Done' : 'Rebook'}</Step>
      </div>
      <Tasks tasks={tasksOf(props)} title={appt.title} {...tasks} />
    </li>
  );
}

interface TasksProps {
  tasks: Task[];
  title: string;
  onAddTask: (text: string) => void;
  onToggleTask: (task: Task) => void;
  onRemoveTask: (task: Task) => void;
}

function Tasks({ tasks, title, onAddTask, onToggleTask, onRemoveTask }: TasksProps) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');

  // Stays open after adding, so several tasks can go in one after another.
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) onAddTask(text);
    setText('');
  };

  return (
    <div className="tasks">
      {tasks.length > 0 && (
        <ul aria-label={`Tasks for ${title}`}>
          {tasks.map((t) => (
            <li key={t.key}>
              <button className={`step task${t.done ? ' done' : ''}`} aria-pressed={t.done} onClick={() => onToggleTask(t)}>
                {t.done && <Icon name="check" />}
                <span>{t.text}</span>
              </button>
              <button className="icon-button" aria-label={`Remove task: ${t.text}`} onClick={() => onRemoveTask(t)}>
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <form onSubmit={submit}>
          <input
            autoFocus
            aria-label="New task"
            placeholder="New task"
            enterKeyHint="done"
            maxLength={TASK_MAX}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => !text.trim() && setAdding(false)}
          />
          <button type="submit" className="text" disabled={!text.trim()}>Add</button>
        </form>
      ) : (
        <button className="text add-task" onClick={() => setAdding(true)}>
          <Icon name="add" />
          Add task
        </button>
      )}
    </div>
  );
}

function Step({ done, onClick, children }: { done: boolean; onClick: () => void; children: string }) {
  return (
    <button className={`step${done ? ' done' : ''}`} aria-pressed={done} onClick={onClick}>
      {done && <Icon name="check" />}
      {children}
    </button>
  );
}
