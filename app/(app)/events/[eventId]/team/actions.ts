"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TeamRole } from "@prisma/client";

import { getCurrentTeamMember } from "@/lib/current-team-member";
import { prisma } from "@/lib/prisma";

const VALID_ROLES: TeamRole[] = ["ADMIN", "ORGANIZER", "STAFF"];

export async function addEventMember(eventId: string, formData: FormData) {
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");

  const teamMemberId = String(formData.get("teamMemberId") ?? "").trim();
  const roleInput = String(formData.get("role") ?? "STAFF") as TeamRole;
  const role = VALID_ROLES.includes(roleInput) ? roleInput : "STAFF";

  if (!teamMemberId) {
    throw new Error("Select a team member to add.");
  }

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
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");

  const roleInput = String(formData.get("role") ?? "STAFF") as TeamRole;
  const role = VALID_ROLES.includes(roleInput) ? roleInput : "STAFF";

  await prisma.eventMember.update({ where: { id: eventMemberId }, data: { role } });

  revalidatePath(`/events/${eventId}/team`);
  revalidatePath("/dashboard");
}

export async function removeEventMember(eventId: string, eventMemberId: string) {
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");

  await prisma.eventMember.delete({ where: { id: eventMemberId } });

  revalidatePath(`/events/${eventId}/team`);
  revalidatePath(`/events/${eventId}/schedule`);
  revalidatePath("/dashboard");
}
