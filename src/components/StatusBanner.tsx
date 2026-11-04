import { useEffect, useState } from 'react';
import type { Connection } from '../useApp';

// How long "Connected" stays up before the banner tucks away.
export const HIDE_AFTER_MS = 2000;

const time = (ms: number) => {
  const d = new Date(ms);
  const sameDay = d.toDateString() === new Date().toDateString();
  return d.toLocaleString('en-GB', sameDay ? { timeStyle: 'short' } : { dateStyle: 'medium', timeStyle: 'short' });
};

interface Props {
  connection: Connection;
  lastSync: number | null;
  syncing: boolean;
  pending: number;
  error: string | null;
  onReconnect: () => void;
}

export function StatusBanner({ connection, lastSync, syncing, pending, error, onReconnect }: Props) {
  const waiting = pending > 0 ? ` ${pending} ${pending === 1 ? 'change' : 'changes'} waiting to upload.` : '';
  const synced = lastSync ? `Last synced ${time(lastSync)}.` : 'Not synced yet.';

  // Nothing to report: connected, nothing queued, no error.
  const quiet = connection === 'connected' && pending === 0 && !error;
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!quiet) return;
    const id = setTimeout(() => setSettled(true), HIDE_AFTER_MS);
    return () => {
      clearTimeout(id);
      setSettled(false);
    };
  }, [quiet]);
  const hidden = quiet && settled;

  return (
    <header
      className={`status status-${connection}${hidden ? ' is-hidden' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="status-body" inert={hidden}>
        <div className="status-content">
          <div className="status-row">
            <span className="status-dot" aria-hidden />
            {connection === 'connected' && (
              <p>
                <strong>Connected to Google.</strong> {syncing ? 'Syncing…' : synced}
                {waiting}
              </p>
            )}
            {connection === 'offline' && (
              <p>
                <strong>Offline.</strong> Showing saved appointments. {synced}
                {waiting}
              </p>
            )}
            {connection === 'signedOut' && (
              <>
                <p>
                  <strong>Not connected to Google.</strong> Changes won't be saved to your calendar until you reconnect.
                  {waiting}
                </p>
                <button className="primary" onClick={onReconnect}>Reconnect</button>
              </>
            )}
            {connection === 'unconfigured' && (
              <p>
                <strong>Setup needed.</strong> Set <code>VITE_GOOGLE_CLIENT_ID</code> to a Google OAuth client ID.
              </p>
            )}
          </div>
          {error && <p className="status-error">{error}</p>}
        </div>
      </div>
    </header>
  );
}
