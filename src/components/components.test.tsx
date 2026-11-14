// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgProps, Appointment } from '../model';
import { AppointmentCard } from './AppointmentCard';
import { InvoiceDialog } from './InvoiceDialog';
import { RebookDialog } from './RebookDialog';
import { ReportDialog } from './ReportDialog';
import { HIDE_AFTER_MS, StatusBanner } from './StatusBanner';

afterEach(cleanup);

// jsdom has no <dialog> behaviour.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
};

const appt = (props: AgProps): Appointment => ({
  id: 'e1',
  calendarId: 'c1',
  title: 'Jane Smith',
  start: '2026-11-03T10:00:00Z',
  end: '2026-11-03T11:00:00Z',
  allDay: false,
  props,
});

function renderCard(props: AgProps) {
  const handlers = {
    onToggleNotes: vi.fn(),
    onInvoice: vi.fn(),
    onRebook: vi.fn(),
    onToggleHidden: vi.fn(),
  };
  const { container } = render(<AppointmentCard appt={appt(props)} {...handlers} />);
  return { card: container.querySelector('li')!, handlers };
}

describe('AppointmentCard', () => {
  it.each([
    [{}, 'stage-start', 'To do'],
    [{ ag_notes: '1' }, 'stage-notes', 'Notes written'],
    [{ ag_notes: '1', ag_rebooked: 'e2' }, 'stage-notes', 'Notes written'],
    [{ ag_notes: '1', ag_invoiced: 'x' }, 'stage-invoiced', 'Invoiced'],
    [{ ag_notes: '1', ag_invoiced: 'x', ag_rebooked: 'e2' }, 'stage-rebooked', 'Complete'],
    [{ ag_notes: '1', ag_invoiced: 'x', ag_done: '1' }, 'stage-rebooked', 'Complete'],
  ])('colours %o as %s', (props, className, label) => {
    const { card } = renderCard(props);
    expect(card.classList).toContain(className);
    expect(screen.getByText(label, { selector: '.stage-label' })).toBeTruthy();
  });

  it('marks done steps as pressed', () => {
    renderCard({ ag_notes: '1', ag_rebooked: 'e2' });
    const pressed = (name: RegExp) => screen.getByRole('button', { name }).getAttribute('aria-pressed');
    expect(pressed(/Notes/)).toBe('true');
    expect(pressed(/Invoice/)).toBe('false');
    expect(pressed(/Rebook/)).toBe('true');
  });

  it('routes each button to its handler', () => {
    const { handlers } = renderCard({});
    for (const [name, handler] of [
      ['Notes', handlers.onToggleNotes],
      ['Invoice', handlers.onInvoice],
      ['Rebook', handlers.onRebook],
      ['Hide', handlers.onToggleHidden],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(handler).toHaveBeenCalledOnce();
    }
  });

  it.each([
    [{ ag_paidBy: 'cash' as const }, 'Cash'],
    [{ ag_cash: '1' }, 'Cash'],
    [{ ag_paidBy: 'transfer' as const }, 'Transfer'],
    [{ ag_paidBy: 'link' as const }, 'Invoice'],
  ])('labels payment %o as %s', (props, label) => {
    renderCard({ ag_notes: '1', ag_invoiced: 'x', ...props });
    expect(screen.getByRole('button', { name: new RegExp(label) }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Invoiced', { selector: '.stage-label' })).toBeTruthy();
  });

  it('shows Done when completed without rebooking', () => {
    renderCard({ ag_notes: '1', ag_invoiced: 'x', ag_done: '1' });
    expect(screen.getByRole('button', { name: /Done/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('offers to unhide a dismissed entry', () => {
    const { card } = renderCard({ ag_hidden: '1' });
    expect(card.classList).toContain('is-hidden');
    expect(screen.getByRole('button', { name: 'Unhide' })).toBeTruthy();
  });
});

describe('InvoiceDialog', () => {
  const dialog = (initialMethod: 'link' | 'cash' | 'transfer') => {
    const handlers = { onSent: vi.fn(), onPaid: vi.fn(), onClose: vi.fn() };
    render(<InvoiceDialog appt={appt({ ag_notes: '1' })} initialMethod={initialMethod} {...handlers} />);
    return handlers;
  };
  const linkField = () => screen.queryByLabelText('SumUp payment link');

  it('starts on the given method', () => {
    dialog('transfer');
    expect(screen.getByRole('radio', { name: 'Bank transfer' }).getAttribute('aria-checked')).toBe('true');
  });

  it('shows the link field only for SumUp', () => {
    dialog('link');
    expect(linkField()).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Cash' }));
    expect(linkField()).toBeNull();
  });

  it.each([
    ['cash', 'Mark paid in cash'],
    ['transfer', 'Mark paid by transfer'],
  ] as const)('marks paid by %s without a link', (method, button) => {
    const { onPaid, onSent } = dialog(method);
    fireEvent.click(screen.getByRole('button', { name: button }));
    expect(onPaid).toHaveBeenCalledWith(method);
    expect(onSent).not.toHaveBeenCalled();
  });
});

describe('RebookDialog', () => {
  it('completes without rebooking, even offline', () => {
    const onComplete = vi.fn();
    const onRebook = vi.fn();
    render(<RebookDialog appt={appt({})} connected={false} onRebook={onRebook} onComplete={onComplete} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Complete without rebooking' }));
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onRebook).not.toHaveBeenCalled();
  });
});

describe('ReportDialog', () => {
  it('opens on the current tax year and fetches it', async () => {
    const loadRange = vi.fn().mockResolvedValue([]);
    render(<ReportDialog cached={[]} loadRange={loadRange} onClose={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Tax year' }).getAttribute('aria-checked')).toBe('true');
    const [from, to] = loadRange.mock.calls[0];
    expect([from.getMonth(), from.getDate(), to.getFullYear() - from.getFullYear()]).toEqual([3, 6, 1]);
    expect((screen.getByRole('button', { name: 'Next period' }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(screen.getByText(/leaving out hidden ones/)).toBeTruthy());
  });

  it('falls back to saved appointments when offline', async () => {
    const seen = { ...appt({ ag_invoiced: 'x', ag_paidBy: 'cash' }), start: new Date(Date.now() - 3_600_000).toISOString() };
    render(<ReportDialog cached={[seen]} loadRange={vi.fn().mockResolvedValue(null)} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/^Offline/)).toBeTruthy());
    const row = screen.getByText('Cash').closest('li')!;
    expect(row.textContent).toBe('Cash100%1');
  });
});

describe('StatusBanner', () => {
  const banner = (over: Partial<Parameters<typeof StatusBanner>[0]> = {}) => {
    const props = {
      connection: 'connected' as const,
      lastSync: null,
      syncing: false,
      pending: 0,
      error: null,
      onReconnect: vi.fn(),
      ...over,
    };
    const { container } = render(<StatusBanner {...props} />);
    return { root: container.firstElementChild!, props };
  };

  it('is green when connected', () => {
    const { root } = banner();
    expect(root.classList).toContain('status-connected');
    expect(root.textContent).toContain('Connected to Google.');
  });

  it('is amber offline and counts waiting changes', () => {
    const { root } = banner({ connection: 'offline', pending: 2 });
    expect(root.classList).toContain('status-offline');
    expect(root.textContent).toContain('Offline.');
    expect(root.textContent).toContain('2 changes waiting to upload.');
  });

  it('is red when signed out, with a Reconnect button', () => {
    const { root, props } = banner({ connection: 'signedOut', pending: 1 });
    expect(root.classList).toContain('status-signedOut');
    expect(root.textContent).toContain('1 change waiting to upload.');
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(props.onReconnect).toHaveBeenCalledOnce();
  });

  it('shows errors', () => {
    banner({ error: 'Google Calendar error 500' });
    expect(screen.getByText('Google Calendar error 500')).toBeTruthy();
  });

  describe('hiding', () => {
    afterEach(() => vi.useRealTimers());
    const settle = () => act(() => vi.advanceTimersByTime(HIDE_AFTER_MS));

    it('tucks away once connected with nothing to report', () => {
      vi.useFakeTimers();
      const { root } = banner();
      expect(root.classList).not.toContain('is-hidden');
      settle();
      expect(root.classList).toContain('is-hidden');
    });

    it('stays up while changes are waiting or there is an error', () => {
      vi.useFakeTimers();
      const { root: waiting } = banner({ pending: 1 });
      const { root: failed } = banner({ error: 'Google Calendar error 500' });
      settle();
      expect(waiting.classList).not.toContain('is-hidden');
      expect(failed.classList).not.toContain('is-hidden');
    });

    it('comes back when the connection drops', () => {
      vi.useFakeTimers();
      const props = { lastSync: null, syncing: false, pending: 0, error: null, onReconnect: vi.fn() };
      const { container, rerender } = render(<StatusBanner connection="connected" {...props} />);
      settle();
      rerender(<StatusBanner connection="offline" {...props} />);
      expect(container.firstElementChild!.classList).not.toContain('is-hidden');
    });
  });
});
