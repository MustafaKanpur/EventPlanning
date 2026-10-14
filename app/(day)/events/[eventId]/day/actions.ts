"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { requireEventAccess } from "@/lib/event-access";
import { prisma } from "@/lib/prisma";

/**
 * On the day, "started" and "complete" are the only two edits anyone makes, and they're
 * made one-handed while walking. Rather than add state columns for something that only
 * matters for a few hours, this nudges the block's own times: starting it now moves the
 * start to now; completing it ends it now. The timeline stays the single source of truth.
 */
export async function markBlockStarted(eventId: string, scheduleItemId: string) {
  await requireEventAccess(eventId);

  const block = await prisma.scheduleItem.findFirst({
    where: { id: scheduleItemId, eventId, aiDrafted: false },
    select: { startTime: true, endTime: true },
  });
  if (!block) notFound();
  if (!block.startTime || !block.endTime) return;

  const now = new Date();
  const durationMs = block.endTime.getTime() - block.startTime.getTime();

  await prisma.scheduleItem.update({
    where: { id: scheduleItemId },
    // Keep the planned length: a block that starts late still runs as long as planned.
    data: { startTime: now, endTime: new Date(now.getTime() + durationMs) },
  });

  revalidatePath(`/events/${eventId}/day`);
  revalidatePath(`/events/${eventId}/schedule`);
}

export async function markBlockComplete(eventId: string, scheduleItemId: string) {
  await requireEventAccess(eventId);

  const block = await prisma.scheduleItem.findFirst({
    where: { id: scheduleItemId, eventId, aiDrafted: false },
    select: { startTime: true },
  });
  if (!block) notFound();
  if (!block.startTime) return;

  const now = new Date();
  await prisma.scheduleItem.update({
    where: { id: scheduleItemId },
    // Never let an "ended" block end before it began.
    data: { endTime: now > block.startTime ? now : block.startTime },
  });

  revalidatePath(`/events/${eventId}/day`);
  revalidatePath(`/events/${eventId}/schedule`);
}
