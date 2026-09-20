import type { Tone } from "./status-dot";

const FILL: Record<Tone, string> = {
  neutral: "bg-ink-muted",
  accent: "bg-accent",
  warn: "bg-warn",
  danger: "bg-danger",
  success: "bg-success",
};

/**
 * A 3px progress rule — no border, no label, no rounding. It always accompanies the
 * same ratio written out in text, so it's aria-hidden: announcing it again would just
 * make a screen reader read every row twice.
 */
export function MicroBar({
  value,
  max,
  color = "accent",
  className = "",
}: {
  value: number;
  max: number;
  color?: Tone;
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <span className={`block h-[3px] w-full bg-rule-soft ${className}`} aria-hidden="true">
      <span
        className={`block h-full ${FILL[color]}`}
        style={{ width: `${(ratio * 100).toFixed(2)}%` }}
      />
    </span>
  );
}
