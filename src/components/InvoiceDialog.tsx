import { useState } from 'react';
import type { Appointment, PayMethod } from '../model';
import { Modal } from './Modal';

interface Props {
  appt: Appointment;
  initialLink?: string;
  initialMethod: PayMethod;
  onSent: (link: string) => void;
  onPaid: (method: Exclude<PayMethod, 'link'>) => void;
  onClose: () => void;
}

const METHODS: { method: PayMethod; label: string }[] = [
  { method: 'link', label: 'SumUp' },
  { method: 'cash', label: 'Cash' },
  { method: 'transfer', label: 'Bank transfer' },
];

const canShare = typeof navigator.share === 'function';

export function InvoiceDialog({ appt, initialLink, initialMethod, onSent, onPaid, onClose }: Props) {
  const [method, setMethod] = useState(initialMethod);
  const [link, setLink] = useState(initialLink ?? '');
  const [error, setError] = useState<string | null>(null);
  const valid = /^https:\/\/\S+$/.test(link.trim());
  const date = new Date(appt.start).toLocaleDateString('en-GB', { dateStyle: 'long' });

  const share = async () => {
    try {
      await navigator.share({ title: 'Payment link', text: `Payment for your appointment on ${date}`, url: link.trim() });
      onSent(link.trim());
    } catch (e) {
      // AbortError means the share sheet was dismissed, so nothing was sent.
      if ((e as Error).name !== 'AbortError') setError('Sharing failed. Try copying the link instead.');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.trim());
      onSent(link.trim());
    } catch {
      setError('Copying failed. Select the link and copy it manually.');
    }
  };

  return (
    <Modal title={`Invoice ${appt.title}`} onClose={onClose}>
      <div className="segmented by-label" role="radiogroup" aria-label="Payment method">
        {METHODS.map((m) => (
          <button key={m.method} role="radio" aria-checked={method === m.method} onClick={() => setMethod(m.method)}>
            {m.label}
          </button>
        ))}
      </div>

      {method === 'link' ? (
        <>
          <label className="field">
            <span>SumUp payment link</span>
            <input type="url" inputMode="url" placeholder="https://pay.sumup.com/…" value={link} onChange={(e) => setLink(e.target.value)} />
          </label>
          {!initialLink && (
            <p className="hint">Create a reusable payment link for this client in the SumUp app, then paste it here. It's remembered for next time.</p>
          )}
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button className="text" onClick={onClose}>Cancel</button>
            <button onClick={copy} disabled={!valid} className={canShare ? 'tonal' : 'primary'}>Copy and mark invoiced</button>
            {canShare && <button className="primary" onClick={share} disabled={!valid}>Share link</button>}
          </div>
        </>
      ) : (
        <div className="actions">
          <button className="text" onClick={onClose}>Cancel</button>
          <button className="primary" onClick={() => onPaid(method)}>
            {method === 'cash' ? 'Mark paid in cash' : 'Mark paid by transfer'}
          </button>
        </div>
      )}
    </Modal>
  );
}
