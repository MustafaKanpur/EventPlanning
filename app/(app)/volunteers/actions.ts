"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentTeamMember } from "@/lib/current-team-member";
import { prisma } from "@/lib/prisma";
import { optionalDate, readVolunteerForm } from "@/lib/volunteers";

async function requireStaff() {
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");
  return me;
}

/** Staff adding someone vouches for them, so they skip the pending queue. */
export async function addVolunteer(formData: FormData) {
  await requireStaff();
  const data = readVolunteerForm(formData);
  if (!data.name || !data.email) throw new Error("Name and email are required.");

  const existing = await prisma.volunteer.findUnique({ where: { email: data.email } });
  if (existing) redirect(`/volunteers/${existing.id}`);

  const volunteer = await prisma.volunteer.create({
    data: { ...data, status: "APPROVED", joinedAt: optionalDate(formData.get("joinedAt")) ?? undefined },
  });
  redirect(`/volunteers/${volunteer.id}`);
}

export async function updateVolunteer(volunteerId: string, formData: FormData) {
  await requireStaff();
  // Email is the public forms' match key, so it isn't editable here.
  const data = readVolunteerForm(formData);
  if (!data.name) throw new Error("Name is required.");

  await prisma.volunteer.update({
    where: { id: volunteerId },
    data: { ...data, email: undefined, joinedAt: optionalDate(formData.get("joinedAt")) ?? undefined },
  });
  revalidatePath(`/volunteers/${volunteerId}`);
  revalidatePath("/volunteers");
}

export async function approveVolunteer(volunteerId: string) {
  await requireStaff();
  await prisma.volunteer.update({ where: { id: volunteerId }, data: { status: "APPROVED" } });
  revalidatePath("/volunteers");
  revalidatePath(`/volunteers/${volunteerId}`);
}

function readHours(formData: FormData) {
  const hours = Number(String(formData.get("hours") ?? "").trim());
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 7) {
    throw new Error("Hours must be a positive number.");
  }
  return { hours, note: String(formData.get("note") ?? "").trim() || null };
}

/** Hours can only be logged against an event the volunteer actually signed up for. */
export async function addHours(volunteerId: string, formData: FormData) {
  await requireStaff();
  const eventId = String(formData.get("eventId") ?? "");
  const signedUp = await prisma.shiftSignup.findFirst({
    where: { volunteerId, shift: { eventId } },
  });
  if (!signedUp) throw new Error("Pick an event this volunteer signed up for.");

  await prisma.hoursEntry.create({ data: { volunteerId, eventId, ...readHours(formData) } });
  revalidatePath(`/volunteers/${volunteerId}`);
  revalidatePath("/volunteers");
}

/** Any edit needs approving again, so a changed number never counts unreviewed. */
export async function updateHours(volunteerId: string, entryId: string, formData: FormData) {
  await requireStaff();
  await prisma.hoursEntry.update({
    where: { id: entryId, volunteerId },
    data: { ...readHours(formData), status: "PENDING" },
  });
  revalidatePath(`/volunteers/${volunteerId}`);
  revalidatePath("/volunteers");
}

export async function approveHours(volunteerId: string, entryId: string) {
  await requireStaff();
  await prisma.hoursEntry.update({ where: { id: entryId, volunteerId }, data: { status: "APPROVED" } });
  revalidatePath(`/volunteers/${volunteerId}`);
  revalidatePath("/volunteers");
}

/** Takes their shift sign-ups and hours with them (cascade). */
export async function deleteVolunteer(volunteerId: string) {
  await requireStaff();
  await prisma.volunteer.delete({ where: { id: volunteerId } });
  revalidatePath("/volunteers");
  redirect("/volunteers");
}

export async function deleteHours(volunteerId: string, entryId: string) {
  await requireStaff();
  await prisma.hoursEntry.delete({ where: { id: entryId, volunteerId } });
  revalidatePath(`/volunteers/${volunteerId}`);
  revalidatePath("/volunteers");
}
