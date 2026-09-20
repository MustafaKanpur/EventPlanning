export type Tone = "neutral" | "accent" | "warn" | "danger" | "success";

const DOT: Record<Tone, string> = {
  neutral: "bg-ink-muted",
  accent: "bg-accent",
  warn: "bg-warn",
  danger: "bg-danger",
  success: "bg-success",
};

/**
 * Known statuses across the app's enums. Anything unrecognised falls back to neutral,
 * so a new enum value degrades to a grey dot rather than throwing.
 */
const TONE_BY_STATUS: Record<string, Tone> = {
  // Event
  DRAFT: "neutral",
  PLANNING: "accent",
  ACTIVE: "success",
  COMPLETED: "neutral",
  CANCELLED: "danger",
  // Task
  TODO: "neutral",
  IN_PROGRESS: "accent",
  BLOCKED: "danger",
  DONE: "success",
  // Payment
  UNPAID: "danger",
  PENDING: "warn",
  PAID: "success",
  REFUNDED: "neutral",
  // Screen library
  SAVED: "success",
};

export function toneForStatus(status: string): Tone {
  return TONE_BY_STATUS[status.toUpperCase()] ?? "neutral";
}

/**
 * Replaces the old pill badges. The dot carries the colour and the label stays
 * ink-muted — `success` only reaches 3.4:1 on our surfaces, so it can tint a 6px dot
 * but must never be the text itself. `danger` clears AA, so it does colour its label.
 */
export function StatusDot({
  status,
  label,
  tone,
  className = "",
}: {
  status: string;
  label?: string;
  tone?: Tone;
  className?: string;
}) {
  const resolved = tone ?? toneForStatus(status);
  const text = label ?? status.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[resolved]}`} aria-hidden="true" />
      <span
        className={`text-micro uppercase ${resolved === "danger" ? "text-danger" : "text-ink-muted"}`}
      >
        {text}
      </span>
    </span>
  );
}
