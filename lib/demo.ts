import "server-only";

import { randomBytes } from "node:crypto";
import type { Prisma, TeamMember } from "@prisma/client";
import { notFound } from "next/navigation";

import { seedDemoEvent } from "@/lib/demo-event.js";
import { prisma } from "@/lib/prisma";

const DEMO_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Demo data and real data never mix. A demo account sees only demo rows, a real account
 * only real ones, and org ADMINs see both. Spread into a `where` on any root model
 * (TeamMember, Event, Template, Volunteer).
 */
export function demoScope(me: Pick<TeamMember, "role" | "isDemo">): { isDemo?: boolean } {
  return me.role === "ADMIN" ? {} : { isDemo: me.isDemo };
}

/** Templates follow demoScope, except built-ins, which demo visitors may use too. */
export function templateScope(me: Pick<TeamMember, "role" | "isDemo">): Prisma.TemplateWhereInput {
  if (me.role === "ADMIN") return {};
  return me.isDemo ? { OR: [{ isDemo: true }, { isBuiltIn: true }] } : { isDemo: false };
}

/** For actions that take a volunteer id: the volunteer must be on the caller's side. */
export async function requireVolunteerInScope(me: Pick<TeamMember, "role" | "isDemo">, volunteerId: string) {
  const volunteer = await prisma.volunteer.findFirst({
    where: { id: volunteerId, ...demoScope(me) },
    select: { id: true },
  });
  if (!volunteer) notFound();
}

/**
 * Deletes demo visits older than six hours. Roots go in an order the foreign keys allow:
 * events first (taking everything inside them), then templates and volunteers, then the
 * demo accounts. Anything an expired account made goes with it, even if it's newer.
 */
async function deleteExpiredDemos() {
  const cutoff = new Date(Date.now() - DEMO_TTL_MS);
  const expired = await prisma.teamMember.findMany({
    where: { isDemo: true, createdAt: { lt: cutoff } },
    select: { id: true, userId: true },
  });
  const memberIds = expired.map((m) => m.id);
  const madeByExpired = (field: "ownerId" | "createdById") => ({ [field]: { in: memberIds } });

  await prisma.event.deleteMany({
    where: { isDemo: true, OR: [{ createdAt: { lt: cutoff } }, madeByExpired("ownerId")] },
  });
  await prisma.template.deleteMany({
    where: { isDemo: true, OR: [{ createdAt: { lt: cutoff } }, madeByExpired("createdById")] },
  });
  await prisma.volunteer.deleteMany({ where: { isDemo: true, createdAt: { lt: cutoff } } });
  await prisma.teamMember.deleteMany({ where: { id: { in: memberIds } } });
  // Sessions and AI usage rows cascade with the user.
  await prisma.user.deleteMany({ where: { isDemo: true, createdAt: { lt: cutoff } } });
}

/**
 * One click, one fresh visit: a new demo account that owns a new sample event (so it has
 * event-admin powers there), with the Builder and Volunteer admin abilities. Never an org
 * ADMIN. Returns the user to sign in and the event to open.
 */
export async function createDemoVisit(): Promise<{ userId: string; eventId: string }> {
  // Cleanup rides on the next visitor, so no scheduled job is needed.
  await deleteExpiredDemos();

  const tag = randomBytes(4).toString("hex");
  const email = `visitor.${tag}@demo.invalid`;
  const data: Prisma.UserCreateInput = {
    email,
    name: "Demo visitor",
    emailVerified: new Date(),
    isDemo: true,
    teamMember: {
      create: {
        email,
        name: "Demo visitor",
        role: "STAFF",
        isDemo: true,
        abilities: { create: [{ ability: "BUILDER" }, { ability: "VOLUNTEER_ADMIN" }] },
      },
    },
  };
  const user = await prisma.user.create({ data, include: { teamMember: true } });

  const event = await seedDemoEvent(prisma, { ownerId: user.teamMember!.id, tag: `.${tag}`, isDemo: true });
  return { userId: user.id, eventId: event.id };
}
