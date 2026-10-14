"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { inEvent, requireEventAccess } from "@/lib/event-access";
import { prisma } from "@/lib/prisma";

/** A child is only created under a budget line that belongs to the checked event. */
async function requireLineInEvent(eventId: string, budgetLineId: string) {
  const line = await prisma.budgetLine.findFirst({ where: { id: budgetLineId, eventId }, select: { id: true } });
  if (!line) notFound();
}

export async function createBudgetLine(eventId: string, formData: FormData) {
  await requireEventAccess(eventId);

  const category = String(formData.get("category") ?? "").trim();
  const allocatedAmount = String(formData.get("allocatedAmount") ?? "0").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!category) throw new Error("Category is required.");

  await prisma.budgetLine.create({
    data: { eventId, category, allocatedAmount: allocatedAmount || 0, notes: notes || null },
  });

  revalidatePath(`/events/${eventId}/budget`);
}

export async function updateBudgetLine(eventId: string, budgetLineId: string, formData: FormData) {
  await requireEventAccess(eventId);

  const category = String(formData.get("category") ?? "").trim();
  const allocatedAmount = String(formData.get("allocatedAmount") ?? "0").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  await inEvent(prisma.budgetLine.update({
    where: { id: budgetLineId, eventId },
    data: {
      ...(category ? { category } : {}),
      allocatedAmount: allocatedAmount || 0,
      notes: notes || null,
    },
  }));

  revalidatePath(`/events/${eventId}/budget`);
}

export async function deleteBudgetLine(eventId: string, budgetLineId: string) {
  await requireEventAccess(eventId);
  await inEvent(prisma.budgetLine.delete({ where: { id: budgetLineId, eventId } }));
  revalidatePath(`/events/${eventId}/budget`);
}

export async function createBudgetLineItem(
  eventId: string,
  budgetLineId: string,
  formData: FormData,
) {
  await requireEventAccess(eventId);

  const name = String(formData.get("name") ?? "").trim();
  const plannedAmount = String(formData.get("plannedAmount") ?? "0").trim();
  const actualAmount = String(formData.get("actualAmount") ?? "0").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) throw new Error("Line item name is required.");
  await requireLineInEvent(eventId, budgetLineId);

  const count = await prisma.budgetLineItem.count({ where: { budgetLineId } });

  await prisma.budgetLineItem.create({
    data: {
      budgetLineId,
      name,
      plannedAmount: plannedAmount || 0,
      actualAmount: actualAmount || 0,
      notes: notes || null,
      position: count,
    },
  });

  revalidatePath(`/events/${eventId}/budget`);
}

export async function updateBudgetLineItem(eventId: string, itemId: string, formData: FormData) {
  await requireEventAccess(eventId);

  const name = String(formData.get("name") ?? "").trim();
  const plannedAmount = String(formData.get("plannedAmount") ?? "0").trim();
  const actualAmount = String(formData.get("actualAmount") ?? "0").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  await inEvent(prisma.budgetLineItem.update({
    where: { id: itemId, budgetLine: { eventId } },
    data: {
      ...(name ? { name } : {}),
      // Planned and actual move independently — an item can be committed but not yet paid.
      plannedAmount: plannedAmount || 0,
      actualAmount: actualAmount || 0,
      notes: notes || null,
    },
  }));

  revalidatePath(`/events/${eventId}/budget`);
}

export async function deleteBudgetLineItem(eventId: string, itemId: string) {
  await requireEventAccess(eventId);
  await inEvent(prisma.budgetLineItem.delete({ where: { id: itemId, budgetLine: { eventId } } }));
  revalidatePath(`/events/${eventId}/budget`);
}

export async function createVendor(eventId: string, budgetLineId: string, formData: FormData) {
  await requireEventAccess(eventId);

  const name = String(formData.get("name") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) throw new Error("Vendor name is required.");
  await requireLineInEvent(eventId, budgetLineId);

  await prisma.vendor.create({
    data: { budgetLineId, name, contactEmail: contactEmail || null, notes: notes || null },
  });

  revalidatePath(`/events/${eventId}/budget`);
}

export async function updateVendor(eventId: string, vendorId: string, formData: FormData) {
  await requireEventAccess(eventId);

  const name = String(formData.get("name") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  await inEvent(prisma.vendor.update({
    where: { id: vendorId, budgetLine: { eventId } },
    data: {
      ...(name ? { name } : {}),
      contactEmail: contactEmail || null,
      notes: notes || null,
    },
  }));

  revalidatePath(`/events/${eventId}/budget`);
}

export async function deleteVendor(eventId: string, vendorId: string) {
  await requireEventAccess(eventId);
  await inEvent(prisma.vendor.delete({ where: { id: vendorId, budgetLine: { eventId } } }));
  revalidatePath(`/events/${eventId}/budget`);
}
