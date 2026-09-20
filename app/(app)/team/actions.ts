"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TeamRole } from "@prisma/client";

import { getCurrentTeamMember } from "@/lib/current-team-member";
import { prisma } from "@/lib/prisma";

const VALID_ROLES: TeamRole[] = ["ADMIN", "ORGANIZER", "STAFF"];

export async function createTeamMember(formData: FormData) {
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleInput = String(formData.get("role") ?? "STAFF") as TeamRole;
  const role = VALID_ROLES.includes(roleInput) ? roleInput : "STAFF";

  if (!name || !email) {
    throw new Error("Name and email are required.");
  }

  // upsert: adding someone who already exists (e.g. they've already signed in) updates
  // their name/role instead of erroring on the unique email constraint.
  await prisma.teamMember.upsert({
    where: { email },
    update: { name, role },
    create: { name, email, role },
  });

  revalidatePath("/team");
}

export async function updateTeamMember(teamMemberId: string, formData: FormData) {
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");

  const name = String(formData.get("name") ?? "").trim();
  const roleInput = String(formData.get("role") ?? "STAFF") as TeamRole;
  const role = VALID_ROLES.includes(roleInput) ? roleInput : "STAFF";

  if (!name) throw new Error("Name is required.");

  // Email stays fixed — it's how a signed-in user is matched to their roster entry.
  await prisma.teamMember.update({ where: { id: teamMemberId }, data: { name, role } });

  revalidatePath("/team");
}
