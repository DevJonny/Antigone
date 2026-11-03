// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgProps, Appointment } from '../model';
import { AppointmentCard } from './AppointmentCard';
import { StatusBanner } from './StatusBanner';

afterEach(cleanup);

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
    [{ ag_notes: '1', ag_invoiced: 'x', ag_rebooked: 'e2' }, 'stage-rebooked', 'Rebooked'],
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

  it('offers to unhide a dismissed entry', () => {
    const { card } = renderCard({ ag_hidden: '1' });
    expect(card.classList).toContain('is-hidden');
    expect(screen.getByRole('button', { name: 'Unhide' })).toBeTruthy();
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
      onRefresh: vi.fn(),
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
});
