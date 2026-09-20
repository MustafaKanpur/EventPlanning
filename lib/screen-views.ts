import type { FieldDefinition, FieldType, ViewType } from "@prisma/client";

import type { SelectOption } from "./screen-templates";

/**
 * What each view type needs before it can render anything. When a screen doesn't have
 * the field, the view offers to create it rather than refusing to draw — a view type is
 * a choice about presentation, not a wall.
 */
export type ViewRequirement = {
  types: FieldType[];
  /** Copy for the inline prompt. */
  need: string;
  suggestLabel: string;
  suggestType: FieldType;
};

export const VIEW_REQUIREMENTS: Partial<Record<ViewType, ViewRequirement>> = {
  BOARD: {
    types: ["SELECT"],
    need: "a Select field to group the columns by",
    suggestLabel: "Status",
    suggestType: "SELECT",
  },
  TIMELINE: {
    types: ["DATE", "DATETIME"],
    need: "a Date field to place records on the timeline",
    suggestLabel: "When",
    suggestType: "DATETIME",
  },
  CALENDAR: {
    types: ["DATE", "DATETIME"],
    need: "a Date field to place records in the month",
    suggestLabel: "Date",
    suggestType: "DATE",
  },
  CHECKLIST: {
    types: ["CHECKBOX"],
    need: "a Checkbox field to track completion",
    suggestLabel: "Done",
    suggestType: "CHECKBOX",
  },
  LEDGER: {
    types: ["CURRENCY"],
    need: "a Currency field to total",
    suggestLabel: "Amount",
    suggestType: "CURRENCY",
  },
};

export function missingRequirement(
  viewType: ViewType,
  fields: FieldDefinition[],
): ViewRequirement | null {
  const requirement = VIEW_REQUIREMENTS[viewType];
  if (!requirement) return null;
  const satisfied = fields.some((f) => requirement.types.includes(f.type));
  return satisfied ? null : requirement;
}

/** The SELECT field a board groups by: the chosen one, else the first available. */
export function groupField(
  fields: FieldDefinition[],
  groupByFieldKey: string | null,
): FieldDefinition | null {
  if (groupByFieldKey) {
    const chosen = fields.find((f) => f.key === groupByFieldKey && f.type === "SELECT");
    if (chosen) return chosen;
  }
  return fields.find((f) => f.type === "SELECT") ?? null;
}

/** The date field a timeline or calendar places records by. */
export function dateField(fields: FieldDefinition[]): FieldDefinition | null {
  return fields.find((f) => f.type === "DATETIME" || f.type === "DATE") ?? null;
}

export function currencyFields(fields: FieldDefinition[]): FieldDefinition[] {
  return fields.filter((f) => f.type === "CURRENCY");
}

export function choicesOf(field: FieldDefinition | null): SelectOption[] {
  if (!field) return [];
  return (field.options as { choices?: SelectOption[] } | null)?.choices ?? [];
}

// ─────────────────────────────── calendar grid ───────────────────────────────

export type CalendarCell = { date: Date; inMonth: boolean };

/**
 * Six weeks of cells covering the given month, starting Monday. Always six rows so the
 * grid doesn't change height between months.
 */
export function monthGrid(month: Date): CalendarCell[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Monday-first
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return { date, inMonth: date.getMonth() === month.getMonth() };
  });
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "2026-11" → Date, falling back to the given default. */
export function parseMonth(value: string | undefined, fallback: Date): Date {
  if (!value) return new Date(fallback.getFullYear(), fallback.getMonth(), 1);
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return new Date(fallback.getFullYear(), fallback.getMonth(), 1);
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
