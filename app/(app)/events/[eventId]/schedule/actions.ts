"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { draftRunOfShow } from "@/lib/ai/run-of-show";
import { getCurrentTeamMember } from "@/lib/current-team-member";
import { formatTime } from "@/lib/format";
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

  const item = await prisma.scheduleItem.findFirst({
    where: { id: scheduleItemId, eventId },
    select: { durationMinutes: true },
  });
  if (!item) throw new Error("Block not found.");

  // A drafted block keeps its proposed length; others default to 30 minutes as before.
  const wanted = item.durationMinutes ?? 30;
  const minutes = Math.max(5, Math.min(wanted, maxMinutes ?? wanted));
  const end = new Date(start.getTime() + minutes * 60_000);

  await prisma.scheduleItem.update({
    where: { id: scheduleItemId },
    data: { startTime: start, endTime: end, aiDrafted: false },
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

const DRAFT_FEATURE = "run_of_show_draft";
const DRAFTS_PER_DAY = 20;

export type DraftState = { error?: string; created?: number };

/**
 * "Draft with AI": the model proposes blocks, which land in "Not yet placed" for the
 * organizer to drag onto the timeline. Nothing is ever placed by the model.
 */
export async function draftScheduleItems(eventId: string, rawPrompt: string): Promise<DraftState> {
  const me = await requireMember();
  if (!me.userId) redirect("/signin");

  // Same access rule as the event layout: the owner or anyone staffed on it.
  const event = await prisma.event.findFirst({
    where: { id: eventId, OR: [{ ownerId: me.id }, { members: { some: { teamMemberId: me.id } } }] },
    include: { scheduleItems: { orderBy: [{ startTime: "asc" }, { createdAt: "asc" }] } },
  });
  if (!event) return { error: "Event not found." };

  const prompt = rawPrompt.trim();
  if (!prompt) return { error: "Describe the programme you want drafted." };
  if (prompt.length > 2000) return { error: "Keep the description under 2,000 characters." };

  // Every attempt counts, failed ones included, over a rolling 24 hours. The row is
  // written before the model call so requests running at the same time count too.
  // ponytail: count-then-insert isn't atomic, so a burst can land a draft or two over 20.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const used = await prisma.agentAction.count({
    where: { userId: me.userId, feature: DRAFT_FEATURE, createdAt: { gte: since } },
  });
  if (used >= DRAFTS_PER_DAY) {
    return { error: `You've used all ${DRAFTS_PER_DAY} AI drafts for today. Try again tomorrow.` };
  }
  const action = await prisma.agentAction.create({
    data: { userId: me.userId, eventId: event.id, feature: DRAFT_FEATURE, prompt },
  });

  // Dates are read in server-local time, like the rest of the run of show.
  const day = new Date(event.eventDate);
  const pad = (n: number) => String(n).padStart(2, "0");
  const result = await draftRunOfShow(
    {
      eventName: event.name,
      eventDate: `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`,
      venue: event.venue,
      capacity: event.capacity,
      existingBlocks: event.scheduleItems.map((item) => ({
        title: item.title,
        start: item.startTime ? formatTime(item.startTime) : null,
        end: item.endTime ? formatTime(item.endTime) : null,
        location: item.location,
      })),
    },
    prompt,
  ).catch(async (err: unknown) => {
    await prisma.agentAction.update({
      where: { id: action.id },
      data: { error: err instanceof Error ? err.message.slice(0, 1000) : "unknown error" },
    });
    throw err;
  });

  if (!result.ok) {
    await prisma.agentAction.update({
      where: { id: action.id },
      data: {
        error: result.detail,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
      },
    });
    return { error: result.error };
  }

  const suggestedStart = (hhmm: string | null) => {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(":").map(Number);
    const at = new Date(day);
    at.setHours(h, m, 0, 0);
    return at;
  };

  // eventId comes from the access-checked event, never from the model or the client.
  await prisma.$transaction([
    prisma.scheduleItem.createMany({
      data: result.blocks.map((block) => ({
        eventId: event.id,
        title: block.title,
        location: block.location,
        notes: block.notes,
        aiDrafted: true,
        durationMinutes: block.durationMinutes,
        suggestedStart: suggestedStart(block.suggestedStart),
      })),
    }),
    prisma.agentAction.update({
      where: { id: action.id },
      data: {
        success: true,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      },
    }),
  ]);

  revalidateEvent(eventId);
  return { created: result.blocks.length };
}
