"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { getCurrentTeamMember } from "@/lib/current-team-member";
import { templateScope } from "@/lib/demo";
import { requireEventAccess, requireNotReadOnly } from "@/lib/event-access";
import { prisma } from "@/lib/prisma";
import { saveEventAsTemplate } from "@/lib/templates";

/** From the event settings menu: bottle this event's screens for next year. */
export async function createTemplateFromEvent(eventId: string, formData: FormData) {
  const me = await requireEventAccess(eventId);

  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    select: { name: true },
  });

  const name = String(formData.get("name") ?? "").trim() || `${event.name} template`;
  const description = String(formData.get("description") ?? "").trim() || null;

  await saveEventAsTemplate(eventId, name, description, me.id, me.isDemo);

  revalidatePath("/templates");
  redirect("/templates");
}

export async function deleteTemplate(templateId: string) {
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");
  await requireNotReadOnly(me);

  // Built-ins are re-seeded on demand, so deleting one would just reappear; block it
  // rather than let the button lie.
  // Demo visitors can only reach demo templates, so they can never delete a real one.
  const template = await prisma.template.findFirst({
    where: { id: templateId, ...templateScope(me) },
    select: { isBuiltIn: true },
  });
  if (!template) notFound();
  if (template.isBuiltIn) return;

  await prisma.template.delete({ where: { id: templateId } }); // screens cascade
  revalidatePath("/templates");
}
