"use server";

import { redirect } from "next/navigation";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getRegistrationForm, parseAnswers } from "@/lib/registration-form";

// Public, unauthenticated action — anyone with the event link can call this.
export async function registerForEvent(eventId: string, formData: FormData) {
  // Honeypot: bots tend to fill every field; real visitors never see this one
  // (it's visually hidden). If it's filled, pretend success without writing anything.
  if (String(formData.get("company") ?? "").trim()) {
    redirect(`/register/${eventId}?success=1`);
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const amount = String(formData.get("amount") ?? "").trim();

  if (!name || !email) {
    throw new Error("Name and email are required.");
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.status === "CANCELLED") {
    throw new Error("This event is not accepting registrations.");
  }

  // Custom questions are read from the event's own form definition, so a public
  // submission can only write answers the organiser actually asked for.
  const form = await getRegistrationForm(eventId);
  const answers = form ? parseAnswers(form.fields, formData) : null;

  const missing = form?.fields.find(
    (f) => f.required && (answers?.[f.key] === null || answers?.[f.key] === undefined),
  );
  if (missing) {
    throw new Error(`${missing.label} is required.`);
  }

  await prisma.registrant.create({
    data: {
      eventId,
      name,
      email,
      amount: amount || null,
      paymentStatus: "PENDING",
      answers: (answers ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  redirect(`/register/${eventId}?success=1`);
}
