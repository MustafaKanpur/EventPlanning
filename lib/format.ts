/** Anything Prisma might hand us for a Decimal column, plus the plain cases. */
export type NumericLike = number | string | { toString(): string } | null | undefined;

export function toNumber(value: NumericLike): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value: NumericLike, options?: { signed?: boolean }): string {
  const n = toNumber(value);
  if (n === null) return "—";
  const formatted = USD.format(Math.abs(n));
  if (n < 0) return `−${formatted}`; // U+2212, so minus signs align in a mono column
  return options?.signed ? `+${formatted}` : formatted;
}

/** "Sat 20 Sep" — the date shown in the top chrome. */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

/** "Sunday 8 November" — event subtitles. */
export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

/** "16:00" — 24h, so times sort and align in the run of show. */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * Whole days between two dates, counted by calendar day rather than elapsed hours —
 * an event tomorrow morning reads "1", not "0", regardless of the current time.
 */
export function daysUntil(target: Date, from: Date = new Date()): number {
  const a = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const b = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((a - b) / 86_400_000);
}

/** "5h 30m", "45m" — durations in the run of show. */
export function formatDuration(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Initials for the avatar. Prefers a real name; falls back to the local part of an
 * email so a member who hasn't set a name still gets something meaningful.
 */
export function initialsFrom(name?: string | null, email?: string | null): string {
  const source = name?.trim() || email?.split("@")[0]?.replace(/[._-]+/g, " ").trim() || "";
  if (!source) return "?";
  const words = source.split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

/** A display name that never shows the email twice. */
export function displayName(name?: string | null, email?: string | null): string {
  const trimmed = name?.trim();
  if (trimmed && trimmed !== email) return trimmed;
  return email ?? "Unknown";
}
