import "server-only";

import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";

import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Kept apart from NextAuth's magic-link rows, which share the VerificationToken table. */
const identifierFor = (email: string) => `verify-email:${email}`;

/** Only a hash is stored, so a leaked table can't be used to verify anyone. */
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** The account that becomes org ADMIN once verified (the first-admin bootstrap). */
export function isAdminEmail(email: string): boolean {
  const admin = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(admin) && email.toLowerCase() === admin;
}

/** Issues a fresh 24-hour link (replacing any earlier one) and emails it. */
export async function sendVerificationEmail(email: string) {
  const token = randomBytes(32).toString("hex");
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier: identifierFor(email) } }),
    prisma.verificationToken.create({
      data: { identifier: identifierFor(email), token: hashToken(token), expires: new Date(Date.now() + DAY_MS) },
    }),
  ]);

  const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const url = `${base}/api/verify-email?token=${token}`;

  if (!process.env.EMAIL_SERVER_HOST) {
    console.log(`\n[dev] Verification link for ${email}:\n${url}\n`);
    return;
  }
  await nodemailer
    .createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
      auth: { user: process.env.EMAIL_SERVER_USER, pass: process.env.EMAIL_SERVER_PASSWORD },
    })
    .sendMail({
      to: email,
      from: process.env.EMAIL_FROM,
      subject: "Confirm your email for Event Planning",
      text: `Confirm your email to finish setting up your account:\n\n${url}\n\nThis link expires in 24 hours. If you didn't sign up, ignore this email.`,
    });
}

/**
 * Consumes a link. Only now is the account tied to the team roster: a verified email is
 * what proves this person owns the roster entry with that address. Returns false for an
 * unknown or expired link.
 */
export async function confirmEmail(token: string): Promise<boolean> {
  const row = await prisma.verificationToken.findUnique({ where: { token: hashToken(token) } });
  if (!row || !row.identifier.startsWith("verify-email:")) return false;
  await prisma.verificationToken.delete({ where: { token: row.token } });
  if (row.expires < new Date()) return false;

  const email = row.identifier.slice("verify-email:".length);
  const user = await prisma.user.update({ where: { email }, data: { emailVerified: new Date() } });
  const admin = isAdminEmail(email);

  await prisma.teamMember.upsert({
    where: { email },
    update: { userId: user.id, ...(admin ? { role: "ADMIN" } : {}) },
    create: { email, name: user.name ?? email, userId: user.id, ...(admin ? { role: "ADMIN" } : {}) },
  });
  return true;
}
