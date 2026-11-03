import type { Connection } from '../useApp';

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
  onRefresh: () => void;
}

export function StatusBanner({ connection, lastSync, syncing, pending, error, onReconnect, onRefresh }: Props) {
  const waiting = pending > 0 ? ` ${pending} ${pending === 1 ? 'change' : 'changes'} waiting to upload.` : '';
  const synced = lastSync ? `Last synced ${time(lastSync)}.` : 'Not synced yet.';

  return (
    <header className={`status status-${connection}`} role="status" aria-live="polite">
      <div className="status-row">
        <span className="status-dot" aria-hidden />
        {connection === 'connected' && (
          <>
            <p>
              <strong>Connected to Google.</strong> {syncing ? 'Syncing…' : synced}
              {waiting}
            </p>
            <button onClick={onRefresh} disabled={syncing}>Refresh</button>
          </>
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
    </header>
  );
}
