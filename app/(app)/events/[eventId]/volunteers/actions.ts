"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { inEvent, requireAbility } from "@/lib/event-access";

// Shifts and sign-ups are run by volunteer admins (and org ADMINs), not every member.
import { prisma } from "@/lib/prisma";
import { GENDERS, optionalInt } from "@/lib/volunteers";

export async function createShift(eventId: string, formData: FormData) {
  await requireAbility("VOLUNTEER_ADMIN", eventId);

  const title = String(formData.get("title") ?? "").trim();
  const startTime = new Date(String(formData.get("startTime") ?? ""));
  const endTime = new Date(String(formData.get("endTime") ?? ""));
  const capacity = optionalInt(formData.get("capacity"));
  const gender = String(formData.get("gender") ?? "");

  if (!title) throw new Error("Shift title is required.");
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || endTime <= startTime) {
    throw new Error("The shift needs a start and an end after it.");
  }
  if (!capacity) throw new Error("Capacity must be at least 1.");

  await prisma.shift.create({
    data: {
      eventId,
      title,
      startTime,
      endTime,
      capacity,
      minAge: optionalInt(formData.get("minAge")),
      gender: GENDERS.includes(gender) ? gender : null,
      minHours: optionalInt(formData.get("minHours")),
    },
  });
  revalidatePath(`/events/${eventId}/volunteers`);
}

export async function deleteShift(eventId: string, shiftId: string) {
  await requireAbility("VOLUNTEER_ADMIN", eventId);
  await inEvent(prisma.shift.delete({ where: { id: shiftId, eventId } }));
  revalidatePath(`/events/${eventId}/volunteers`);
}

export async function removeSignup(eventId: string, signupId: string) {
  await requireAbility("VOLUNTEER_ADMIN", eventId);
  await inEvent(prisma.shiftSignup.delete({ where: { id: signupId, shift: { eventId } } }));
  revalidatePath(`/events/${eventId}/volunteers`);
}

/** Staff can override the shift's age/gender/experience rules, but not its capacity. */
export async function addSignup(eventId: string, shiftId: string, formData: FormData) {
  await requireAbility("VOLUNTEER_ADMIN", eventId);

  const volunteerId = String(formData.get("volunteerId") ?? "");
  if (!volunteerId) throw new Error("Pick a volunteer.");

  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, eventId },
    include: { _count: { select: { signups: true } } },
  });
  if (!shift) notFound();
  // ponytail: count-then-insert, no lock; staff adds are rare enough. The public form is serializable.
  if (shift._count.signups >= shift.capacity) throw new Error("This shift is full.");

  await prisma.shiftSignup.upsert({
    where: { shiftId_volunteerId: { shiftId, volunteerId } },
    update: {},
    create: { shiftId, volunteerId },
  });
  revalidatePath(`/events/${eventId}/volunteers`);
  revalidatePath(`/volunteers/${volunteerId}`);
}
