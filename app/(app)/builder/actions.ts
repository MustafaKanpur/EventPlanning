"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";

import { getCurrentTeamMember } from "@/lib/current-team-member";
import { prisma } from "@/lib/prisma";
import type { BuilderField, BuilderScreenInput } from "./types";

/** Only currency and date fields can post anywhere; anything else stores null. */
function rollupFor(field: BuilderField): string | null {
  if (field.type === "CURRENCY") return field.rollupTarget || null;
  if (field.type === "DATE" || field.type === "DATETIME") {
    return field.rollupTarget === "RUN_OF_SHOW" ? "RUN_OF_SHOW" : null;
  }
  return null;
}

/** Storage key for a field: slug of its label, unique within the screen. */
function keyFor(label: string, taken: Set<string>): string {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "field";
  let key = base;
  let n = 2;
  while (taken.has(key)) key = `${base}_${n++}`;
  taken.add(key);
  return key;
}

function optionsFor(field: BuilderField): Prisma.InputJsonValue | undefined {
  if (field.type === "LINK" || field.type === "PERSON") {
    return { targetType: field.targetType ?? "SCREEN_RECORD", allowMultiple: false };
  }
  if (field.type === "SELECT" || field.type === "MULTI_SELECT") {
    return { choices: field.options ?? [] };
  }
  return undefined;
}

/**
 * Writes the field set. Fields that survive keep their id AND their key, so existing
 * record values keep resolving even when the label changes — that's the whole reason
 * the key exists.
 */
async function syncFields(
  tx: Prisma.TransactionClient,
  screenId: string,
  fields: BuilderField[],
): Promise<Map<string, string>> {
  const existing = await tx.fieldDefinition.findMany({
    where: { screenId },
    select: { id: true, key: true },
  });
  const kept = new Set(fields.filter((f) => f.id).map((f) => f.id as string));
  const dropped = existing.filter((f) => !kept.has(f.id));
  if (dropped.length) {
    await tx.fieldDefinition.deleteMany({ where: { id: { in: dropped.map((f) => f.id) } } });
  }

  const taken = new Set(existing.filter((f) => kept.has(f.id)).map((f) => f.key));
  // Builder key -> stored key. A new field's builder key is a client-side uuid, so
  // anything referring to a field by key (group-by) has to be resolved through this
  // after the write, not before it.
  const storedKey = new Map<string, string>();

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const label = field.label.trim() || "Untitled field";
    const options = optionsFor(field);

    if (field.id) {
      const updated = await tx.fieldDefinition.update({
        where: { id: field.id },
        data: {
          label,
          type: field.type,
          options,
          required: field.required,
          position: i,
          rollupTarget: rollupFor(field),
        },
      });
      storedKey.set(field.key, updated.key);
      storedKey.set(field.id, updated.key);
    } else {
      const created = await tx.fieldDefinition.create({
        data: {
          screenId,
          key: keyFor(label, taken),
          label,
          type: field.type,
          options,
          required: field.required,
          position: i,
          rollupTarget: rollupFor(field),
        },
      });
      storedKey.set(field.key, created.key);
    }
  }

  return storedKey;
}

function validate(input: BuilderScreenInput): { error: string } | undefined {
  if (!input.name.trim()) return { error: "Give the screen a name." };
  // Other view types don't block here: the screen itself offers to create the field it
  // needs, which is friendlier than refusing to save. A checklist is the exception —
  // without a checkbox there is nothing to check off at all.
  if (input.viewType === "CHECKLIST" && !input.fields.some((f) => f.type === "CHECKBOX")) {
    return { error: "A checklist needs a checkbox field to track completion." };
  }
  return undefined;
}

export async function createScreen(
  input: BuilderScreenInput,
): Promise<{ error: string } | undefined> {
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");

  const invalid = validate(input);
  if (invalid) return invalid;

  const screen = await prisma.$transaction(async (tx) => {
    const count = await tx.screenDefinition.count({ where: { eventId: input.eventId } });
    const created = await tx.screenDefinition.create({
      data: {
        eventId: input.eventId,
        name: input.name.trim(),
        icon: input.icon || null,
        viewType: input.viewType,
        position: count,
        createdById: me.id,
      },
    });
    const storedKey = await syncFields(tx, created.id, input.fields);
    const groupBy = input.groupByFieldKey ? (storedKey.get(input.groupByFieldKey) ?? null) : null;
    if (groupBy) {
      await tx.screenDefinition.update({ where: { id: created.id }, data: { groupByFieldKey: groupBy } });
    }
    return created;
  });

  revalidatePath(`/events/${input.eventId}`, "layout");
  redirect(`/events/${input.eventId}/screens/${screen.id}`);
}

export async function updateScreen(
  screenId: string,
  input: BuilderScreenInput,
): Promise<{ error: string } | undefined> {
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");

  const invalid = validate(input);
  if (invalid) return invalid;

  await prisma.$transaction(async (tx) => {
    await tx.screenDefinition.update({
      where: { id: screenId },
      data: { name: input.name.trim(), icon: input.icon || null, viewType: input.viewType },
    });
    const storedKey = await syncFields(tx, screenId, input.fields);
    await tx.screenDefinition.update({
      where: { id: screenId },
      data: {
        groupByFieldKey: input.groupByFieldKey
          ? (storedKey.get(input.groupByFieldKey) ?? null)
          : null,
      },
    });
  });

  revalidatePath(`/events/${input.eventId}`, "layout");
  redirect(`/events/${input.eventId}/screens/${screenId}`);
}

export async function deleteScreen(eventId: string, screenId: string) {
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");

  await prisma.screenDefinition.delete({ where: { id: screenId } }); // fields + records cascade

  revalidatePath(`/events/${eventId}`, "layout");
  redirect(`/events/${eventId}/schedule`);
}
