"use server";

import { revalidatePath } from "next/cache";
import type { Ability, TeamRole } from "@prisma/client";

import { requireOrgAdmin } from "@/lib/event-access";
import { prisma } from "@/lib/prisma";

const VALID_ROLES: TeamRole[] = ["ADMIN", "ORGANIZER", "STAFF"];
const VALID_ABILITIES: Ability[] = ["BUILDER", "VOLUNTEER_ADMIN"];

export async function createTeamMember(formData: FormData) {
  await requireOrgAdmin();

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
  await requireOrgAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const roleInput = String(formData.get("role") ?? "STAFF") as TeamRole;
  const role = VALID_ROLES.includes(roleInput) ? roleInput : "STAFF";

  if (!name) throw new Error("Name is required.");
  const abilities = formData
    .getAll("abilities")
    .filter((a): a is Ability => VALID_ABILITIES.includes(a as Ability));

  // Email stays fixed — it's how a signed-in user is matched to their roster entry.
  // The ticked boxes are the whole set, so abilities are replaced, not merged.
  await prisma.$transaction([
    prisma.teamMember.update({ where: { id: teamMemberId }, data: { name, role } }),
    prisma.teamMemberAbility.deleteMany({ where: { teamMemberId } }),
    prisma.teamMemberAbility.createMany({ data: abilities.map((ability) => ({ teamMemberId, ability })) }),
  ]);

  revalidatePath("/team");
}
