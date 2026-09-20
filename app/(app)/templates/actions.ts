"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentTeamMember } from "@/lib/current-team-member";
import { prisma } from "@/lib/prisma";
import { saveEventAsTemplate } from "@/lib/templates";

/** From the event settings menu: bottle this event's screens for next year. */
export async function createTemplateFromEvent(eventId: string, formData: FormData) {
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");

  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    select: { name: true },
  });

  const name = String(formData.get("name") ?? "").trim() || `${event.name} template`;
  const description = String(formData.get("description") ?? "").trim() || null;

  await saveEventAsTemplate(eventId, name, description, me.id);

  revalidatePath("/templates");
  redirect("/templates");
}

export async function deleteTemplate(templateId: string) {
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");

  // Built-ins are re-seeded on demand, so deleting one would just reappear; block it
  // rather than let the button lie.
  const template = await prisma.template.findUniqueOrThrow({
    where: { id: templateId },
    select: { isBuiltIn: true },
  });
  if (template.isBuiltIn) return;

  await prisma.template.delete({ where: { id: templateId } }); // screens cascade
  revalidatePath("/templates");
}
