/** Counts of everything an event owns, as returned by Prisma's `_count`. */
export type EventContentCounts = {
  scheduleItems?: number;
  budgetLines?: number;
  registrants?: number;
  screens?: number;
};

const LABELS: [keyof EventContentCounts, string, string][] = [
  ["scheduleItems", "schedule item", "schedule items"],
  ["budgetLines", "budget line", "budget lines"],
  ["registrants", "registrant", "registrants"],
  ["screens", "screen", "screens"],
];

/**
 * "3 tasks · 1 budget line" — what a delete would take with it. Returns undefined when the
 * event is empty, so the confirmation doesn't claim more than it should.
 */
export function describeEventContents(counts: EventContentCounts): string | undefined {
  const parts = LABELS.filter(([key]) => (counts[key] ?? 0) > 0).map(([key, one, many]) => {
    const n = counts[key] as number;
    return `${n} ${n === 1 ? one : many}`;
  });
  return parts.length ? parts.join(" · ") : undefined;
}
