"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";

import { getCurrentTeamMember } from "@/lib/current-team-member";
import { prisma } from "@/lib/prisma";
import { REGISTRATION_FIELD_TYPES } from "@/lib/registration-form";
import type { BuilderField } from "@/app/(app)/builder/types";

/** Slug of the label, unique within the form. Answers are keyed by this. */
function keyFor(label: string, taken: Set<string>): string {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "question";
  let key = base;
  let n = 2;
  while (taken.has(key)) key = `${base}_${n++}`;
  taken.add(key);
  return key;
}

/**
 * Saves the event's public registration questions.
 *
 * Existing questions keep their id *and* their key, so answers already collected from
 * real people keep resolving even when a label is reworded. Deleting a question deletes
 * the field but never rewrites the answers: the old values stay in the JSON, harmless
 * and recoverable if the question comes back.
 */
export async function saveRegistrationForm(
  eventId: string,
  screenId: string,
  fields: BuilderField[],
): Promise<{ error: string } | undefined> {
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");

  const rejected = fields.find((f) => !REGISTRATION_FIELD_TYPES.includes(f.type));
  if (rejected) {
    return { error: `${rejected.label || "That field"} can't be asked on a public form.` };
  }

  await prisma.$transaction(async (tx) => {
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

    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      const label = f.label.trim() || "Untitled question";
      const options =
        f.type === "SELECT" || f.type === "MULTI_SELECT"
          ? ({ choices: f.options ?? [] } as Prisma.InputJsonValue)
          : undefined;

      if (f.id) {
        await tx.fieldDefinition.update({
          where: { id: f.id },
          data: { label, type: f.type, options, required: f.required, position: i },
        });
      } else {
        await tx.fieldDefinition.create({
          data: {
            screenId,
            key: keyFor(label, taken),
            label,
            type: f.type,
            options,
            required: f.required,
            position: i,
          },
        });
      }
    }
  });

  revalidatePath(`/events/${eventId}/registrants`);
  revalidatePath(`/register/${eventId}`);
  redirect(`/events/${eventId}/registrants`);
}
