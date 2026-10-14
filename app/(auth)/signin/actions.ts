"use server";

import { redirect } from "next/navigation";

import { sendVerificationEmail } from "@/lib/email-verification";
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { startSession } from "@/lib/session";

export type AuthState = { error: string } | null;

const WRONG = "Email or password is incorrect.";

let dummyHash: Promise<string> | null = null;

// ponytail: no limit on attempts; add per-email/IP throttling before real users arrive.
export async function signInWithPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, emailVerified: true },
  });
  // Hash even when there's no such account, so the response time doesn't reveal which
  // emails are registered. Same message either way, for the same reason.
  dummyHash ??= hashPassword("not-a-real-password");
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
  if (!user?.passwordHash || !ok) return { error: WRONG };

  await startSession(user.id);
  redirect(user.emailVerified ? "/dashboard" : "/verify-email");
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) return { error: "Enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.` };
  }

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return { error: "An account with this email already exists. Sign in instead." };
  }

  // No TeamMember yet: the account joins the roster only once the email is verified.
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password) },
  });

  try {
    await sendVerificationEmail(email);
  } catch (err) {
    // The account exists either way; the verify page can send the link again.
    console.error("Verification email failed:", err);
  }

  await startSession(user.id);
  redirect("/verify-email");
}
