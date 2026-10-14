import "server-only";

import { randomUUID } from "crypto";
import { cookies } from "next/headers";

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
 * Signs a user in by minting a real database session, the same row and cookie NextAuth
 * makes, so getServerSession, getCurrentTeamMember and signOut all work unchanged.
 * Only call this once the user has proven who they are (password, or the demo door).
 */
export async function startSession(userId: string) {
  // Expired rows accumulate here otherwise — NextAuth never prunes them.
  await prisma.session.deleteMany({ where: { userId, expires: { lt: new Date() } } });

  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + SEVEN_DAYS_MS);
  await prisma.session.create({ data: { sessionToken, userId, expires } });

  const name = sessionCookieName();
  cookies().set(name, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: name.startsWith("__Secure-"),
    expires,
  });
}
