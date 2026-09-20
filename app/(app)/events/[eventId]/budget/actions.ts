"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentTeamMember } from "@/lib/current-team-member";
import { prisma } from "@/lib/prisma";

async function requireMember() {
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");
  return me;
}

export async function createBudgetLine(eventId: string, formData: FormData) {
  await requireMember();

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
  await requireMember();

  const category = String(formData.get("category") ?? "").trim();
  const allocatedAmount = String(formData.get("allocatedAmount") ?? "0").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  await prisma.budgetLine.update({
    where: { id: budgetLineId },
    data: {
      ...(category ? { category } : {}),
      allocatedAmount: allocatedAmount || 0,
      notes: notes || null,
    },
  });

  revalidatePath(`/events/${eventId}/budget`);
}

export async function deleteBudgetLine(eventId: string, budgetLineId: string) {
  await requireMember();
  await prisma.budgetLine.delete({ where: { id: budgetLineId } });
  revalidatePath(`/events/${eventId}/budget`);
}

export async function createBudgetLineItem(
  eventId: string,
  budgetLineId: string,
  formData: FormData,
) {
  await requireMember();

  const name = String(formData.get("name") ?? "").trim();
  const plannedAmount = String(formData.get("plannedAmount") ?? "0").trim();
  const actualAmount = String(formData.get("actualAmount") ?? "0").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) throw new Error("Line item name is required.");

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
  await requireMember();

  const name = String(formData.get("name") ?? "").trim();
  const plannedAmount = String(formData.get("plannedAmount") ?? "0").trim();
  const actualAmount = String(formData.get("actualAmount") ?? "0").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  await prisma.budgetLineItem.update({
    where: { id: itemId },
    data: {
      ...(name ? { name } : {}),
      // Planned and actual move independently — an item can be committed but not yet paid.
      plannedAmount: plannedAmount || 0,
      actualAmount: actualAmount || 0,
      notes: notes || null,
    },
  });

  revalidatePath(`/events/${eventId}/budget`);
}

export async function deleteBudgetLineItem(eventId: string, itemId: string) {
  await requireMember();
  await prisma.budgetLineItem.delete({ where: { id: itemId } });
  revalidatePath(`/events/${eventId}/budget`);
}

export async function createVendor(eventId: string, budgetLineId: string, formData: FormData) {
  await requireMember();

  const name = String(formData.get("name") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) throw new Error("Vendor name is required.");

  await prisma.vendor.create({
    data: { budgetLineId, name, contactEmail: contactEmail || null, notes: notes || null },
  });

  revalidatePath(`/events/${eventId}/budget`);
}

export async function updateVendor(eventId: string, vendorId: string, formData: FormData) {
  await requireMember();

  const name = String(formData.get("name") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      ...(name ? { name } : {}),
      contactEmail: contactEmail || null,
      notes: notes || null,
    },
  });

  revalidatePath(`/events/${eventId}/budget`);
}

export async function deleteVendor(eventId: string, vendorId: string) {
  await requireMember();
  await prisma.vendor.delete({ where: { id: vendorId } });
  revalidatePath(`/events/${eventId}/budget`);
}
