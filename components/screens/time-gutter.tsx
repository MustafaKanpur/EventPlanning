/**
 * The 92px left time column. Extracted so the run of show and the TIMELINE view type
 * render on literally the same component — a user-built timeline should read as part of
 * the app, not as a separate widget that happens to show times.
 */
export function TimeGutter({
  time,
  caption,
  muted = false,
}: {
  time: string;
  caption?: string;
  /** Projections and placeholders sit back a little from real schedule blocks. */
  muted?: boolean;
}) {
  return (
    <div className="w-[92px] shrink-0 border-r border-rule-soft px-4 py-4">
      <p
        className={`font-mono text-[14px] leading-none tabular-nums ${
          muted ? "text-ink-muted" : "text-ink"
        }`}
      >
        {time}
      </p>
      {caption && (
        <p className="mt-1 font-mono text-meta tabular-nums text-ink-muted">{caption}</p>
      )}
    </div>
  );
}
