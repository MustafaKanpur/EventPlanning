"use server";

import { revalidatePath } from "next/cache";

import { requireEventAccess } from "@/lib/event-access";
import { prisma } from "@/lib/prisma";

/**
 * Persists the full tab order — built-ins and event screens alike — as a list of tab keys
 * on the event ("schedule", "budget", … , "screen:<eventScreenId>"). Storing keys rather
 * than positions means a screen removed from the event just leaves a stale key behind,
 * which the reader ignores; nothing has to be renumbered.
 */
export async function reorderEventTabs(eventId: string, orderedKeys: string[]) {
  await requireEventAccess(eventId);

  await prisma.event.update({
    where: { id: eventId },
    data: { tabOrder: orderedKeys },
  });

  revalidatePath(`/events/${eventId}`, "layout");
}
