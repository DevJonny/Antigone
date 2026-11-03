import { useState } from 'react';
import type { CalendarInfo } from '../calendar';
import { Modal } from './Modal';

export interface Settings {
  calendarIds: string[];
  hideTucked: boolean;
}

interface Props {
  calendars: CalendarInfo[];
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

export function SettingsDialog({ calendars, settings, onSave, onClose }: Props) {
  const [ids, setIds] = useState(new Set(settings.calendarIds));
  const [hideTucked, setHideTucked] = useState(settings.hideTucked);

  const toggle = (id: string) =>
    setIds((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <Modal title="Settings" onClose={onClose}>
      <label className="check">
        <input type="checkbox" checked={hideTucked} onChange={(e) => setHideTucked(e.target.checked)} />
        Hide completed and dismissed
      </label>

      <h3 className="section">Calendars</h3>
      {calendars.length === 0 ? (
        <p className="hint">Connect to Google to choose calendars.</p>
      ) : (
        <ul className="calendar-list">
          {calendars.map((c) => (
            <li key={c.id}>
              <label className="check">
                <input type="checkbox" checked={ids.has(c.id)} onChange={() => toggle(c.id)} />
                <span className="swatch" style={{ background: c.colour }} aria-hidden />
                {c.name}
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="actions">
        <button onClick={onClose}>Cancel</button>
        <button
          className="primary"
          disabled={calendars.length > 0 && ids.size === 0}
          onClick={() => {
            onSave({ calendarIds: [...ids], hideTucked });
            onClose();
          }}
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
