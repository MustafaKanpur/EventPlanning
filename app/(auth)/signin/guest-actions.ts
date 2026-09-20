"use server";

import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * NextAuth prefixes the cookie with `__Secure-` whenever it is running over https,
 * and refuses to read it under the other name. Getting this wrong produces a session
 * row that exists and a browser that stays signed out.
 */
function sessionCookieName(): string {
  const url = process.env.NEXTAUTH_URL ?? "";
  const secure = url.startsWith("https://") || process.env.NODE_ENV === "production";
  return secure ? "__Secure-next-auth.session-token" : "next-auth.session-token";
}

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
      create: { email: "guest@demo.invalid", name: "Guest" },
    });
    await prisma.teamMember.upsert({
      where: { email: guest.email },
      update: { userId: guest.id },
      create: { email: guest.email, name: "Guest", userId: guest.id, role: "ADMIN" },
    });
    userId = guest.id;
  }

  // Expired rows accumulate here otherwise — NextAuth never prunes them.
  await prisma.session.deleteMany({ where: { userId, expires: { lt: new Date() } } });

  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + SEVEN_DAYS_MS);
  await prisma.session.create({ data: { sessionToken, userId, expires } });

  cookies().set(sessionCookieName(), sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: sessionCookieName().startsWith("__Secure-"),
    expires,
  });

  redirect("/dashboard");
}
