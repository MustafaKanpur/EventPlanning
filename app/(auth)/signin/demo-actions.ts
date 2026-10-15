"use server";

import { redirect } from "next/navigation";

import { createDemoVisit } from "@/lib/demo";
import { startSession } from "@/lib/session";

/** The recruiter demo button: a fresh sandbox account and event every click. */
export async function enterDemo() {
  const { userId, eventId } = await createDemoVisit();
  await startSession(userId);
  redirect(`/events/${eventId}/schedule`);
}
