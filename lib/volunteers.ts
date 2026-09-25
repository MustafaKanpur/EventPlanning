// Kept free of runtime imports so lib/volunteers.check.mjs can run it with plain Node.

export const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"];

/**
 * Whole years old on `on`. A birth date comes from `<input type="date">`, which parses as
 * UTC midnight, so it's read in UTC; `on` is a shift time, read in server-local time like
 * every other datetime-local in the app.
 */
export function ageOn(birthDate: Date, on: Date): number {
  let age = on.getFullYear() - birthDate.getUTCFullYear();
  const m = on.getMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && on.getDate() < birthDate.getUTCDate())) age--;
  return age;
}

type ShiftRules = {
  startTime: Date;
  capacity: number;
  minAge: number | null;
  gender: string | null;
  minHours: number | null;
};

type Applicant = { birthDate: Date | null; gender: string | null; approvedHours: number };

/** Why this person can't take this shift, or null if they can. Age is measured on the shift's day. */
export function shiftBlocker(shift: ShiftRules, taken: number, who: Applicant): string | null {
  if (taken >= shift.capacity) return "This shift is full.";
  if (shift.minAge !== null) {
    if (!who.birthDate) return "This shift needs your date of birth.";
    if (ageOn(who.birthDate, shift.startTime) < shift.minAge) {
      return `This shift is for volunteers aged ${shift.minAge} or over.`;
    }
  }
  if (shift.gender && who.gender !== shift.gender) return `This shift is for ${shift.gender} volunteers.`;
  if (shift.minHours !== null && who.approvedHours < shift.minHours) {
    return `This shift needs at least ${shift.minHours} approved volunteer hours.`;
  }
  return null;
}

/** "Min age 18 · Female · 10h experience" — the rules as one line, or "" when there are none. */
export function describeRules(shift: Pick<ShiftRules, "minAge" | "gender" | "minHours">): string {
  return [
    shift.minAge !== null && `Age ${shift.minAge}+`,
    shift.gender,
    shift.minHours !== null && `${shift.minHours}h+ experience`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Optional whole-number form field: blank means "no rule". */
export function optionalInt(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Optional `<input type="date">` value. */
export function optionalDate(value: FormDataEntryValue | null): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The volunteer details every volunteer form collects (see components/volunteer-fields.tsx). */
export function readVolunteerForm(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const gender = text("gender");
  return {
    name: text("name"),
    email: text("email").toLowerCase(),
    phone: text("phone") || null,
    address: text("address") || null,
    birthDate: optionalDate(formData.get("birthDate")),
    gender: GENDERS.includes(gender) ? gender : null,
  };
}

/** `Date` → `<input type="date">` value, in UTC to match how that input parses. */
export function dateInputValue(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

/** "3 Mar 2024". UTC, because date-only values are stored as UTC midnight. */
export function formatDay(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
