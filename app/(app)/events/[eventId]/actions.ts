"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireEventAdmin } from "@/lib/event-access";
import { prisma } from "@/lib/prisma";

/**
 * Deletes an event and everything hanging off it — schedule, tasks, budget, registrants,
 * resources, staffing and any screens placed on it. Screen *definitions* survive: they
 * live in the shared Builder library and may be in use by other events.
 *
 * Restricted to the event's owner, an ADMIN on it, or an org-wide ADMIN, since this
 * can't be undone. Being staffed on the event isn't enough.
 */
export async function deleteEvent(eventId: string) {
  await requireEventAdmin(eventId);

  await prisma.event.delete({ where: { id: eventId } });

  revalidatePath("/dashboard");
  revalidatePath("/builder");
  redirect("/dashboard");
}
