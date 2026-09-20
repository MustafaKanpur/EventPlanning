import type { PlacedBlock } from "./run-of-show";

export type DayState = {
  now: PlacedBlock | null;
  next: PlacedBlock | null;
  later: PlacedBlock[];
  done: PlacedBlock[];
  /** Minutes left in the running block; null when nothing is running. */
  remainingMinutes: number | null;
};

/**
 * Splits the day around the current moment. Used only by the day-of view, where the
 * question is never "what's the schedule" but "what is happening right now, and what do
 * I need to be ready for".
 */
export function dayState(placed: PlacedBlock[], now: Date = new Date()): DayState {
  const sorted = [...placed].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const t = now.getTime();

  const current =
    sorted.find((b) => b.startTime.getTime() <= t && b.endTime.getTime() > t) ?? null;
  const upcoming = sorted.filter((b) => b.startTime.getTime() > t);
  const finished = sorted.filter((b) => b.endTime.getTime() <= t);

  return {
    now: current,
    next: upcoming[0] ?? null,
    later: upcoming.slice(1),
    done: finished,
    remainingMinutes: current
      ? Math.max(0, Math.round((current.endTime.getTime() - t) / 60000))
      : null,
  };
}

/** Whether the event is today at all — the view says so plainly rather than lying. */
export function isToday(date: Date, now: Date = new Date()): boolean {
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
