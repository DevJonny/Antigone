export interface AgProps {
  ag_notes?: string;
  ag_invoiced?: string;
  ag_rebooked?: string;
  ag_hidden?: string;
  ag_client?: string;
  ag_payLink?: string;
}

/** A pending change to an event's private properties. `null` removes a value. */
export type AgPatch = { [K in keyof AgProps]?: string | null };

export interface Appointment {
  id: string;
  calendarId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  props: AgProps;
}

export interface Edit {
  calendarId: string;
  eventId: string;
  props: AgPatch;
}

export type Stage = 'start' | 'notes' | 'invoiced' | 'rebooked';

/** Steps count only in order, so a later step done early doesn't change the colour. */
export function stageOf(props: AgProps): Stage {
  if (!props.ag_notes) return 'start';
  if (!props.ag_invoiced) return 'notes';
  if (!props.ag_rebooked) return 'invoiced';
  return 'rebooked';
}

export function clientKey(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function findPayLink(target: Appointment, all: Appointment[]): string | undefined {
  if (target.props.ag_payLink) return target.props.ag_payLink;
  const key = clientKey(target.title);
  return all.find((a) => a.props.ag_payLink && (a.props.ag_client ?? clientKey(a.title)) === key)?.props.ag_payLink;
}

export function queueEdit(queue: Edit[], edit: Edit): Edit[] {
  const i = queue.findIndex((e) => e.calendarId === edit.calendarId && e.eventId === edit.eventId);
  if (i === -1) return [...queue, edit];
  const merged = { ...queue[i], props: { ...queue[i].props, ...edit.props } };
  return queue.map((e, j) => (j === i ? merged : e));
}

export function applyPatch(props: AgProps, patch: AgPatch): AgProps {
  const next: Record<string, string> = { ...props } as Record<string, string>;
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined) delete next[k];
    else next[k] = v;
  }
  return next as AgProps;
}

export function applyEdits(events: Appointment[], queue: Edit[]): Appointment[] {
  return events.map((a) => {
    const edit = queue.find((e) => e.calendarId === a.calendarId && e.eventId === a.id);
    return edit ? { ...a, props: applyPatch(a.props, edit.props) } : a;
  });
}
