import type { LinkTarget } from "@prisma/client";

import { prisma } from "./prisma";
import { displayName, formatMoney, formatTime } from "./format";
import { readText, titleKeyOf, valuesOf } from "./records";

export type LinkOption = {
  id: string;
  label: string;
  /** Secondary line in the picker — enough to tell two similar options apart. */
  sublabel?: string;
  href: string;
};

export const LINK_TARGET_LABELS: Record<LinkTarget, string> = {
  SCHEDULE_ITEM: "Run-of-show block",
  BUDGET_LINE: "Budget line",
  VENDOR: "Vendor",
  TEAM_MEMBER: "Person",
  REGISTRANT: "Registrant",
  SCREEN_RECORD: "Record on another screen",
};

/**
 * Everything a LINK field can point at, for one event. This is the single place that
 * knows how each kind of core object is named and where it lives — the picker, the cell
 * and the "Referenced by" panel all read from it, so a vendor is described the same way
 * everywhere it appears.
 */
export async function listLinkOptions(
  eventId: string,
  target: LinkTarget,
): Promise<LinkOption[]> {
  switch (target) {
    case "SCHEDULE_ITEM": {
      const rows = await prisma.scheduleItem.findMany({
        where: { eventId },
        orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
      });
      return rows.map((row) => ({
        id: row.id,
        label: row.title,
        sublabel: row.startTime ? formatTime(row.startTime) : "Not yet placed",
        href: `/events/${eventId}/schedule`,
      }));
    }
    case "BUDGET_LINE": {
      const rows = await prisma.budgetLine.findMany({
        where: { eventId },
        orderBy: { category: "asc" },
      });
      return rows.map((row) => ({
        id: row.id,
        label: row.category,
        sublabel: `${formatMoney(row.allocatedAmount)} allocated`,
        href: `/events/${eventId}/budget`,
      }));
    }
    case "VENDOR": {
      const rows = await prisma.vendor.findMany({
        where: { budgetLine: { eventId } },
        include: { budgetLine: { select: { category: true } } },
        orderBy: { name: "asc" },
      });
      return rows.map((row) => ({
        id: row.id,
        label: row.name,
        sublabel: row.budgetLine.category,
        href: `/events/${eventId}/budget`,
      }));
    }
    case "TEAM_MEMBER": {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: { owner: true, members: { include: { teamMember: true } } },
      });
      if (!event) return [];
      const people = [event.owner, ...event.members.map((m) => m.teamMember)];
      return people.map((person) => ({
        id: person.id,
        label: displayName(person.name, person.email),
        sublabel: person.email,
        href: `/events/${eventId}/team`,
      }));
    }
    case "REGISTRANT": {
      const rows = await prisma.registrant.findMany({
        where: { eventId },
        orderBy: { name: "asc" },
      });
      return rows.map((row) => ({
        id: row.id,
        label: row.name,
        sublabel: row.email,
        href: `/events/${eventId}/registrants`,
      }));
    }
    case "SCREEN_RECORD": {
      const screens = await prisma.screenDefinition.findMany({
        where: { eventId },
        include: {
          fields: { orderBy: { position: "asc" } },
          records: { orderBy: { position: "asc" } },
        },
      });
      return screens.flatMap((screen) => {
        const titleKey = titleKeyOf(screen.fields);
        return screen.records.map((record) => ({
          id: record.id,
          label: titleKey ? readText(valuesOf(record), titleKey) || "Untitled" : "Untitled",
          sublabel: screen.name,
          href: `/events/${eventId}/screens/${screen.id}`,
        }));
      });
    }
  }
}

/** Options for every target a screen's LINK/PERSON fields point at, keyed by target. */
export async function listOptionsForTargets(
  eventId: string,
  targets: LinkTarget[],
): Promise<Record<string, LinkOption[]>> {
  const unique = Array.from(new Set(targets));
  const entries = await Promise.all(
    unique.map(async (target) => [target, await listLinkOptions(eventId, target)] as const),
  );
  return Object.fromEntries(entries);
}
