import { useEffect, useMemo, useRef, useState } from 'react';
import { AppointmentCard } from './components/AppointmentCard';
import { Icon } from './components/Icon';
import { InvoiceDialog } from './components/InvoiceDialog';
import { RebookDialog } from './components/RebookDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { StatusBanner } from './components/StatusBanner';
import { listView, STAGES } from './list';
import { findPayLink, type Appointment, type Stage } from './model';
import { applyTheme, THEME_KEY, type Theme } from './theme';
import { useApp } from './useApp';

type Dialog = { kind: 'invoice' | 'rebook'; appt: Appointment } | { kind: 'settings' } | null;

// Per-device display preferences; losing them just means falling back to defaults.
function usePref<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? fallback : (JSON.parse(stored) as T);
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Not remembered between visits; fine.
    }
  }, [key, value]);
  return [value, setValue] as const;
}

const todayKey = () => new Date().toLocaleDateString('en-CA');
const dayLabel = (key: string) =>
  key === todayKey()
    ? 'Today'
    : new Date(`${key}T00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export function App() {
  const app = useApp();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [hideTucked, setHideTucked] = usePref('antigone.hideTucked', true);
  const [stageFilter, setStageFilter] = usePref<Stage[]>('antigone.stages', STAGES.map((s) => s.stage));
  const [theme, setTheme] = usePref<Theme>(THEME_KEY, 'system');
  const todayRef = useRef<HTMLElement>(null);

  useEffect(() => applyTheme(theme), [theme]);
  const scrolled = useRef(false);

  const { candidates, filters, counts, days } = useMemo(
    () => listView(app.appointments, { hideTucked, stages: stageFilter }),
    [app.appointments, hideTucked, stageFilter],
  );

  const toggleStage = (stage: Stage) =>
    setStageFilter((f) => (f.includes(stage) ? f.filter((s) => s !== stage) : [...f, stage]));

  const firstUpcoming = days.find(([key]) => key >= todayKey())?.[0];
  const calendarNames = new Map(app.calendars.map((c) => [c.id, c.name]));
  const showCalendarName = app.selected.length > 1;

  useEffect(() => {
    if (scrolled.current || !todayRef.current) return;
    todayRef.current.scrollIntoView({ block: 'start' });
    scrolled.current = true;
  }, [firstUpcoming]);

  const confirmUndo = (message: string) => window.confirm(message);

  return (
    <>
      <StatusBanner
        connection={app.connection}
        lastSync={app.lastSync}
        syncing={app.syncing}
        pending={app.pending}
        error={app.error}
        onReconnect={app.reconnect}
      />
      <main>
        <div className="app-bar">
          <h1>Appointments</h1>
          <div className="app-bar-actions">
            {app.connection === 'connected' && (
              <button className="icon-button" aria-label="Refresh" onClick={app.sync} disabled={app.syncing}>
                <Icon name="refresh" size={24} />
              </button>
            )}
            <button className="icon-button" aria-label="Settings" onClick={() => setDialog({ kind: 'settings' })}>
              <Icon name="settings" size={24} />
            </button>
          </div>
        </div>

        <div className="filters" role="group" aria-label="Filter by status">
          {filters.map(({ stage, label }) => (
            <button
              key={stage}
              className={`filter stage-${stage}`}
              aria-pressed={stageFilter.includes(stage)}
              onClick={() => toggleStage(stage)}
            >
              <span className="dot" aria-hidden />
              {label}
              <span className="count">{counts[stage]}</span>
            </button>
          ))}
        </div>

        {app.loaded && days.length === 0 && (
          <p className="empty">
            {candidates.length > 0
              ? 'No appointments match the selected statuses.'
              : app.connection === 'connected'
                ? 'No appointments in the next or last 90 days.'
                : 'Connect to Google to load your appointments.'}
          </p>
        )}

        {days.map(([key, appts]) => (
          <section key={key} className="day" ref={key === firstUpcoming ? todayRef : undefined}>
            <h2 className={key === todayKey() ? 'today' : undefined}>{dayLabel(key)}</h2>
            <ul>
              {appts.map((a) => (
                <AppointmentCard
                  key={`${a.calendarId}/${a.id}`}
                  appt={a}
                  calendarName={showCalendarName ? calendarNames.get(a.calendarId) : undefined}
                  onToggleNotes={() => {
                    if (!a.props.ag_notes) app.edit(a, { ag_notes: '1' });
                    else if (confirmUndo('Mark notes as not written?')) app.edit(a, { ag_notes: null });
                  }}
                  onInvoice={() => {
                    if (!a.props.ag_invoiced) setDialog({ kind: 'invoice', appt: a });
                    else if (confirmUndo(a.props.ag_cash ? 'Mark as not paid?' : 'Mark as not invoiced?'))
                      app.edit(a, { ag_invoiced: null, ag_cash: null });
                  }}
                  onRebook={() => {
                    if (!a.props.ag_rebooked) setDialog({ kind: 'rebook', appt: a });
                    else if (confirmUndo('Mark as not rebooked? The follow-up appointment stays in your calendar.'))
                      app.edit(a, { ag_rebooked: null });
                  }}
                  onToggleHidden={() => app.edit(a, { ag_hidden: a.props.ag_hidden ? null : '1' })}
                />
              ))}
            </ul>
          </section>
        ))}
      </main>

      {dialog?.kind === 'invoice' && (
        <InvoiceDialog
          appt={dialog.appt}
          initialLink={findPayLink(dialog.appt, app.appointments)}
          onSent={(link) => {
            app.markInvoiced(dialog.appt, link);
            setDialog(null);
          }}
          onPaidCash={() => {
            app.markPaidCash(dialog.appt);
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'rebook' && (
        <RebookDialog
          appt={dialog.appt}
          connected={app.connection === 'connected'}
          onRebook={(start) => app.rebook(dialog.appt, start)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'settings' && (
        <SettingsDialog
          calendars={app.calendars}
          settings={{ calendarIds: app.selected, hideTucked, theme }}
          onSave={({ calendarIds, hideTucked, theme }) => {
            setHideTucked(hideTucked);
            setTheme(theme);
            const changed = calendarIds.length !== app.selected.length || calendarIds.some((id) => !app.selected.includes(id));
            if (app.calendars.length > 0 && changed) app.chooseCalendars(calendarIds);
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
