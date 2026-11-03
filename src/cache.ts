import { get, set } from 'idb-keyval';
import type { CalendarInfo } from './calendar';
import type { Appointment, Edit } from './model';

interface Cached {
  events: Appointment[];
  queue: Edit[];
  lastSync: number | null;
  calendars: CalendarInfo[];
  selected: string[] | null;
}

// IndexedDB can be unavailable (private windows, cleared site data), so every
// access falls back to an empty cache rather than breaking the app.
export async function readCache<K extends keyof Cached>(key: K): Promise<Cached[K] | undefined> {
  try {
    return await get<Cached[K]>(key);
  } catch {
    return undefined;
  }
}

export async function writeCache<K extends keyof Cached>(key: K, value: Cached[K]) {
  try {
    await set(key, value);
  } catch {
    // Nothing to do; the app still works from memory.
  }
}
