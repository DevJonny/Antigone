import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthError, listEvents, NotFoundError, patchProps, toAppointment, type GoogleEvent } from './calendar';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function mockFetch(...responses: Response[]) {
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (const r of responses) fetch.mockResolvedValueOnce(r);
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const event = (id: string, over: Partial<GoogleEvent> = {}): GoogleEvent => ({
  id,
  summary: id,
  start: { dateTime: '2026-11-03T10:00:00Z' },
  end: { dateTime: '2026-11-03T11:00:00Z' },
  ...over,
});

describe('toAppointment', () => {
  it('maps a timed event and its private properties', () => {
    const appt = toAppointment('c1', event('e1', { extendedProperties: { private: { ag_notes: '1' } } }));
    expect(appt).toEqual({
      id: 'e1',
      calendarId: 'c1',
      title: 'e1',
      start: '2026-11-03T10:00:00Z',
      end: '2026-11-03T11:00:00Z',
      allDay: false,
      props: { ag_notes: '1' },
    });
  });

  it('maps an all-day event without a title', () => {
    const appt = toAppointment('c1', { id: 'e1', start: { date: '2026-11-03' }, end: { date: '2026-11-04' } });
    expect(appt).toMatchObject({ title: '(No title)', start: '2026-11-03', allDay: true, props: {} });
  });
});

describe('listEvents', () => {
  it('follows pages and drops cancelled events', async () => {
    const fetch = mockFetch(
      json({ items: [event('a'), event('b', { status: 'cancelled' })], nextPageToken: 'p2' }),
      json({ items: [event('c')] }),
    );

    const appts = await listEvents('tok', 'me@x.com', new Date('2026-08-01'), new Date('2027-02-01'));

    expect(appts.map((a) => a.id)).toEqual(['a', 'c']);
    const [first, second] = fetch.mock.calls.map(([url]) => new URL(String(url)));
    expect(first.pathname).toBe('/calendar/v3/calendars/me%40x.com/events');
    expect(first.searchParams.get('singleEvents')).toBe('true');
    expect(second.searchParams.get('pageToken')).toBe('p2');
    expect(fetch.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer tok' });
  });
});

describe('patchProps', () => {
  it('sends only the changed private properties', async () => {
    const fetch = mockFetch(json(event('e1', { extendedProperties: { private: { ag_invoiced: 'x' } } })));

    const appt = await patchProps('tok', 'c1', 'e1', { ag_invoiced: 'x', ag_notes: null });

    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe('https://www.googleapis.com/calendar/v3/calendars/c1/events/e1');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({ extendedProperties: { private: { ag_invoiced: 'x', ag_notes: null } } });
    expect(appt.props).toEqual({ ag_invoiced: 'x' });
  });

  it('raises AuthError when the token is rejected', async () => {
    mockFetch(json({}, 401));
    await expect(patchProps('tok', 'c1', 'e1', {})).rejects.toBeInstanceOf(AuthError);
  });

  it('raises NotFoundError for a deleted event', async () => {
    mockFetch(json({}, 410));
    await expect(patchProps('tok', 'c1', 'e1', {})).rejects.toBeInstanceOf(NotFoundError);
  });
});
