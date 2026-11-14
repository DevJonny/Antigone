import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { connect, consumeRedirect, forgetToken, isConfigured, isValid, loadToken, type Token } from './auth';
import { readCache, writeCache } from './cache';
import {
  AuthError,
  getEvent,
  insertEvent,
  listCalendars,
  listEvents,
  NotFoundError,
  patchProps,
  type CalendarInfo,
} from './calendar';
import { applyEdits, clientKey, findPayLink, queueEdit, type AgPatch, type Appointment, type Edit, type PayMethod } from './model';
import { rebookBody } from './rebook';

export type Connection = 'unconfigured' | 'connected' | 'offline' | 'signedOut';

const WINDOW_DAYS = 90;
const REFRESH_MS = 5 * 60_000;
const RETRY_MS = 30_000;

const byStart = (a: Appointment, b: Appointment) => Date.parse(a.start) - Date.parse(b.start);

// Read once at startup, before React renders, so StrictMode's double render can't consume it twice.
const redirect = consumeRedirect();

export function useApp() {
  const [token, setToken] = useState<Token | null>(() => redirect.token ?? loadToken());
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);
  // Set when a request fails at the network level although the browser says it's online.
  const [unreachable, setUnreachable] = useState(false);
  const [events, setEvents] = useState<Appointment[]>([]);
  const [queue, setQueue] = useState<Edit[]>([]);
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(redirect.error ?? null);
  const [loaded, setLoaded] = useState(false);

  // Async work reads the latest values from refs rather than stale closures.
  const tokenRef = useRef(token);
  const queueRef = useRef(queue);
  const selectedRef = useRef(selected);
  const busy = useRef(false);
  tokenRef.current = token;
  selectedRef.current = selected;

  const updateQueue = useCallback((fn: (q: Edit[]) => Edit[]) => {
    queueRef.current = fn(queueRef.current);
    setQueue(queueRef.current);
  }, []);

  const replaceEvent = useCallback((appt: Appointment) => {
    setEvents((all) => all.map((a) => (a.calendarId === appt.calendarId && a.id === appt.id ? appt : a)));
  }, []);

  useEffect(() => {
    void (async () => {
      const [ev, q, last, cals, sel] = await Promise.all([
        readCache('events'),
        readCache('queue'),
        readCache('lastSync'),
        readCache('calendars'),
        readCache('selected'),
      ]);
      setEvents(ev ?? []);
      // Edits made before the cache finished loading go on top of the cached ones.
      updateQueue((current) => current.reduce(queueEdit, q ?? []));
      setLastSync(last ?? null);
      setCalendars(cals ?? []);
      setSelected(sel ?? null);
      setLoaded(true);
    })();
  }, [updateQueue]);

  useEffect(() => {
    if (!loaded) return;
    void writeCache('events', events);
    void writeCache('queue', queue);
    void writeCache('lastSync', lastSync);
    void writeCache('calendars', calendars);
    void writeCache('selected', selected);
  }, [loaded, events, queue, lastSync, calendars, selected]);

  const fail = useCallback((e: unknown) => {
    if (e instanceof AuthError) {
      forgetToken();
      setToken(null);
    } else if (e instanceof TypeError) {
      // fetch rejects with a TypeError when the network can't be reached.
      setUnreachable(true);
    } else {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const flush = useCallback(async (t: Token) => {
    for (const edit of queueRef.current) {
      try {
        replaceEvent(await patchProps(t.accessToken, edit.calendarId, edit.eventId, edit.props));
      } catch (e) {
        // A deleted event can never take the edit, so drop it.
        if (!(e instanceof NotFoundError)) throw e;
      }
      // Only drop the edit if nothing new was merged into it while it was in flight.
      updateQueue((q) => q.filter((e) => e !== edit));
    }
  }, [replaceEvent, updateQueue]);

  const sync = useCallback(async () => {
    const t = tokenRef.current;
    if (!isValid(t) || !navigator.onLine || busy.current) return;
    busy.current = true;
    setSyncing(true);
    try {
      await flush(t);
      const cals = await listCalendars(t.accessToken);
      setCalendars(cals);
      const ids = selectedRef.current ?? cals.filter((c) => c.primary).map((c) => c.id);
      if (!selectedRef.current) setSelected(ids);
      const now = Date.now();
      const min = new Date(now - WINDOW_DAYS * 86_400_000);
      const max = new Date(now + WINDOW_DAYS * 86_400_000);
      const lists = await Promise.all(ids.map((id) => listEvents(t.accessToken, id, min, max)));
      setEvents(lists.flat().sort(byStart));
      setLastSync(Date.now());
      setUnreachable(false);
      setError(null);
    } catch (e) {
      fail(e);
    } finally {
      busy.current = false;
      setSyncing(false);
    }
  }, [flush, fail]);

  // Expire the session visibly the moment Google's token runs out.
  useEffect(() => {
    if (!token) return;
    const id = setTimeout(() => setToken(null), Math.max(0, token.expiresAt - 60_000 - Date.now()));
    return () => clearTimeout(id);
  }, [token]);

  useEffect(() => {
    if (loaded && token) void sync();
  }, [loaded, token, sync]);

  useEffect(() => {
    const online = () => {
      setBrowserOnline(true);
      setUnreachable(false);
      void sync();
    };
    const offline = () => setBrowserOnline(false);
    const visible = () => document.visibilityState === 'visible' && void sync();
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [sync]);

  useEffect(() => {
    const id = setInterval(() => void sync(), unreachable ? RETRY_MS : REFRESH_MS);
    return () => clearInterval(id);
  }, [sync, unreachable]);

  const connection: Connection = !isConfigured
    ? 'unconfigured'
    : !browserOnline || unreachable
      ? 'offline'
      : !token
        ? 'signedOut'
        : 'connected';

  const appointments = useMemo(() => applyEdits(events, queue), [events, queue]);

  // Leaves the page; queued edits and the cache are already in IndexedDB.
  const reconnect = connect;

  const edit = useCallback((appt: Appointment, props: AgPatch) => {
    updateQueue((q) => queueEdit(q, { calendarId: appt.calendarId, eventId: appt.id, props }));
    void sync();
  }, [updateQueue, sync]);

  const markInvoiced = useCallback((appt: Appointment, payLink: string) => {
    edit(appt, { ag_invoiced: new Date().toISOString(), ag_paidBy: 'link', ag_cash: null, ag_payLink: payLink, ag_client: clientKey(appt.title) });
  }, [edit]);

  /** Cash and bank transfer count as invoiced; the client's payment link is left as it is. */
  const markPaid = useCallback((appt: Appointment, method: Exclude<PayMethod, 'link'>) => {
    edit(appt, { ag_invoiced: new Date().toISOString(), ag_paidBy: method, ag_cash: null, ag_client: clientKey(appt.title) });
  }, [edit]);

  /** Needs a live connection: the new event's ID must exist before the original can point to it. */
  const rebook = useCallback(async (appt: Appointment, newStart: string) => {
    const t = tokenRef.current;
    if (!isValid(t)) throw new Error('Reconnect to Google to rebook.');
    try {
      const original = await getEvent(t.accessToken, appt.calendarId, appt.id);
      const payLink = findPayLink(appt, appointments);
      const created = await insertEvent(
        t.accessToken,
        appt.calendarId,
        rebookBody(original, newStart, { ag_client: clientKey(appt.title), ...(payLink && { ag_payLink: payLink }) }),
      );
      setEvents((all) => [...all, created].sort(byStart));
      edit(appt, { ag_rebooked: created.id });
    } catch (e) {
      fail(e);
      throw e;
    }
  }, [appointments, edit, fail]);

  const chooseCalendars = useCallback((ids: string[]) => {
    selectedRef.current = ids;
    setSelected(ids);
    void sync();
  }, [sync]);

  return {
    connection,
    appointments,
    calendars,
    selected: selected ?? [],
    lastSync,
    syncing,
    pending: queue.length,
    error,
    loaded,
    reconnect,
    sync,
    edit,
    markInvoiced,
    markPaid,
    rebook,
    chooseCalendars,
  };
}
