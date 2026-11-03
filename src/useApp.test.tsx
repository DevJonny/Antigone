// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoogleEvent } from './calendar';
import type { Appointment } from './model';

const cache = vi.hoisted(() => new Map<string, unknown>());
vi.mock('./cache', () => ({
  readCache: async (key: string) => cache.get(key),
  writeCache: async (key: string, value: unknown) => void cache.set(key, value),
}));

vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123');
const { useApp } = await import('./useApp');

/** An in-memory stand-in for the parts of the Calendar API the app calls. */
class FakeCalendar {
  events = new Map<string, GoogleEvent>();
  requests: { method: string; path: string; body?: unknown }[] = [];
  status = 200;

  add(id: string, over: Partial<GoogleEvent> = {}) {
    this.events.set(id, {
      id,
      summary: 'Jane Smith',
      start: { dateTime: '2026-11-03T10:00:00Z' },
      end: { dateTime: '2026-11-03T11:00:00Z' },
      ...over,
    });
  }

  fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname.replace('/calendar/v3', '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    this.requests.push({ method, path, body });
    if (this.status !== 200) return new Response('{}', { status: this.status });

    const reply = (b: unknown) => new Response(JSON.stringify(b));
    if (path === '/users/me/calendarList') return reply({ items: [{ id: 'c1', summary: 'Work', primary: true }] });
    if (method === 'GET' && path === '/calendars/c1/events') return reply({ items: [...this.events.values()] });
    if (method === 'POST' && path === '/calendars/c1/events') {
      const ev = { ...body, id: `new${this.events.size}` } as GoogleEvent;
      this.events.set(ev.id, ev);
      return reply(ev);
    }
    const id = path.match(/^\/calendars\/c1\/events\/(.+)$/)?.[1];
    const ev = id && this.events.get(id);
    if (!ev) return new Response('{}', { status: 404 });
    if (method === 'PATCH') {
      const props: Record<string, string> = { ...ev.extendedProperties?.private };
      for (const [k, v] of Object.entries(body.extendedProperties.private)) {
        if (v === null) delete props[k];
        else props[k] = v as string;
      }
      ev.extendedProperties = { private: props };
    }
    return reply(ev);
  };

  patches = () => this.requests.filter((r) => r.method === 'PATCH');
}

let google: FakeCalendar;

const signIn = () =>
  localStorage.setItem('antigone.token', JSON.stringify({ accessToken: 'tok', expiresAt: Date.now() + 3600_000 }));

const cachedAppt = (props = {}): Appointment => ({
  id: 'e1',
  calendarId: 'c1',
  title: 'Jane Smith',
  start: '2026-11-03T10:00:00Z',
  end: '2026-11-03T11:00:00Z',
  allDay: false,
  props,
});

async function start() {
  const hook = renderHook(() => useApp());
  await waitFor(() => expect(hook.result.current.loaded).toBe(true));
  return hook;
}

beforeEach(() => {
  cache.clear();
  localStorage.clear();
  google = new FakeCalendar();
  google.add('e1');
  vi.stubGlobal('fetch', vi.fn(google.fetch));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('signed out', () => {
  it('shows the cached appointments and says so', async () => {
    cache.set('events', [cachedAppt()]);
    const { result } = await start();

    expect(result.current.connection).toBe('signedOut');
    expect(result.current.appointments.map((a) => a.id)).toEqual(['e1']);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('queues edits, applies them locally and keeps them in the cache', async () => {
    cache.set('events', [cachedAppt()]);
    const { result } = await start();

    act(() => result.current.edit(result.current.appointments[0], { ag_notes: '1' }));

    expect(result.current.appointments[0].props).toEqual({ ag_notes: '1' });
    expect(result.current.pending).toBe(1);
    await waitFor(() => expect(cache.get('queue')).toEqual([{ calendarId: 'c1', eventId: 'e1', props: { ag_notes: '1' } }]));
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('connected', () => {
  it('uploads queued edits before refreshing, then reports the sync', async () => {
    signIn();
    cache.set('events', [cachedAppt()]);
    cache.set('queue', [{ calendarId: 'c1', eventId: 'e1', props: { ag_notes: '1' } }]);
    const { result } = await start();

    await waitFor(() => expect(result.current.pending).toBe(0));
    await waitFor(() => expect(result.current.lastSync).not.toBeNull());

    expect(result.current.connection).toBe('connected');
    expect(google.requests[0]).toMatchObject({ method: 'PATCH', path: '/calendars/c1/events/e1' });
    expect(google.events.get('e1')?.extendedProperties?.private).toEqual({ ag_notes: '1' });
    expect(result.current.appointments[0].props).toEqual({ ag_notes: '1' });
  });

  it('selects the primary calendar on first sync', async () => {
    signIn();
    const { result } = await start();
    await waitFor(() => expect(result.current.selected).toEqual(['c1']));
    expect(result.current.appointments.map((a) => a.id)).toEqual(['e1']);
  });

  it('drops an edit for an event deleted from the calendar', async () => {
    signIn();
    cache.set('queue', [{ calendarId: 'c1', eventId: 'gone', props: { ag_notes: '1' } }]);
    const { result } = await start();
    await waitFor(() => expect(result.current.lastSync).not.toBeNull());
    expect(result.current.pending).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('signs out visibly when Google rejects the token, keeping the edit', async () => {
    signIn();
    cache.set('queue', [{ calendarId: 'c1', eventId: 'e1', props: { ag_notes: '1' } }]);
    google.status = 401;
    const { result } = await start();

    await waitFor(() => expect(result.current.connection).toBe('signedOut'));
    expect(result.current.pending).toBe(1);
    expect(localStorage.getItem('antigone.token')).toBeNull();
  });

  it('shows offline when the network is unreachable', async () => {
    signIn();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { result } = await start();
    await waitFor(() => expect(result.current.connection).toBe('offline'));
  });
});

describe('rebook', () => {
  it('creates the follow-up with the client link and marks the original', async () => {
    signIn();
    google.add('e1', { extendedProperties: { private: { ag_payLink: 'https://pay.example/jane' } } });
    const { result } = await start();
    await waitFor(() => expect(result.current.appointments).toHaveLength(1));

    await act(() => result.current.rebook(result.current.appointments[0], '2026-11-10T10:00'));

    const created = google.requests.find((r) => r.method === 'POST');
    expect(created?.body).toMatchObject({
      summary: 'Jane Smith',
      extendedProperties: { private: { ag_client: 'jane smith', ag_payLink: 'https://pay.example/jane' } },
    });
    await waitFor(() => expect(google.events.get('e1')?.extendedProperties?.private?.ag_rebooked).toBe('new1'));
    expect(result.current.appointments.map((a) => a.id)).toContain('new1');
  });

  it('refuses without a connection', async () => {
    cache.set('events', [cachedAppt()]);
    const { result } = await start();
    await expect(result.current.rebook(result.current.appointments[0], '2026-11-10T10:00')).rejects.toThrow(/Reconnect/);
    expect(fetch).not.toHaveBeenCalled();
  });
});
