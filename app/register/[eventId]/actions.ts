"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

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

  await prisma.registrant.create({
    data: {
      eventId,
      name,
      email,
      amount: amount || null,
      paymentStatus: "PENDING",
    },
  });

  redirect(`/register/${eventId}?success=1`);
}
