import { daysUntil } from "@/lib/format";

/**
 * Time pressure, stated plainly. Under a fortnight it turns danger — that threshold is
 * the point of the component: an event team should feel the deadline from the list view.
 *
 * `now` is injectable so callers can pass a stable date; by default this reads the
 * server clock at render, which is fine for day-granularity.
 */
export function Countdown({
  date,
  now,
  size = "md",
  className = "",
}: {
  date: Date;
  now?: Date;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const days = daysUntil(date, now);
  const urgent = days < 14;

  const figureSize =
    size === "lg" ? "text-[34px] leading-none" : size === "sm" ? "text-[15px]" : "text-[22px]";

  if (days === 0) {
    return (
      <span className={`inline-flex flex-col ${className}`}>
        <span className={`font-mono uppercase tabular-nums text-danger ${figureSize}`}>Today</span>
        <span className="text-meta text-ink-muted">event day</span>
      </span>
    );
  }

  const past = days < 0;
  return (
    <span className={`inline-flex flex-col ${className}`}>
      <span
        className={`font-mono tabular-nums ${figureSize} ${
          urgent && !past ? "text-danger" : past ? "text-ink-muted" : "text-ink"
        }`}
      >
        {Math.abs(days)}
      </span>
      <span className="text-meta text-ink-muted">{past ? "days ago" : "days out"}</span>
    </span>
  );
}
