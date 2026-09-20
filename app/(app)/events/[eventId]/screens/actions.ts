"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FieldDefinition, Prisma } from "@prisma/client";

import { getCurrentTeamMember } from "@/lib/current-team-member";
import { prisma } from "@/lib/prisma";
import { linkTargetOf, valuesOf, type RecordValues } from "@/lib/records";

async function requireMember() {
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");
  return me;
}

/** Composed screens can surface anywhere, so a write refreshes the whole event. */
function revalidateEvent(eventId: string) {
  revalidatePath(`/events/${eventId}`, "layout");
  revalidatePath("/dashboard");
}

/**
 * Coerce a submitted string into the shape the field stores. Checkboxes arrive as
 * "on"/absent from forms and as "true"/"false" from the inline toggle.
 */
function coerce(field: FieldDefinition, raw: FormDataEntryValue | null): unknown {
  const text = typeof raw === "string" ? raw.trim() : "";
  switch (field.type) {
    case "CHECKBOX":
      return raw === "on" || raw === "true";
    case "NUMBER":
    case "CURRENCY":
    case "DURATION": {
      if (!text) return null;
      const n = Number(text);
      return Number.isFinite(n) ? n : null;
    }
    default:
      return text || null;
  }
}

/**
 * Rewrites the record's links from its values. Relationship state lives in RecordLink;
 * values keep a copy only so the cell can render without a join. Doing both in one
 * transaction is what stops them drifting.
 */
async function syncLinks(
  tx: Prisma.TransactionClient,
  recordId: string,
  fields: FieldDefinition[],
  values: RecordValues,
) {
  const linkFields = fields.filter((f) => f.type === "LINK" || f.type === "PERSON");
  if (linkFields.length === 0) return;

  await tx.recordLink.deleteMany({
    where: { recordId, fieldKey: { in: linkFields.map((f) => f.key) } },
  });

  const rows = linkFields.flatMap((field) => {
    const target = linkTargetOf(field);
    if (!target) return [];
    const value = values[field.key];
    const ids = Array.isArray(value) ? value : value ? [value] : [];
    return ids
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .map((id) => ({ recordId, fieldKey: field.key, targetType: target, targetId: id }));
  });

  if (rows.length) await tx.recordLink.createMany({ data: rows, skipDuplicates: true });
}

async function loadScreen(screenId: string) {
  return prisma.screenDefinition.findUniqueOrThrow({
    where: { id: screenId },
    include: { fields: { orderBy: { position: "asc" } } },
  });
}

