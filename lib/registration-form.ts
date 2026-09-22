import type { FieldDefinition, FieldType, Prisma } from "@prisma/client";

import { prisma } from "./prisma";
import type { SelectOption } from "./screen-templates";

export type Answers = Record<string, unknown>;

/**
 * What a stranger can sensibly be asked on a public form.
 *
 * LINK and PERSON are excluded deliberately: they point at vendors, budget lines and
 * staff, which a registrant has no business picking from. CURRENCY is excluded because
 * the amount is the event's to set, not the registrant's to type.
 */
export const REGISTRATION_FIELD_TYPES: FieldType[] = [
  "TEXT",
  "LONG_TEXT",
  "NUMBER",
  "DATE",
  "CHECKBOX",
  "SELECT",
  "MULTI_SELECT",
  "EMAIL",
  "URL",
];

export function answersOf(registrant: { answers: unknown }): Answers {
  return (registrant.answers as Answers) ?? {};
}

export function choicesOf(field: FieldDefinition): SelectOption[] {
  return (field.options as { choices?: SelectOption[] } | null)?.choices ?? [];
}

/** The event's form definition, or null when nothing custom has been added yet. */
export async function getRegistrationForm(eventId: string) {
  return prisma.screenDefinition.findFirst({
    where: { eventId, isRegistrationForm: true },
    include: { fields: { orderBy: { position: "asc" } } },
  });
}

/** Same, but creates the (empty) definition so the builder has something to edit. */
export async function ensureRegistrationForm(eventId: string, createdById?: string | null) {
  const existing = await getRegistrationForm(eventId);
  if (existing) return existing;

  await prisma.screenDefinition.create({
    data: {
      eventId,
      name: "Registration form",
      viewType: "TABLE", // unused: this definition is rendered by the registration page
      isRegistrationForm: true,
      position: 999,
      createdById: createdById ?? null,
    },
  });
  return (await getRegistrationForm(eventId))!;
}

/**
 * Reads the public form's custom answers out of a submission. Mirrors the coercion the
 * composed-screen writer uses, so a date answer looks the same whichever side wrote it.
 */
export function parseAnswers(fields: FieldDefinition[], formData: FormData): Answers {
  const answers: Answers = {};
  for (const field of fields) {
    if (field.type === "CHECKBOX") {
      answers[field.key] = formData.get(field.key) === "on";
      continue;
    }
    if (field.type === "MULTI_SELECT") {
      const all = formData.getAll(field.key).filter((v): v is string => typeof v === "string");
      answers[field.key] = all.length ? all : null;
      continue;
    }
    const raw = formData.get(field.key);
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) {
      answers[field.key] = null;
      continue;
    }
    answers[field.key] = field.type === "NUMBER" ? Number(value) : value;
  }
  return answers;
}

/** Human-readable answer for a table cell. */
export function displayAnswer(field: FieldDefinition, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field.type === "CHECKBOX") return value === true ? "Yes" : "No";
  if (field.type === "SELECT" || field.type === "MULTI_SELECT") {
    const choices = choicesOf(field);
    const labelFor = (v: unknown) => choices.find((c) => c.value === v)?.label ?? String(v);
    return Array.isArray(value) ? value.map(labelFor).join(", ") : labelFor(value);
  }
  if (field.type === "DATE") {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime())
      ? String(value)
      : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  return String(value);
}

// ─────────────────────────────── filtering ───────────────────────────────

/** Query-param name for a field's filter. Prefixed to avoid clashing with `status`. */
export function filterParam(field: FieldDefinition): string {
  return `f_${field.key}`;
}

export type ActiveFilter = { field: FieldDefinition; value: string };

export function readFilters(
  fields: FieldDefinition[],
  searchParams: Record<string, string | string[] | undefined>,
): ActiveFilter[] {
  return fields.flatMap((field) => {
    const raw = searchParams[filterParam(field)];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value ? [{ field, value }] : [];
  });
}

/**
 * Applied in memory rather than in SQL. Answers live in a JSON column, and Postgres
 * JSON predicates would have to be built per field type; with registrant counts in the
 * hundreds this is simpler and behaves identically for every type.
 */
export function matchesFilters(answers: Answers, filters: ActiveFilter[]): boolean {
  return filters.every(({ field, value }) => {
    const actual = answers[field.key];
    switch (field.type) {
      case "CHECKBOX":
        return value === "yes" ? actual === true : actual !== true;
      case "SELECT":
        return actual === value;
      case "MULTI_SELECT":
        return Array.isArray(actual) && actual.includes(value);
      default:
        return String(actual ?? "")
          .toLowerCase()
          .includes(value.toLowerCase());
    }
  });
}

export function emptyAnswers(): Prisma.InputJsonValue {
  return {};
}
