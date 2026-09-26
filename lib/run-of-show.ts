import { formatTime } from "./format.ts";

/**
 * A nested task row. These are ScreenRecords from any CHECKLIST screen that links to
 * schedule blocks — not a Task model, which no longer exists. `screenName` is carried
 * so a second checklist ("AV Setup") renders under its own label alongside "Tasks".
 */
export type RunTask = {
  id: string;
  title: string;
  done: boolean;
  dueDate: Date | null;
  assigneeName: string | null;
  screenName: string;
  doneKey: string;
  overdue: boolean;
  lateDays: number;
};

export type RunBlock = {
  id: string;
  title: string;
  location: string | null;
  notes: string | null;
  startTime: Date | null;
  endTime: Date | null;
  tasks: RunTask[];
  budgetLine: { id: string; category: string; committed: number } | null;
};

/** A block that has a slot. Same shape, with the times narrowed to non-null. */
export type PlacedBlock = RunBlock & { startTime: Date; endTime: Date };

export type TimelineProjectionRow = {
  kind: "projection";
  recordId: string;
  screenId: string;
  screenName: string;
  title: string;
  when: Date;
};

export type TimelineRow =
  | { kind: "block"; block: PlacedBlock }
  | { kind: "gap"; start: Date; end: Date; minutes: number }
  | TimelineProjectionRow;

export function isPlaced(block: RunBlock): block is PlacedBlock {
  return block.startTime !== null && block.endTime !== null;
}

