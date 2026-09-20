import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentTeamMember } from "@/lib/current-team-member";
import { prisma } from "@/lib/prisma";
import { displayName, formatDuration, formatLongDate, formatTime } from "@/lib/format";
import { dayState, isToday } from "@/lib/day-of";
import { durationMinutes, splitBlocks, type RunBlock } from "@/lib/run-of-show";
import {
  checklistShape,
  daysOverdue,
  getRecordsLinkedToMany,
  isRecordOverdue,
  readDate,
  readText,
  titleKeyOf,
  valuesOf,
} from "@/lib/records";
import { markBlockComplete, markBlockStarted } from "./actions";

export const dynamic = "force-dynamic"; // the whole point is that it reflects right now

type Contact = { label: string; name: string; phone: string | null };

export default async function DayOfPage({ params }: { params: { eventId: string } }) {
  const { eventId } = params;

  const me = await getCurrentTeamMember();
  if (!me) notFound();

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      OR: [{ ownerId: me.id }, { members: { some: { teamMemberId: me.id } } }],
    },
    include: {
      owner: true,
      scheduleItems: { orderBy: { startTime: "asc" } },
      budgetLines: { include: { vendors: true } },
    },
  });
  if (!event) notFound();

  // Owners come from the composed tier, through the same link helper the run of show
  // uses — the day-of view reads tasks, it does not own them.
  const linkedByBlock = await getRecordsLinkedToMany(
    "SCHEDULE_ITEM",
    event.scheduleItems.map((i) => i.id),
  );
  const people = await prisma.teamMember.findMany({ select: { id: true, name: true, email: true } });
  const personName = new Map(people.map((p) => [p.id, displayName(p.name, p.email)]));

  const blocks: RunBlock[] = event.scheduleItems.map((item) => ({
    id: item.id,
    title: item.title,
    location: item.location,
    notes: item.notes,
    startTime: item.startTime,
    endTime: item.endTime,
    tasks: (linkedByBlock.get(item.id) ?? []).flatMap((record) => {
      if (record.screen.viewType !== "CHECKLIST") return [];
      const shape = checklistShape(record.screen.fields);
      if (!shape) return [];
      const values = valuesOf(record);
      const titleKey = titleKeyOf(record.screen.fields);
      const ownerField = record.screen.fields.find((f) => f.type === "PERSON");
      const ownerId = ownerField ? readText(values, ownerField.key) : "";
      return [
        {
          id: record.id,
          title: titleKey ? readText(values, titleKey) || "Untitled" : "Untitled",
          done: values[shape.doneKey] === true,
          dueDate: shape.dueKey ? readDate(values, shape.dueKey) : null,
          assigneeName: ownerId ? (personName.get(ownerId) ?? null) : null,
          screenName: record.screen.name,
          doneKey: shape.doneKey,
          overdue: isRecordOverdue(values, shape),
          lateDays: daysOverdue(values, shape),
        },
      ];
    }),
    budgetLine: null,
  }));

  const now = new Date();
  const { placed } = splitBlocks(blocks);
  const state = dayState(placed, now);
  const today = isToday(event.eventDate, now);

  const vendors = event.budgetLines.flatMap((line) => line.vendors);
  const contacts: Contact[] = [
    {
      label: "Event lead",
      name: displayName(event.owner.name, event.owner.email),
      phone: event.owner.phone,
    },
    ...vendors
      .filter((v) => v.contactPhone)
      .slice(0, 3)
      .map((v) => ({ label: "Vendor", name: v.name, phone: v.contactPhone })),
  ];

  const ownerOf = (block: (typeof placed)[number]) =>
    block.tasks.find((t) => t.assigneeName)?.assigneeName ?? "Unassigned";

  return (
    // Bottom padding clears the fixed contact bar.
    <div className="mx-auto max-w-md space-y-5 pb-28">
      <header>
        <Link
          href={`/events/${eventId}/schedule`}
          className="text-caption text-ink-muted hover:text-ink"
        >
          ← Full run of show
        </Link>
        <h1 className="mt-2 font-display text-[30px] font-normal leading-tight text-ink">
          {event.name}
        </h1>
        <p className="mt-1 font-mono text-caption tabular-nums text-ink-muted">
          {today ? "Today · " : ""}
          {formatLongDate(event.eventDate)}
        </p>
        {!today && (
          <p className="mt-2 border border-rule bg-panel-alt px-3 py-2 text-caption text-ink">
            This isn&apos;t today. You&apos;re seeing the plan, not a live view.
          </p>
        )}
      </header>

      <section aria-label="Happening now">
        {state.now ? (
          <div className="border border-ink bg-panel p-4">
            <p className="text-micro uppercase text-ink-muted">Now</p>
            <p className="mt-2 font-display text-[26px] font-normal leading-tight text-ink">
              {state.now.title}
            </p>
            {state.now.location && (
              <p className="text-[13px] text-ink-muted">{state.now.location}</p>
            )}
            <p className="mt-3 font-mono text-[30px] leading-none tabular-nums text-ink">
              {formatDuration(state.remainingMinutes ?? 0)}
            </p>
            <p className="text-meta text-ink-muted">
              left · ends {formatTime(state.now.endTime)} · {ownerOf(state.now)}
            </p>
            <form action={markBlockComplete.bind(null, eventId, state.now.id)} className="mt-4">
              <button
                type="submit"
                className="h-12 w-full bg-accent text-ui text-panel transition-opacity hover:opacity-90"
              >
                Mark complete
              </button>
            </form>
          </div>
        ) : (
          <div className="border border-rule bg-panel p-4">
            <p className="text-micro uppercase text-ink-muted">Now</p>
            <p className="mt-2 text-[15px] text-ink">
              {state.next
                ? "Nothing running — the next block hasn't started."
                : state.done.length
                  ? "That's the whole programme done."
                  : "Nothing scheduled yet."}
            </p>
          </div>
        )}
      </section>

      {state.next && (
        <section aria-label="Up next" className="border border-rule bg-panel p-4">
          <p className="text-micro uppercase text-ink-muted">Up next</p>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[17px] text-ink">{state.next.title}</p>
              {state.next.location && (
                <p className="text-[13px] text-ink-muted">{state.next.location}</p>
              )}
              <p className="text-meta text-ink-muted">{ownerOf(state.next)}</p>
            </div>
            <p className="shrink-0 font-mono text-[20px] tabular-nums text-ink">
              {formatTime(state.next.startTime)}
            </p>
          </div>
          <form action={markBlockStarted.bind(null, eventId, state.next.id)} className="mt-3">
            <button
              type="submit"
              className="h-12 w-full border border-rule text-ui text-ink transition-colors hover:bg-panel-alt"
            >
              Start now
            </button>
          </form>
        </section>
      )}

      {state.later.length > 0 && (
        <section aria-label="Rest of the day">
          <h2 className="mb-2 text-micro uppercase text-ink-muted">Rest of the day</h2>
          <ul className="divide-y divide-rule-soft border border-rule bg-panel">
            {state.later.map((block) => (
              <li key={block.id} className="flex items-center gap-3 px-3 py-3">
                <span className="w-14 shrink-0 font-mono text-[14px] tabular-nums text-ink">
                  {formatTime(block.startTime)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-ink">{block.title}</span>
                  {block.location && (
                    <span className="block truncate text-meta text-ink-muted">
                      {block.location}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-meta tabular-nums text-ink-muted">
                  {formatDuration(durationMinutes(block.startTime, block.endTime))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {state.done.length > 0 && (
        <section aria-label="Already done">
          <h2 className="mb-2 text-micro uppercase text-ink-muted">Done</h2>
          <ul className="divide-y divide-rule-soft border border-rule bg-panel">
            {state.done.map((block) => (
              <li key={block.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-14 shrink-0 font-mono text-caption tabular-nums text-ink-muted">
                  {formatTime(block.startTime)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-muted line-through">
                  {block.title}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Fixed, because on the day the thing you need fastest is a phone number. */}
      <nav
        aria-label="Key contacts"
        className="fixed inset-x-0 bottom-0 border-t border-rule bg-panel"
      >
        <ul className="mx-auto flex max-w-md items-stretch divide-x divide-rule">
          {contacts.length === 0 ? (
            <li className="flex-1 px-3 py-3 text-center text-meta text-ink-muted">
              No phone numbers saved for this event yet
            </li>
          ) : (
            contacts.map((contact, i) => (
              <li key={i} className="min-w-0 flex-1">
                {contact.phone ? (
                  <a
                    href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                    className="flex h-14 flex-col justify-center px-3 transition-colors hover:bg-panel-alt"
                  >
                    <span className="truncate text-micro uppercase text-ink-muted">
                      {contact.label}
                    </span>
                    <span className="truncate text-[13px] text-accent">{contact.name}</span>
                  </a>
                ) : (
                  <span className="flex h-14 flex-col justify-center px-3">
                    <span className="truncate text-micro uppercase text-ink-muted">
                      {contact.label}
                    </span>
                    <span className="truncate text-[13px] text-ink-muted">
                      {contact.name} · no number
                    </span>
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      </nav>
    </div>
  );
}
