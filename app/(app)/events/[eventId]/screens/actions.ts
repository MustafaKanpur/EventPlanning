"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import type { FieldDefinition, Prisma } from "@prisma/client";

import { inEvent, requireAbility, requireEventAccess } from "@/lib/event-access";
import { listLinkOptions } from "@/lib/link-targets";
import { prisma } from "@/lib/prisma";
import { linkTargetOf, valuesOf, type RecordValues } from "@/lib/records";

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
 *
 * Link ids arrive from the client, so each must be something this event's picker would
 * offer; anything else (another event's block, a stranger) is treated as not found.
 */
async function syncLinks(
  tx: Prisma.TransactionClient,
  eventId: string,
  recordId: string,
  fields: FieldDefinition[],
  values: RecordValues,
) {
  const linkFields = fields.filter((f) => f.type === "LINK" || f.type === "PERSON");
  if (linkFields.length === 0) return;

  const rows = linkFields.flatMap((field) => {
    const target = linkTargetOf(field);
    if (!target) return [];
    const value = values[field.key];
    const ids = Array.isArray(value) ? value : value ? [value] : [];
    return ids
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .map((id) => ({ recordId, fieldKey: field.key, targetType: target, targetId: id }));
  });

  // ponytail: loads each target's full option list per save; query by id if events get huge.
  for (const target of Array.from(new Set(rows.map((r) => r.targetType)))) {
    const allowed = new Set((await listLinkOptions(eventId, target, false)).map((o) => o.id));
    if (rows.some((r) => r.targetType === target && !allowed.has(r.targetId))) notFound();
  }

  await tx.recordLink.deleteMany({
    where: { recordId, fieldKey: { in: linkFields.map((f) => f.key) } },
  });
  if (rows.length) await tx.recordLink.createMany({ data: rows, skipDuplicates: true });
}

/** A screen of this event (not another event's, nor a template's), with its fields. */
async function loadScreen(eventId: string, screenId: string) {
  const screen = await prisma.screenDefinition.findFirst({
    where: { id: screenId, eventId },
    include: { fields: { orderBy: { position: "asc" } } },
  });
  if (!screen) notFound();
  return screen;
}

/** A record on one of this event's screens. */
async function loadRecord(eventId: string, recordId: string) {
  const record = await prisma.screenRecord.findFirst({
    where: { id: recordId, screen: { eventId } },
    include: { screen: { include: { fields: { orderBy: { position: "asc" } } } } },
  });
  if (!record) notFound();
  return record;
}

export async function createRecord(eventId: string, screenId: string, formData: FormData) {
  await requireEventAccess(eventId);
  const screen = await loadScreen(eventId, screenId);

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
    await syncLinks(tx, eventId, record.id, screen.fields, values);
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
  await requireEventAccess(eventId);

  const record = await loadRecord(eventId, recordId);
  const field = record.screen.fields.find((f) => f.key === fieldKey);
  if (!field) return;

  const values = { ...valuesOf(record), [fieldKey]: coerce(field, formData.get("value")) };

  await prisma.$transaction(async (tx) => {
    await tx.screenRecord.update({
      where: { id: recordId },
      data: { values: values as Prisma.InputJsonValue },
    });
    await syncLinks(tx, eventId, recordId, record.screen.fields, values);
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
  await requireEventAccess(eventId);

  const record = await loadRecord(eventId, recordId);
  const values = { ...valuesOf(record), [fieldKey]: next };

  await prisma.screenRecord.update({
    where: { id: recordId },
    data: { values: values as Prisma.InputJsonValue },
  });

  revalidateEvent(eventId);
}

export async function updateRecord(eventId: string, recordId: string, formData: FormData) {
  await requireEventAccess(eventId);

  const record = await loadRecord(eventId, recordId);

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
    await syncLinks(tx, eventId, recordId, record.screen.fields, values);
  });

  revalidateEvent(eventId);
}

export async function deleteRecord(eventId: string, recordId: string) {
  await requireEventAccess(eventId);
  await inEvent(prisma.screenRecord.delete({ where: { id: recordId, screen: { eventId } } })); // links cascade
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
  await requireEventAccess(eventId);

  const block = await prisma.scheduleItem.findFirst({ where: { id: scheduleItemId, eventId }, select: { id: true } });
  if (!block) notFound();

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
    await syncLinks(tx, eventId, record.id, target.fields, values);
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
  await requireAbility("BUILDER", eventId);

  await loadScreen(eventId, screenId);

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
  await requireEventAccess(eventId);

  const record = await loadRecord(eventId, recordId);
  const values = { ...valuesOf(record), [fieldKey]: value };

  await prisma.screenRecord.update({
    where: { id: recordId },
    data: { values: values as Prisma.InputJsonValue },
  });

  revalidateEvent(eventId);
}
