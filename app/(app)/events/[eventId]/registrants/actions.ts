"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PaymentStatus } from "@prisma/client";

import { getCurrentTeamMember } from "@/lib/current-team-member";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES: PaymentStatus[] = ["UNPAID", "PENDING", "PAID", "REFUNDED"];

/**
 * Registration revenue is derived on the budget page (sum of PAID registrants per line),
 * not posted into the line's spend. That removes the increment/decrement bookkeeping this
 * action used to carry — which had to reverse prior postings on every status or line
 * change to avoid double-counting — and makes the figure impossible to drift.
 */
export async function updateRegistrant(eventId: string, registrantId: string, formData: FormData) {
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");

  const statusInput = String(formData.get("paymentStatus") ?? "PENDING") as PaymentStatus;
  const paymentStatus = VALID_STATUSES.includes(statusInput) ? statusInput : "PENDING";
  const budgetLineId = String(formData.get("budgetLineId") ?? "").trim() || null;

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  await prisma.registrant.update({
    where: { id: registrantId },
    data: {
      paymentStatus,
      budgetLineId,
      // The quick status/line form doesn't submit these, so only touch what was sent.
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      ...(formData.has("amount") ? { amount: amountRaw || 0 } : {}),
      ...(formData.has("notes") ? { notes: notes || null } : {}),
    },
  });

  revalidatePath(`/events/${eventId}/registrants`);
  revalidatePath(`/events/${eventId}/budget`);
}
