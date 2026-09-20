"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentTeamMember } from "@/lib/current-team-member";
import { prisma } from "@/lib/prisma";

/**
 * Deletes an event and everything hanging off it — schedule, tasks, budget, registrants,
 * resources, staffing and any screens placed on it. Screen *definitions* survive: they
 * live in the shared Builder library and may be in use by other events.
 *
 * Restricted to the event's owner or an ADMIN on it, since this can't be undone.
 */
export async function deleteEvent(eventId: string) {
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      OR: [
        { ownerId: me.id },
        { members: { some: { teamMemberId: me.id, role: "ADMIN" } } },
      ],
    },
    select: { id: true },
  });
  if (!event) throw new Error("You don't have permission to delete this event.");

  await prisma.event.delete({ where: { id: eventId } });

  revalidatePath("/dashboard");
  revalidatePath("/builder");
  redirect("/dashboard");
}