export function durationMinutes(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

/** Placed blocks in clock order; unplaced ones keep their creation order. */
export function splitBlocks(blocks: RunBlock[]): { placed: PlacedBlock[]; unplaced: RunBlock[] } {
  const placed = blocks.filter(isPlaced).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const unplaced = blocks.filter((b) => !isPlaced(b));
  return { placed, unplaced };
}

/**
 * Interleaves blocks with synthetic gap rows. Gaps are computed here, never stored —
 * they're a property of the schedule, so they can't drift out of date.
 *
 * `cursor` tracks the furthest end time seen rather than the previous block's end, so
 * a block nested inside a longer one doesn't manufacture a false gap behind it.
 */
export function buildTimeline(placed: PlacedBlock[]): TimelineRow[] {
  const rows: TimelineRow[] = [];
  let cursor: Date | null = null;

  for (const block of placed) {
    if (cursor && block.startTime.getTime() > cursor.getTime()) {
      rows.push({
        kind: "gap",
        start: cursor,
        end: block.startTime,
        minutes: durationMinutes(cursor, block.startTime),
      });
    }
    rows.push({ kind: "block", block });
    if (!cursor || block.endTime.getTime() > cursor.getTime()) cursor = block.endTime;
  }

  return rows;
}

/**
 * Threads projected records into the timeline in time order.
 *
 * Projections are deliberately merged *after* gap detection: they are not scheduled
 * programme, so a record sitting in an empty hour must not make that hour look
 * accounted for. The gap stays, and the projection renders inside it.
 */
export function mergeProjections(
  rows: TimelineRow[],
  projections: { recordId: string; screenId: string; screenName: string; title: string; when: Date }[],
): TimelineRow[] {
  if (projections.length === 0) return rows;

  const anchored = [...projections].sort((a, b) => a.when.getTime() - b.when.getTime());
  const out: TimelineRow[] = [];
  let next = 0;

  const rowStart = (row: TimelineRow): number | null => {
    if (row.kind === "block") return row.block.startTime.getTime();
    if (row.kind === "gap") return row.start.getTime();
    return row.when.getTime();
  };

  for (const row of rows) {
    const start = rowStart(row);
    while (next < anchored.length && start !== null && anchored[next].when.getTime() < start) {
      out.push({ kind: "projection", ...anchored[next] });
      next++;
    }
    out.push(row);
  }
  while (next < anchored.length) {
    out.push({ kind: "projection", ...anchored[next] });
    next++;
  }
  return out;
}

export function scheduleTotals(placed: PlacedBlock[]): {
  scheduledMinutes: number;
  unaccountedMinutes: number;
} {
  const scheduledMinutes = placed.reduce(
    (sum, b) => sum + durationMinutes(b.startTime, b.endTime),
    0,
  );
  const gaps = buildTimeline(placed).filter((r) => r.kind === "gap") as Extract<
    TimelineRow,
    { kind: "gap" }
  >[];
  return {
    scheduledMinutes,
    unaccountedMinutes: gaps.reduce((sum, g) => sum + g.minutes, 0),
  };
}

// Overdue lives in lib/records.ts now — one selector, shared by the dashboard, this
// rail and the day-of view. RunTask carries the already-computed result.
export function isOverdue(task: RunTask): boolean {
  return task.overdue;
}

export function daysLate(task: RunTask): number {
  return task.lateDays;
}

export type Blocker = {
  kind: "overdue" | "gap" | "overlap" | "unplaced";
  label: string;
  detail: string;
  href?: string;
};

/**
 * What stands between this schedule and a runnable event day. Everything here is derived
 * from the same rows the timeline renders, so the rail can never disagree with it.
 */
export function findBlockers(blocks: RunBlock[], options: { eventId: string }): Blocker[] {
  const { placed, unplaced } = splitBlocks(blocks);
  const blockers: Blocker[] = [];

  for (const block of blocks) {
    for (const task of block.tasks) {
      if (!isOverdue(task)) continue;
      const late = daysLate(task);
      blockers.push({
        kind: "overdue",
        label: task.title,
        detail: `${late} day${late === 1 ? "" : "s"} late · ${block.title}`,
        href: `/events/${options.eventId}/schedule`,
      });
    }
  }

  for (const row of buildTimeline(placed)) {
    if (row.kind !== "gap") continue;
    blockers.push({
      kind: "gap",
      label: `${row.minutes} min unscheduled`,
      detail: `${formatTime(row.start)} – ${formatTime(row.end)}`,
    });
  }

  // Two blocks claiming the same minutes is flagged, never prevented: organizers are free
  // to drop a block anywhere and sort the clash out afterwards.
  for (const { block, earlier } of findOverlaps(placed)) {
    blockers.push({
      kind: "overlap",
      label: `${block.title} overlaps ${earlier.title}`,
      detail: `${formatTime(block.startTime)} starts before ${formatTime(earlier.endTime)}`,
    });
  }

  if (unplaced.length) {
    blockers.push({
      kind: "unplaced",
      label: `${unplaced.length} block${unplaced.length === 1 ? "" : "s"} without a time`,
      detail: "Drag them onto the timeline",
    });
  }

  return blockers;
}

/**
 * Every pair of placed blocks whose times intersect, each reported once against the
 * earlier-starting block. Checks all earlier blocks, not just the previous one, so a
 * block inside a long one is still caught after a short one ends.
 * ponytail: O(n²), fine for a day's programme; sweep with an interval tree if it grows.
 */
export function findOverlaps(placed: PlacedBlock[]): { block: PlacedBlock; earlier: PlacedBlock }[] {
  const sorted = [...placed].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const pairs: { block: PlacedBlock; earlier: PlacedBlock }[] = [];
  sorted.forEach((block, i) => {
    for (const earlier of sorted.slice(0, i)) {
      if (block.startTime.getTime() < earlier.endTime.getTime()) pairs.push({ block, earlier });
    }
  });
  return pairs;
}

/** 18:30 -> "18:30"; the value an `<input type="time">` takes. */
export function minutesToTimeValue(minutes: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** "18:30" -> 1110, or null for anything that isn't a valid 24-hour time. */
export function timeValueToMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * The event's day at a time of day. Read in server-local time, like every other
 * datetime on the run of show.
 */
export function onEventDay(eventDate: Date, minutes: number): Date {
  const at = new Date(eventDate);
  at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return at;
}

/** Where an empty run of show opens: the event's start time, else 09:00. */
export const DEFAULT_START_MINUTES = 9 * 60;