export async function createRecord(eventId: string, screenId: string, formData: FormData) {
  await requireMember();
  const screen = await loadScreen(screenId);

  const values: RecordValues = {};
  for (const field of screen.fields) {
    values[field.key] = coerce(field, formData.get(field.key));
  }

  const last = await prisma.screenRecord.findFirst({
    where: { screenId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.$transaction(async (tx) => {
    const record = await tx.screenRecord.create({
      data: { screenId, values: values as Prisma.InputJsonValue, position: (last?.position ?? 0) + 1 },
    });
    await syncLinks(tx, record.id, screen.fields, values);
  });

  revalidateEvent(eventId);
}

/**
 * Inline cell edit: merges one field into the record rather than replacing the blob,
 * so two people editing different columns don't clobber each other.
 */
export async function updateCell(
  eventId: string,
  recordId: string,
  fieldKey: string,
  formData: FormData,
) {
  await requireMember();

  const record = await prisma.screenRecord.findUniqueOrThrow({
    where: { id: recordId },
    include: { screen: { include: { fields: true } } },
  });
  const field = record.screen.fields.find((f) => f.key === fieldKey);
  if (!field) return;

  const values = { ...valuesOf(record), [fieldKey]: coerce(field, formData.get("value")) };

  await prisma.$transaction(async (tx) => {
    await tx.screenRecord.update({
      where: { id: recordId },
      data: { values: values as Prisma.InputJsonValue },
    });
    await syncLinks(tx, recordId, record.screen.fields, values);
  });

  revalidateEvent(eventId);
}

/** Checkbox toggle — the one write path shared by the checklist view and the run of show. */
export async function toggleRecordCheckbox(
  eventId: string,
  recordId: string,
  fieldKey: string,
  next: boolean,
) {
  await requireMember();

  const record = await prisma.screenRecord.findUniqueOrThrow({ where: { id: recordId } });
  const values = { ...valuesOf(record), [fieldKey]: next };

  await prisma.screenRecord.update({
    where: { id: recordId },
    data: { values: values as Prisma.InputJsonValue },
  });

  revalidateEvent(eventId);
}

export async function updateRecord(eventId: string, recordId: string, formData: FormData) {
  await requireMember();

  const record = await prisma.screenRecord.findUniqueOrThrow({
    where: { id: recordId },
    include: { screen: { include: { fields: { orderBy: { position: "asc" } } } } },
  });

  const values: RecordValues = { ...valuesOf(record) };
  for (const field of record.screen.fields) {
    // Checkboxes are absent from FormData when unticked, so they're always rewritten.
    if (field.type === "CHECKBOX" || formData.has(field.key)) {
      values[field.key] = coerce(field, formData.get(field.key));
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.screenRecord.update({
      where: { id: recordId },
      data: { values: values as Prisma.InputJsonValue },
    });
    await syncLinks(tx, recordId, record.screen.fields, values);
  });

  revalidateEvent(eventId);
}

export async function deleteRecord(eventId: string, recordId: string) {
  await requireMember();
  await prisma.screenRecord.delete({ where: { id: recordId } }); // links cascade
  revalidateEvent(eventId);
}

/**
 * "+ Add task" from inside a run-of-show block. Finds the event's first checklist that
 * links to schedule blocks and adds an item already attached to this one — so the block
 * keeps its inline add without the run of show owning any task state of its own.
 */
export async function addChecklistItemForBlock(
  eventId: string,
  scheduleItemId: string,
  formData: FormData,
) {
  await requireMember();

  const screens = await prisma.screenDefinition.findMany({
    where: { eventId, viewType: "CHECKLIST" },
    include: { fields: { orderBy: { position: "asc" } } },
    orderBy: { position: "asc" },
  });

  const target = screens.find((screen) =>
    screen.fields.some((f) => f.type === "LINK" && linkTargetOf(f) === "SCHEDULE_ITEM"),
  );
  if (!target) return; // no checklist links to blocks yet; nothing to add to

  const titleField = target.fields.find((f) => f.type === "TEXT");
  const dueField = target.fields.find((f) => f.type === "DATE");
  const ownerField = target.fields.find((f) => f.type === "PERSON");
  const doneField = target.fields.find((f) => f.type === "CHECKBOX");
  const blockField = target.fields.find(
    (f) => f.type === "LINK" && linkTargetOf(f) === "SCHEDULE_ITEM",
  )!;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const values: RecordValues = { [blockField.key]: scheduleItemId };
  if (titleField) values[titleField.key] = title;
  if (doneField) values[doneField.key] = false;
  if (dueField) values[dueField.key] = String(formData.get("dueDate") ?? "").trim() || null;
  if (ownerField) values[ownerField.key] = String(formData.get("assigneeId") ?? "").trim() || null;

  const last = await prisma.screenRecord.findFirst({
    where: { screenId: target.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.$transaction(async (tx) => {
    const record = await tx.screenRecord.create({
      data: {
        screenId: target.id,
        values: values as Prisma.InputJsonValue,
        position: (last?.position ?? 0) + 1,
      },
    });
    await syncLinks(tx, record.id, target.fields, values);
  });

  revalidateEvent(eventId);
}

/**
 * Creates the field a view type needs. This is what the inline prompt calls when someone
 * switches a screen to BOARD without a Select field — the view offers to add it rather
 * than refusing to render.
 */
export async function addFieldToScreen(
  eventId: string,
  screenId: string,
  label: string,
  type: FieldDefinition["type"],
) {
  await requireMember();

  const existing = await prisma.fieldDefinition.findMany({
    where: { screenId },
    select: { key: true, position: true },
  });
  const taken = new Set(existing.map((f) => f.key));
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";
  let key = base;
  let n = 2;
  while (taken.has(key)) key = `${base}_${n++}`;

  // A Select needs somewhere to start, or the board renders zero columns.
  const options =
    type === "SELECT"
      ? {
          choices: [
            { value: "todo", label: "To do", color: "gray" },
            { value: "doing", label: "In progress", color: "blue" },
            { value: "done", label: "Done", color: "green" },
          ],
        }
      : undefined;

  await prisma.fieldDefinition.create({
    data: {
      screenId,
      key,
      label,
      type,
      position: existing.length,
      options,
    },
  });

  revalidateEvent(eventId);
}

/** Board drag: moves a record into another column by setting its group-by value. */
export async function setRecordGroup(
  eventId: string,
  recordId: string,
  fieldKey: string,
  value: string | null,
) {
  await requireMember();

  const record = await prisma.screenRecord.findUniqueOrThrow({ where: { id: recordId } });
  const values = { ...valuesOf(record), [fieldKey]: value };

  await prisma.screenRecord.update({
    where: { id: recordId },
    data: { values: values as Prisma.InputJsonValue },
  });

  revalidateEvent(eventId);
}
