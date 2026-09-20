import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentTeamMember } from "@/lib/current-team-member";
import { prisma } from "@/lib/prisma";
import { EventTabs } from "@/components/event-tabs";
import { EventSettingsMenu } from "@/components/event-settings-menu";
import { ShareEventButton } from "@/components/share-event-button";
import { Countdown } from "@/components/ui";
import { IconExport } from "@/components/ui/icon";
import { describeEventContents } from "@/lib/event-summary";
import { formatLongDate, formatTime } from "@/lib/format";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { eventId: string };
}) {
  const me = await getCurrentTeamMember();
  if (!me) notFound();

  const event = await prisma.event.findFirst({
    where: {
      id: params.eventId,
      OR: [{ ownerId: me.id }, { members: { some: { teamMemberId: me.id } } }],
    },
    include: {
      members: { where: { teamMemberId: me.id }, select: { role: true } },
      _count: {
        select: {
          scheduleItems: true,
          budgetLines: true,
          registrants: true,
          screens: true,
        },
      },
    },
  });
  if (!event) notFound();

  const canDelete = event.ownerId === me.id || event.members.some((m) => m.role === "ADMIN");

  // Tabs come from the event's composed screens now, ordered by position.
  const screens = await prisma.screenDefinition.findMany({
    where: { eventId: event.id },
    select: { id: true, name: true, icon: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  const tabOrder = Array.isArray(event.tabOrder) ? (event.tabOrder as string[]) : [];

  // The subtitle's time window is derived from the run of show rather than stored: the
  // first block's start to the last block's end is the day as actually planned. No venue
  // field exists on Event yet, so the venue segment is simply absent.
  const window = await prisma.scheduleItem.aggregate({
    where: { eventId: event.id },
    _min: { startTime: true },
    _max: { endTime: true },
  });
  const start = window._min.startTime;
  const end = window._max.endTime;
  const subtitle = [
    formatLongDate(event.eventDate),
    start && end ? `${formatTime(start)}–${formatTime(end)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <div>
        <nav aria-label="Breadcrumb" className="text-caption text-ink-muted">
          <Link href="/dashboard" className="transition-colors hover:text-ink">
            Events
          </Link>
          <span className="px-1.5" aria-hidden="true">
            /
          </span>
          <span className="text-ink">{event.name}</span>
        </nav>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-[36px] font-normal leading-[1.1] tracking-[-0.01em] text-ink">
              {event.name}
            </h1>
            <p className="mt-1 text-[13px] text-ink-muted">{subtitle}</p>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <Countdown date={event.eventDate} />
            <Link
              href={`/events/${event.id}/schedule?print=1`}
              className="flex h-11 items-center gap-2 border border-rule px-3 text-ui text-ink transition-colors hover:bg-panel-alt"
            >
              <IconExport size={15} />
              Export run sheet
            </Link>
            <ShareEventButton />
            {canDelete && (
              <EventSettingsMenu
                eventId={event.id}
                eventName={event.name}
                summary={describeEventContents(event._count)}
              />
            )}
          </div>
        </div>
      </div>

      <EventTabs eventId={event.id} screens={screens} tabOrder={tabOrder} />

      {children}
    </div>
  );
}
