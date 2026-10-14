"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { startSession } from "@/lib/session";

/**
 * Temporary door into the app while real sign-in is unfinished.
 *
 * It mints a genuine database session rather than bypassing the auth guard, so every
 * page keeps working exactly as it does for a signed-in user — `getServerSession` and
 * `getCurrentTeamMember` are untouched. Deleting this file and its button is the whole
 * removal job.
 *
 * It signs in as the workspace's existing owner, because a brand-new identity would
 * land on an empty dashboard and show nothing.
 */
export async function enterWithoutSigningIn() {
  // Prefer a user who already has a TeamMember profile — that's the real workspace owner.
  const member = await prisma.teamMember.findFirst({
    where: { userId: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });

  let userId = member?.userId ?? null;

  if (!userId) {
    // Empty database (a fresh deploy): make a guest identity so the app is still usable.
    const guest = await prisma.user.upsert({
      where: { email: "guest@demo.invalid" },
      update: {},
      create: { email: "guest@demo.invalid", name: "Guest", emailVerified: new Date() },
    });
    await prisma.teamMember.upsert({
      where: { email: guest.email },
      update: { userId: guest.id },
      create: { email: guest.email, name: "Guest", userId: guest.id, role: "ADMIN" },
    });
    userId = guest.id;
  }

  await startSession(userId);

  redirect("/dashboard");
}
