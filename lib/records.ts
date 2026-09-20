import type { FieldDefinition, LinkTarget, ScreenDefinition, ScreenRecord } from "@prisma/client";

import { prisma } from "./prisma";

export type RecordValues = Record<string, unknown>;

export type ScreenWithFields = ScreenDefinition & { fields: FieldDefinition[] };
export type LinkedRecord = ScreenRecord & {
  screen: ScreenWithFields;
  /** All of this record's links, so a caller can see its other connections too. */
  links: { fieldKey: string; targetType: LinkTarget; targetId: string }[];
};

export function valuesOf(record: { values: unknown }): RecordValues {
  return (record.values as RecordValues) ?? {};
}

export function readText(values: RecordValues, key: string): string {
  const v = values[key];
  return v === null || v === undefined ? "" : String(v);
}

export function readBool(values: RecordValues, key: string): boolean {
  return values[key] === true || values[key] === "true";
}

export function readDate(values: RecordValues, key: string): Date | null {
  const raw = values[key];
  if (!raw) return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A LINK/PERSON field's configured target, from its options blob. */
export function linkTargetOf(field: FieldDefinition): LinkTarget | null {
  const options = field.options as { targetType?: LinkTarget } | null;
  return options?.targetType ?? null;
}

export function fieldsLinkingTo(fields: FieldDefinition[], target: LinkTarget): FieldDefinition[] {
  return fields.filter(
    (f) => (f.type === "LINK" || f.type === "PERSON") && linkTargetOf(f) === target,
  );
}

// ─────────────────────────── the one link query ───────────────────────────

/**
 * Every "what points at this thing" question in the app goes through here: the run of
 * show asking for a block's tasks, the budget ledger asking what draws on a line, and
 * the "Referenced by" panel on any core object. Backed by RecordLink, never by scanning
 * ScreenRecord.values — the JSON blob is for rendering, not for querying.
 */
export async function getRecordsLinkedTo(
  targetType: LinkTarget,
  targetId: string,
): Promise<LinkedRecord[]> {
  const byTarget = await getRecordsLinkedToMany(targetType, [targetId]);
  return byTarget.get(targetId) ?? [];
}

/**
 * Batched form of the same query. A page rendering N blocks would otherwise issue N
 * lookups; this is the identical RecordLink path with an `in` clause, so the two can't
 * drift.
 */
export async function getRecordsLinkedToMany(
  targetType: LinkTarget,
  targetIds: string[],
): Promise<Map<string, LinkedRecord[]>> {
  const result = new Map<string, LinkedRecord[]>();
  if (targetIds.length === 0) return result;

  const links = await prisma.recordLink.findMany({
    where: { targetType, targetId: { in: targetIds } },
    include: {
      record: {
        include: {
          screen: { include: { fields: { orderBy: { position: "asc" } } } },
          links: { select: { fieldKey: true, targetType: true, targetId: true } },
        },
      },
    },
    orderBy: { record: { position: "asc" } },
  });

  for (const link of links) {
    const list = result.get(link.targetId) ?? [];
    list.push(link.record as LinkedRecord);
    result.set(link.targetId, list);
  }
  return result;
}

// ─────────────────────────── checklist semantics ───────────────────────────

export type ChecklistShape = { doneKey: string; dueKey: string | null };

/**
 * A checklist is defined by its shape, not its name: the first CHECKBOX field is the
 * completion flag and the first DATE is the deadline. Keying off shape is what lets a
 * user-built "Permits" checklist behave exactly like the seeded "Tasks" one, with no
 * configuration.
 */
export function checklistShape(fields: FieldDefinition[]): ChecklistShape | null {
  const done = fields.find((f) => f.type === "CHECKBOX");
  if (!done) return null;
  const due = fields.find((f) => f.type === "DATE" || f.type === "DATETIME");
  return { doneKey: done.key, dueKey: due?.key ?? null };
}

/** The label a checklist row shows — its first TEXT field, whatever it's called. */
export function titleKeyOf(fields: FieldDefinition[]): string | null {
  return fields.find((f) => f.type === "TEXT")?.key ?? fields[0]?.key ?? null;
}

/**
 * THE overdue rule, in one place: not done, and due before today. The dashboard, the
 * run-of-show rail and the day-of view all call this, so they cannot disagree about
 * what "overdue" means.
 */
export function isRecordOverdue(
  values: RecordValues,
  shape: ChecklistShape,
  now: Date = new Date(),
): boolean {
  if (!shape.dueKey) return false;
  if (readBool(values, shape.doneKey)) return false;
  const due = readDate(values, shape.dueKey);
  if (!due) return false;
  const dueDay = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return dueDay < today;
}

export function daysOverdue(
  values: RecordValues,
  shape: ChecklistShape,
  now: Date = new Date(),
): number {
  if (!shape.dueKey) return 0;
  const due = readDate(values, shape.dueKey);
  if (!due) return 0;
  const dueDay = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today - dueDay) / 86_400_000));
}

export function checklistProgress(
  records: { values: unknown }[],
  shape: ChecklistShape,
): { done: number; total: number } {
  const done = records.filter((r) => readBool(valuesOf(r), shape.doneKey)).length;
  return { done, total: records.length };
}

// ───────────────────── every checklist across an event ─────────────────────

export type ChecklistScreen = ScreenWithFields & {
  records: ScreenRecord[];
  shape: ChecklistShape;
};

/**
 * All of an event's checklists, seeded or user-built. The dashboard counts overdue
 * items across every one of these, so a team that builds "Permits" as a checklist gets
 * its overdue permits surfaced without configuring anything.
 */
export async function getChecklistScreens(eventId: string): Promise<ChecklistScreen[]> {
  const screens = await prisma.screenDefinition.findMany({
    where: { eventId, viewType: "CHECKLIST" },
    include: {
      fields: { orderBy: { position: "asc" } },
      records: { orderBy: { position: "asc" } },
    },
    orderBy: { position: "asc" },
  });

  return screens.flatMap((screen) => {
    const shape = checklistShape(screen.fields);
    return shape ? [{ ...screen, shape }] : [];
  });
}

export function countOverdue(screens: ChecklistScreen[], now: Date = new Date()) {
  let count = 0;
  const items: { title: string; screenName: string; days: number }[] = [];
  for (const screen of screens) {
    const titleKey = titleKeyOf(screen.fields);
    for (const record of screen.records) {
      const values = valuesOf(record);
      if (!isRecordOverdue(values, screen.shape, now)) continue;
      count++;
      items.push({
        title: titleKey ? readText(values, titleKey) : "Untitled",
        screenName: screen.name,
        days: daysOverdue(values, screen.shape, now),
      });
    }
  }
  items.sort((a, b) => b.days - a.days);
  return { count, items };
}

export function checklistTotals(screens: ChecklistScreen[]) {
  let done = 0;
  let total = 0;
  for (const screen of screens) {
    const progress = checklistProgress(screen.records, screen.shape);
    done += progress.done;
    total += progress.total;
  }
  return { done, total };
}
