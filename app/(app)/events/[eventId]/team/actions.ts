"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import type { TeamRole } from "@prisma/client";

import { inEvent, requireEventAdmin } from "@/lib/event-access";
import { prisma } from "@/lib/prisma";

const VALID_ROLES: TeamRole[] = ["ADMIN", "ORGANIZER", "STAFF", "READ_ONLY"];

// Managing who is on the event, and as what, is for its owner and admins only.

export async function addEventMember(eventId: string, formData: FormData) {
  await requireEventAdmin(eventId);

  const teamMemberId = String(formData.get("teamMemberId") ?? "").trim();
  const roleInput = String(formData.get("role") ?? "STAFF") as TeamRole;
  const role = VALID_ROLES.includes(roleInput) ? roleInput : "STAFF";

  if (!teamMemberId) {
    throw new Error("Select a team member to add.");
  }
  // Demo events only take demo people, and real events only real ones.
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { isDemo: true } });
  const fits = await prisma.teamMember.findFirst({
    where: { id: teamMemberId, isDemo: event.isDemo },
    select: { id: true },
  });
  if (!fits) notFound();

  await prisma.eventMember.upsert({
    where: { eventId_teamMemberId: { eventId, teamMemberId } },
    update: { role },
    create: { eventId, teamMemberId, role },
  });

  revalidatePath(`/events/${eventId}/team`);
  revalidatePath(`/events/${eventId}/schedule`);
  revalidatePath("/dashboard");
}

/** Changes what someone does on this event, without touching their org-wide role. */
export async function updateEventMemberRole(
  eventId: string,
  eventMemberId: string,
  formData: FormData,
) {
  await requireEventAdmin(eventId);

  const roleInput = String(formData.get("role") ?? "STAFF") as TeamRole;
  const role = VALID_ROLES.includes(roleInput) ? roleInput : "STAFF";

  await inEvent(prisma.eventMember.update({ where: { id: eventMemberId, eventId }, data: { role } }));

  revalidatePath(`/events/${eventId}/team`);
  revalidatePath("/dashboard");
}

export async function removeEventMember(eventId: string, eventMemberId: string) {
  await requireEventAdmin(eventId);

  await inEvent(prisma.eventMember.delete({ where: { id: eventMemberId, eventId } }));

  revalidatePath(`/events/${eventId}/team`);
  revalidatePath(`/events/${eventId}/schedule`);
  revalidatePath("/dashboard");
}
