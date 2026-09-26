import "server-only";

import type { DraftContext } from "./run-of-show.ts";
import type { ProposedBlock } from "./tools.ts";

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHHMM = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

type Span = { title: string; start: number; end: number };

/**
 * What the check_schedule tool reports. Deterministic, and only facts: whether a clash
 * is a mistake or intended (a reception running alongside a talk) is the model's call.
 * Kept short on purpose; every line is resent on each later turn.
 */
export function checkSchedule(ctx: DraftContext, blocks: ProposedBlock[]): string[] {
  const issues: string[] = [];

  const drafted: Span[] = blocks.flatMap((b) =>
    b.suggestedStart
      ? [{ title: b.title, start: toMinutes(b.suggestedStart), end: toMinutes(b.suggestedStart) + b.durationMinutes }]
      : [],
  );
  const existing: Span[] = ctx.existingBlocks.flatMap((b) =>
    b.start && b.end ? [{ title: b.title, start: toMinutes(b.start), end: toMinutes(b.end) }] : [],
  );

  drafted.forEach((a, i) => {
    for (const b of drafted.slice(i + 1)) {
      if (a.start < b.end && b.start < a.end) {
        issues.push(`"${a.title}" (${toHHMM(a.start)}–${toHHMM(a.end)}) overlaps "${b.title}" (${toHHMM(b.start)}–${toHHMM(b.end)}).`);
      }
    }
    for (const b of existing) {
      if (a.start < b.end && b.start < a.end) {
        issues.push(`"${a.title}" clashes with existing block "${b.title}" (${toHHMM(b.start)}–${toHHMM(b.end)}).`);
      }
    }
    if (a.end > 24 * 60) issues.push(`"${a.title}" runs past midnight.`);
  });

  const taken = new Set(ctx.existingBlocks.map((b) => b.title.trim().toLowerCase()));
  for (const b of blocks) {
    if (taken.has(b.title.trim().toLowerCase())) issues.push(`"${b.title}" already exists on this event.`);
  }

  if (drafted.length) {
    const first = Math.min(...drafted.map((s) => s.start));
    const last = Math.max(...drafted.map((s) => s.end));
    const span = last - first;
    // Not an issue by itself: reported so the model can compare it with the request.
    issues.push(
      `Timed blocks span ${toHHMM(first)}–${toHHMM(last % (24 * 60))} (${Math.floor(span / 60)}h ${span % 60}m). Check this matches the requested length.`,
    );
  }
  const untimed = blocks.length - drafted.length;
  if (untimed) issues.push(`${untimed} block${untimed === 1 ? " has" : "s have"} no suggested time and can't be checked.`);

  return issues;
}
