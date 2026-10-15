import "server-only";

import { Prisma, type Ability, type TeamMember } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { getCurrentTeamMember } from "@/lib/current-team-member";
import { prisma } from "@/lib/prisma";

/**
 * The one access rule for events: the owner, anyone staffed on it, or an org-wide ADMIN
 * (who can see and edit every event). Pages and server actions both read it from here,
 * so what you can see and what you can change can't drift apart.
 */
export function accessibleEvents(me: Pick<TeamMember, "id" | "role" | "isDemo">): Prisma.EventWhereInput {
  if (me.role === "ADMIN") return {};
  // Demo accounts only ever reach demo events, and real accounts only real ones.
  return { isDemo: me.isDemo, OR: [{ ownerId: me.id }, { members: { some: { teamMemberId: me.id } } }] };
}

/**
 * Read-only means nothing higher has been granted: a READ_ONLY org role, no abilities,
 * and READ_ONLY on every event they're on. Any one higher grant lifts it entirely.
 */
export async function isReadOnly(me: Pick<TeamMember, "id" | "role">): Promise<boolean> {
  if (me.role !== "READ_ONLY") return false;
  const higher = await prisma.teamMember.count({
    where: {
      id: me.id,
      OR: [{ abilities: { some: {} } }, { eventMemberships: { some: { role: { not: "READ_ONLY" } } } }],
    },
  });
  return higher === 0;
}

/**
 * Whether the viewer may see people's contact and personal details. Read-only accounts see
 * names only, so pages leave everything else out of what they render, which means it's
 * never sent to the browser at all.
 */
export async function canSeePersonal(): Promise<boolean> {
  return !(await viewerIsReadOnly());
}

/** For pages: whether to hide edit controls from the current viewer. */
export async function viewerIsReadOnly(): Promise<boolean> {
  const me = await getCurrentTeamMember();
  return !me || (await isReadOnly(me));
}

/** For writes outside any one event (creating events, deleting templates). */
export async function requireNotReadOnly(me: Pick<TeamMember, "id" | "role">) {
  if (await isReadOnly(me)) redirect("/forbidden");
}

/**
 * Every event-scoped server action calls this first. The eventId comes from the client,
 * so it's checked here rather than trusted. Signed out goes to sign-in; signed in without
 * access goes to the permission page. Returns the caller's TeamMember.
 */
export async function requireEventAccess(eventId: string): Promise<TeamMember> {
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");

  const event = await prisma.event.findFirst({
    where: { id: eventId, ...accessibleEvents(me) },
    select: { id: true },
  });
  if (!event) redirect("/forbidden");
  // Every event action changes something, and read-only accounts change nothing.
  await requireNotReadOnly(me);

  return me;
}

/**
 * For what being staffed isn't enough for: managing the event's team and deleting it.
 * The owner, an ADMIN on the event, or an org-wide ADMIN.
 */
export async function requireEventAdmin(eventId: string): Promise<TeamMember> {
  const me = await requireEventAccess(eventId);
  if (me.role === "ADMIN") return me;

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      OR: [{ ownerId: me.id }, { members: { some: { teamMemberId: me.id, role: "ADMIN" } } }],
    },
    select: { id: true },
  });
  if (!event) redirect("/forbidden");

  return me;
}

/** Org-wide changes (the roster, roles, abilities) are for org ADMINs only. */
export async function requireOrgAdmin(): Promise<TeamMember> {
  const me = await getCurrentTeamMember();
  if (!me) redirect("/signin");
  if (me.role !== "ADMIN") redirect("/forbidden");
  return me;
}

/** Org ADMINs hold every ability; anyone else needs the row. */
export async function hasAbility(me: Pick<TeamMember, "id" | "role">, ability: Ability): Promise<boolean> {
  if (me.role === "ADMIN") return true;
  const row = await prisma.teamMemberAbility.findUnique({
    where: { teamMemberId_ability: { teamMemberId: me.id, ability } },
    select: { id: true },
  });
  return Boolean(row);
}

/**
 * An ability on an event: access to the event first, then the ability. With no eventId
 * (the org volunteer roster), the ability alone.
 */
export async function requireAbility(ability: Ability, eventId?: string): Promise<TeamMember> {
  let me: TeamMember | null;
  if (eventId) {
    me = await requireEventAccess(eventId);
  } else {
    me = await getCurrentTeamMember();
    if (!me) redirect("/signin");
  }
  if (!(await hasAbility(me, ability))) redirect("/forbidden");
  return me;
}

/**
 * Wraps a write whose `where` ties the row to the checked event, e.g. `{ id, eventId }`.
 * When the row isn't in that event, Prisma finds nothing to update or delete; that is
 * treated as not found rather than leaking whether the id exists elsewhere.
 */
export async function inEvent<T>(write: Promise<T>): Promise<T> {
  try {
    return await write;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") notFound();
    throw err;
  }
}
