"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email-verification";

export async function resendVerification(): Promise<{ sent: true }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/signin");
  if (session.user.emailVerified) redirect("/dashboard");
  // ponytail: no resend cooldown; add one if this gets used to spam an inbox.
  await sendVerificationEmail(session.user.email);
  return { sent: true };
}
