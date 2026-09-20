"use server";

import { redirect } from "next/navigation";

import { getCurrentTeamMember } from "@/lib/current-team-member";
import { prisma } from "@/lib/prisma";
import { seedDefaultScreens } from "@/lib/default-screens";

export async function createEvent(formData: FormData) {
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");

  const name = String(formData.get("name") ?? "").trim();
  const eventDate = String(formData.get("eventDate") ?? "");
  const fundraisingGoal = String(formData.get("fundraisingGoal") ?? "").trim();
  const venue = String(formData.get("venue") ?? "").trim();
  const capacity = String(formData.get("capacity") ?? "").trim();

  if (!name || !eventDate) {
    throw new Error("Name and date are required.");
  }

  // A new event is never an empty shell: its default composed screens are created in
  // the same transaction, so the tab bar is populated the moment it exists.
  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        name,
        eventDate: new Date(eventDate),
        fundraisingGoal: fundraisingGoal ? fundraisingGoal : null,
        venue: venue || null,
        capacity: capacity ? Number(capacity) : null,
        ownerId: me.id,
      },
    });
    await seedDefaultScreens(tx, created.id, me.id);
    return created;
  });

  redirect(`/events/${event.id}`);
}
