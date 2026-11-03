import { stageOf, type Appointment, type Stage } from './model';

export const STAGES: { stage: Stage; label: string }[] = [
  { stage: 'start', label: 'To do' },
  { stage: 'notes', label: 'Notes written' },
  { stage: 'invoiced', label: 'Invoiced' },
  { stage: 'rebooked', label: 'Rebooked' },
];

export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.stage, s.label])) as Record<Stage, string>;

/** Dismissed and completed entries stay out of the way until asked for. */
export const tucked = (a: Appointment) => Boolean(a.props.ag_hidden) || stageOf(a.props) === 'rebooked';

/** Local calendar day as `YYYY-MM-DD`, so keys sort and compare as strings. */
export const dayKey = (a: Appointment) => (a.allDay ? a.start : new Date(a.start).toLocaleDateString('en-CA'));

export interface ListOptions {
  hideTucked: boolean;
  stages: Stage[];
}

export function listView(appointments: Appointment[], { hideTucked, stages }: ListOptions) {
  const candidates = hideTucked ? appointments.filter((a) => !tucked(a)) : appointments;
  // Completed entries are already hidden, so their filter would only ever show nothing.
  const filters = hideTucked ? STAGES.filter((s) => s.stage !== 'rebooked') : STAGES;
  const counts = Object.fromEntries(
    STAGES.map(({ stage }) => [stage, candidates.filter((a) => stageOf(a.props) === stage).length]),
  ) as Record<Stage, number>;

  const groups = new Map<string, Appointment[]>();
  for (const a of candidates) {
    if (!stages.includes(stageOf(a.props))) continue;
    groups.set(dayKey(a), [...(groups.get(dayKey(a)) ?? []), a]);
  }

  return { candidates, filters, counts, days: [...groups] };
}
