"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentTeamMember } from "@/lib/current-team-member";
import { prisma } from "@/lib/prisma";

async function requireMember() {
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");
  return me;
}

function revalidateEvent(eventId: string) {
  revalidatePath(`/events/${eventId}/schedule`);
  revalidatePath(`/events/${eventId}/tasks`);
}

/**
 * Times are optional: a block created without them lands in "Not yet placed" and is
 * dragged onto the timeline later. A half-filled pair is treated as unplaced rather
 * than guessed at.
 */
export async function createScheduleItem(eventId: string, formData: FormData) {
  await requireMember();

  const title = String(formData.get("title") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const location = String(formData.get("location") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!title) throw new Error("Title is required.");

  const placed = Boolean(startTime && endTime);

  await prisma.scheduleItem.create({
    data: {
      eventId,
      title,
      startTime: placed ? new Date(startTime) : null,
      endTime: placed ? new Date(endTime) : null,
      location: location || null,
      notes: notes || null,
    },
  });

  revalidateEvent(eventId);
}

export async function updateScheduleItem(
  eventId: string,
  scheduleItemId: string,
  formData: FormData,
) {
  await requireMember();

  const title = String(formData.get("title") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const location = String(formData.get("location") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!title) throw new Error("Title is required.");
  const placed = Boolean(startTime && endTime);

  await prisma.scheduleItem.update({
    where: { id: scheduleItemId },
    data: {
      title,
      startTime: placed ? new Date(startTime) : null,
      endTime: placed ? new Date(endTime) : null,
      location: location || null,
      notes: notes || null,
    },
  });

  revalidateEvent(eventId);
}

/**
 * Drops an unplaced block into a slot. Duration is capped to the gap it was dropped
 * into so placing a block can never create an overlap out of nowhere.
 */
export async function placeScheduleItem(
  eventId: string,
  scheduleItemId: string,
  startISO: string,
  maxMinutes?: number,
) {
  await requireMember();

  const start = new Date(startISO);
  if (Number.isNaN(start.getTime())) throw new Error("Invalid slot.");

  const minutes = Math.max(5, Math.min(maxMinutes ?? 30, 30));
  const end = new Date(start.getTime() + minutes * 60_000);

  await prisma.scheduleItem.update({
    where: { id: scheduleItemId },
    data: { startTime: start, endTime: end },
  });

  revalidateEvent(eventId);
}

/** Sends a block back to "Not yet placed" without deleting anything. */
export async function unplaceScheduleItem(eventId: string, scheduleItemId: string) {
  await requireMember();

  await prisma.scheduleItem.update({
    where: { id: scheduleItemId },
    data: { startTime: null, endTime: null },
  });

  revalidateEvent(eventId);
}

export async function deleteScheduleItem(eventId: string, scheduleItemId: string) {
  await requireMember();
  await prisma.scheduleItem.delete({ where: { id: scheduleItemId } });
  revalidateEvent(eventId);
}
