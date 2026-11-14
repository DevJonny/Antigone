import { useState } from 'react';
import type { Appointment } from '../model';
import { defaultRebookStart } from '../rebook';
import { Modal } from './Modal';

interface Props {
  appt: Appointment;
  connected: boolean;
  onRebook: (start: string) => Promise<void>;
  onComplete: () => void;
  onClose: () => void;
}

export function RebookDialog({ appt, connected, onRebook, onComplete, onClose }: Props) {
  const [start, setStart] = useState(() => defaultRebookStart(appt.start, appt.allDay));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const minutes = (Date.parse(appt.end) - Date.parse(appt.start)) / 60_000;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onRebook(start);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal title={`Rebook ${appt.title}`} onClose={onClose}>
      <label className="field">
        <span>{appt.allDay ? 'Date' : 'Date and time'}</span>
        <input type={appt.allDay ? 'date' : 'datetime-local'} value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      {!appt.allDay && <p className="hint">Same length as this appointment ({minutes} minutes).</p>}
      {!connected && <p className="error">Rebooking needs a connection to Google. Reconnect first.</p>}
      {error && <p className="error">{error}</p>}
      <button className="tonal wide-button" onClick={onComplete}>Complete without rebooking</button>
      <div className="actions">
        <button className="text" onClick={onClose}>Cancel</button>
        <button className="primary" onClick={submit} disabled={!connected || !start || saving}>
          {saving ? 'Creating…' : 'Create appointment'}
        </button>
      </div>
    </Modal>
  );
}
