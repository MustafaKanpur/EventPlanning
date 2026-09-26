import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { formatDuration, formatMoney, formatTime } from "@/lib/format";
import {
  DEFAULT_START_MINUTES,
  buildTimeline,
  daysLate,
  durationMinutes,
  findBlockers,
  findOverlaps,
  isOverdue,
  mergeProjections,
  minutesToTimeValue,
  onEventDay,
  scheduleTotals,
  splitBlocks,
  type PlacedBlock,
  type RunBlock,
} from "@/lib/run-of-show";
import { StatusDot } from "@/components/ui";
import { getTimelineProjections } from "@/lib/rollups";
import { ReferencedBy } from "@/components/screens/referenced-by";
import {
  createScheduleItem,
  deleteScheduleItem,
  setEventStartTime,
  unplaceScheduleItem,
  updateScheduleItem,
  updateUnplacedItem,
} from "./actions";
import { addChecklistItemForBlock, toggleRecordCheckbox } from "../screens/actions";
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
import { DraftWithAi } from "./draft-with-ai";
import { DraggableRow, DropZone, EndSlot, GapSlot, RunOfShowDnd, UnplacedBlock } from "./run-of-show-dnd";
import { PrintTrigger } from "./print-trigger";

const field =
  "w-full border border-rule bg-panel px-3 py-2 text-[13px] text-ink focus:border-accent focus:outline-none";
const textButton = "text-ui text-ink-muted transition-colors hover:text-ink";

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export default async function RunOfShowPage({
  params,
  searchParams,
}: {
  params: { eventId: string };
  searchParams: { print?: string };
}) {
  const { eventId } = params;

  const [event, items, budgetLines] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      include: { owner: true, members: { include: { teamMember: true } } },
    }),
    prisma.scheduleItem.findMany({
      where: { eventId },
      orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
    }),
    prisma.budgetLine.findMany({ where: { eventId }, include: { lineItems: true } }),
  ]);

  const teamMembers = event
    ? [event.owner, ...event.members.map((m) => m.teamMember)].sort((a, b) =>
        a.name.localeCompare(b.name),
      )
    : [];

  const committedByLine = new Map(
    budgetLines.map((line) => [
      line.id,
      {
        id: line.id,
        category: line.category,
        committed: line.lineItems.reduce((sum, i) => sum + Number(i.plannedAmount), 0),
      },
    ]),
  );

  // Nested tasks come from the composed tier: every CHECKLIST screen that links to
  // schedule blocks, found through the one RecordLink helper. Keying off shape rather
  // than the screen's name means a user-built "AV Setup" checklist nests here too.
  const linkedByBlock = await getRecordsLinkedToMany(
    "SCHEDULE_ITEM",
    items.map((i) => i.id),
  );
  const people = await prisma.teamMember.findMany({ select: { id: true, name: true, email: true } });
  const personName = new Map(people.map((p) => [p.id, p.name || p.email]));

  const blocks: RunBlock[] = items.map((item) => {
    const linked = linkedByBlock.get(item.id) ?? [];

    const tasks = linked.flatMap((record) => {
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
    });

    // A block "draws on" a budget line when a record attached to it is also charged to
    // that line — the same RecordLink data, read from the other side.
    const budgetLinkedId =
      linked
        .flatMap((r) => r.links ?? [])
        .find((l) => l.targetType === "BUDGET_LINE")?.targetId ?? null;

    return {
      id: item.id,
      title: item.title,
      location: item.location,
      notes: item.notes,
      startTime: item.startTime,
      endTime: item.endTime,
      tasks,
      budgetLine: budgetLinkedId ? (committedByLine.get(budgetLinkedId) ?? null) : null,
    };
  });

  const { placed, unplaced } = splitBlocks(blocks);
  // Gaps are computed from real blocks only, then projections are threaded in — a
  // projected record must not make an unscheduled hour look accounted for.
  const projections = await getTimelineProjections(eventId);
  const timeline = mergeProjections(buildTimeline(placed), projections);
  const { scheduledMinutes, unaccountedMinutes } = scheduleTotals(placed);
  const blockers = findBlockers(blocks, { eventId });
  const addBlock = createScheduleItem.bind(null, eventId);
  // The AI-draft columns only matter in the tray, so they're read from the raw rows
  // rather than widening RunBlock, which the day-of view also builds.
  const itemById = new Map(items.map((item) => [item.id, item]));
  const aiHint = (id: string) => {
    const item = itemById.get(id);
    if (!item) return null;
    const parts = [
      item.suggestedStart ? `Suggested ${formatTime(item.suggestedStart)}` : null,
      item.durationMinutes ? formatDuration(item.durationMinutes) : null,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : null;
  };

  // The furthest end, not the last block's: a long block can outlast the ones after it.
  const lastEnd = placed.reduce<Date | null>(
    (latest, b) => (!latest || b.endTime > latest ? b.endTime : latest),
    null,
  );
  // An empty day opens at the event's start time, not a fixed 09:00.
  const dayStart = onEventDay(event?.eventDate ?? new Date(), event?.startMinutes ?? DEFAULT_START_MINUTES);
  const setStart = setEventStartTime.bind(null, eventId);

  // Clashes are flagged on both blocks involved, never prevented.
  const overlapsWith = new Map<string, string[]>();
  for (const { block, earlier } of findOverlaps(placed)) {
    overlapsWith.set(block.id, [...(overlapsWith.get(block.id) ?? []), earlier.title]);
    overlapsWith.set(earlier.id, [...(overlapsWith.get(earlier.id) ?? []), block.title]);
  }
  const lastBlockIndex = timeline.map((row) => row.kind).lastIndexOf("block");

  return (
    <RunOfShowDnd eventId={eventId}>
      {searchParams.print === "1" && <PrintTrigger />}

      <div className="flex flex-col gap-8 lg:flex-row">
        <section className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3">
            <div>
              <h2 className="font-display text-[22px] font-normal leading-none text-ink">
                Event day
              </h2>
              <p className="mt-1.5 font-mono text-meta tabular-nums text-ink-muted">
                {formatDuration(scheduledMinutes)} scheduled
                {unaccountedMinutes > 0 && ` · ${formatDuration(unaccountedMinutes)} unaccounted`}
              </p>
              <form action={setStart} className="mt-2 flex items-center gap-2 print:hidden">
                <label htmlFor="day-start" className="text-caption text-ink-muted">
                  Day starts
                </label>
                <input
                  id="day-start"
                  name="startTime"
                  type="time"
                  defaultValue={minutesToTimeValue(event?.startMinutes ?? DEFAULT_START_MINUTES)}
                  className="h-8 border border-rule bg-panel px-2 font-mono text-meta tabular-nums text-ink focus:border-accent focus:outline-none"
                />
                <button type="submit" className="text-meta text-ink-muted hover:text-ink">
                  Set
                </button>
              </form>
            </div>
            <div className="flex items-center gap-5 print:hidden">
              <Link href={`/events/${eventId}/tasks`} className={textButton}>
                All tasks
              </Link>
              <Link href={`/events/${eventId}/day`} className={textButton}>
                Day view
              </Link>
              <details className="relative">
                <summary className={`cursor-pointer list-none ${textButton}`}>+ Add block</summary>
                <form
                  action={addBlock}
                  className="absolute right-0 z-20 mt-2 w-80 space-y-2 border border-rule bg-panel p-4 text-left"
                >
                  <div className="space-y-1">
                    <label className="block text-caption text-ink-muted" htmlFor="block-title">
                      Title
                    </label>
                    <input id="block-title" name="title" required className={field} />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-caption text-ink-muted" htmlFor="block-location">
                      Location
                    </label>
                    <input id="block-location" name="location" className={field} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-caption text-ink-muted" htmlFor="block-start">
                        Start
                      </label>
                      <input
                        id="block-start"
                        name="startTime"
                        type="datetime-local"
                        className={field}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-caption text-ink-muted" htmlFor="block-end">
                        End
                      </label>
                      <input id="block-end" name="endTime" type="datetime-local" className={field} />
                    </div>
                  </div>
                  <p className="text-meta text-ink-muted">
                    Leave the times empty to park it under &ldquo;Not yet placed&rdquo;.
                  </p>
                  <button
                    type="submit"
                    className="h-11 w-full bg-accent text-ui text-panel transition-opacity hover:opacity-90"
                  >
                    Add block
                  </button>
                </form>
              </details>
            </div>
          </div>

          <div className="border border-rule bg-panel">
            {timeline.length === 0 ? (
              <p className="px-4 py-10 text-[13px] text-ink-muted">
                No blocks yet. Add the first one to start the run of show.
              </p>
            ) : (
              <>
                {placed.length > 0 && (
                  <DropZone
                    id="zone-top"
                    anchorISO={placed[0].startTime.toISOString()}
                    position="before"
                    label={`Ends ${formatTime(placed[0].startTime)}`}
                  />
                )}
                {timeline.map((row, i) => {
                  if (row.kind === "projection") {
                    return <ProjectionRow key={`proj-${row.recordId}`} eventId={eventId} row={row} />;
                  }
                  if (row.kind === "gap") {
                    return (
                      <GapSlot
                        key={`gap-${row.start.toISOString()}`}
                        id={`gap-${row.start.toISOString()}`}
                        startISO={row.start.toISOString()}
                        minutes={row.minutes}
                        resumesAt={formatTime(row.end)}
                        startsAt={formatTime(row.start)}
                      />
                    );
                  }
                  const end = row.block.endTime;
                  // A gap below is already a drop target, and the end slot covers the last block.
                  const zoneBelow = i !== lastBlockIndex && timeline[i + 1]?.kind !== "gap";
                  return (
                    <div key={row.block.id}>
                      <DraggableRow id={row.block.id} title={row.block.title}>
                        <BlockRow
                          eventId={eventId}
                          block={row.block}
                          teamMembers={teamMembers}
                          overlaps={overlapsWith.get(row.block.id)}
                        />
                      </DraggableRow>
                      {zoneBelow && (
                        <DropZone
                          id={`zone-${row.block.id}`}
                          anchorISO={end.toISOString()}
                          label={`Starts ${formatTime(end)}`}
                        />
                      )}
                    </div>
                  );
                })}
              </>
            )}
            <div className="border-t border-rule print:hidden">
              <EndSlot
                startISO={(lastEnd ?? dayStart).toISOString()}
                label={
                  lastEnd
                    ? `Drop a block here to run after ${formatTime(lastEnd)}`
                    : `Drop a block here to open the day at ${formatTime(dayStart)}`
                }
                overLabel={`Drop to start at ${formatTime(lastEnd ?? dayStart)}`}
              />
            </div>
          </div>
        </section>

        <aside className="w-full shrink-0 space-y-8 lg:w-[330px] print:hidden">
          <section>
            <h2 className="mb-2 text-micro uppercase text-ink-muted">Blocking the schedule</h2>
            <div className="border border-rule bg-panel">
              {blockers.length === 0 ? (
                <p className="px-3 py-4 text-[13px] text-ink-muted">
                  Nothing blocking. Every block has a time and no task is overdue.
                </p>
              ) : (
                <ul className="divide-y divide-rule-soft">
                  {blockers.map((blocker, i) => (
                    <li key={i} className="px-3 py-2.5">
                      <StatusDot
                        status={blocker.kind}
                        label={blocker.kind}
                        tone={
                          blocker.kind === "overdue" || blocker.kind === "overlap"
                            ? "danger"
                            : "warn"
                        }
                      />
                      <p className="mt-1 text-[13px] text-ink">
                        {blocker.href ? (
                          <Link href={blocker.href} className="text-accent hover:underline">
                            {blocker.label}
                          </Link>
                        ) : (
                          blocker.label
                        )}
                      </p>
                      <p className="text-meta text-ink-muted">{blocker.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <DraftWithAi eventId={eventId} />

          <section>
            <h2 className="mb-2 text-micro uppercase text-ink-muted">Not yet placed</h2>
            {unplaced.length === 0 ? (
              <p className="border border-rule bg-panel px-3 py-4 text-[13px] text-ink-muted">
                Every block has a slot.
              </p>
            ) : (
              <ul className="space-y-2">
                {unplaced.map((block) => (
                  <UnplacedBlock
                    key={block.id}
                    id={block.id}
                    title={block.title}
                    location={block.location}
                    taskCount={block.tasks.length}
                    aiDrafted={itemById.get(block.id)?.aiDrafted}
                    aiHint={aiHint(block.id)}
                    editor={
                      <UnplacedEditor
                        eventId={eventId}
                        block={block}
                        durationMinutes={itemById.get(block.id)?.durationMinutes ?? null}
                        suggestedStart={itemById.get(block.id)?.suggestedStart ?? null}
                      />
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </RunOfShowDnd>
  );
}

/**
 * A record projected onto the day from a user-built screen. Dashed left edge and the
 * screen's name, so it never reads as a schedule block — it isn't one, and it can't be
 * edited from here.
 */
function ProjectionRow({
  eventId,
  row,
}: {
  eventId: string;
  row: Extract<ReturnType<typeof mergeProjections>[number], { kind: "projection" }>;
}) {
  return (
    <div className="flex border-b border-rule-soft last:border-b-0">
      <div className="w-[92px] shrink-0 border-r border-rule-soft px-4 py-3">
        <p className="font-mono text-[14px] leading-none tabular-nums text-ink-muted">
          {formatTime(row.when)}
        </p>
      </div>
      <div className="min-w-0 flex-1 border-l-2 border-dashed border-rule px-4 py-3">
        <p className="text-[14px] text-ink-muted">
          {row.title}{" "}
          <Link
            href={`/events/${eventId}/screens/${row.screenId}`}
            className="text-micro uppercase text-accent hover:underline"
          >
            {row.screenName}
          </Link>
        </p>
      </div>
    </div>
  );
}

function BlockRow({
  eventId,
  block,
  teamMembers,
  overlaps,
}: {
  eventId: string;
  block: PlacedBlock;
  teamMembers: { id: string; name: string }[];
  /** Titles of blocks this one clashes with. */
  overlaps?: string[];
}) {
  const addTask = addChecklistItemForBlock.bind(null, eventId, block.id);
  const editBlock = updateScheduleItem.bind(null, eventId, block.id);
  const removeBlock = deleteScheduleItem.bind(null, eventId, block.id);
  const unplace = unplaceScheduleItem.bind(null, eventId, block.id);
  const minutes = durationMinutes(block.startTime, block.endTime);

  return (
    <div
      className={`flex border-b border-l-2 border-b-rule-soft ${
        overlaps ? "border-l-danger" : "border-l-transparent"
      }`}
    >
      <div className="w-[92px] shrink-0 border-r border-rule-soft py-4 pl-6 pr-3">
        <p
          className={`font-mono text-[14px] leading-none tabular-nums ${overlaps ? "text-danger" : "text-ink"}`}
        >
          {formatTime(block.startTime)}
        </p>
        <p className="mt-1 font-mono text-meta tabular-nums text-ink-muted">
          {formatDuration(minutes)}
        </p>
      </div>

      <div className="min-w-0 flex-1 px-4 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[15px] text-ink">
            {block.title}
            {block.location && <span className="text-ink-muted"> · {block.location}</span>}
          </p>
          <details className="relative shrink-0 print:hidden">
            <summary className="cursor-pointer list-none text-meta text-ink-muted hover:text-ink">
              Edit
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-80 space-y-2 border border-rule bg-panel p-4">
              <form action={editBlock} className="space-y-2">
                <input name="title" defaultValue={block.title} required className={field} />
                <input
                  name="location"
                  defaultValue={block.location ?? ""}
                  placeholder="Location"
                  className={field}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="startTime"
                    type="datetime-local"
                    defaultValue={toLocalInputValue(block.startTime)}
                    className={field}
                  />
                  <input
                    name="endTime"
                    type="datetime-local"
                    defaultValue={toLocalInputValue(block.endTime)}
                    className={field}
                  />
                </div>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={block.notes ?? ""}
                  placeholder="Notes"
                  className={field}
                />
                <button
                  type="submit"
                  className="h-11 w-full bg-accent text-ui text-panel transition-opacity hover:opacity-90"
                >
                  Save
                </button>
              </form>
              <div className="flex items-center justify-between border-t border-rule-soft pt-2">
                <form action={unplace}>
                  <button type="submit" className="text-meta text-ink-muted hover:text-ink">
                    Move to “Not yet placed”
                  </button>
                </form>
                <form action={removeBlock}>
                  <button type="submit" className="text-meta text-ink-muted hover:text-danger">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          </details>
        </div>

        {overlaps && (
          <p className="mt-1 text-meta text-danger">
            Overlaps {overlaps.join(", ")} · {formatTime(block.startTime)}–{formatTime(block.endTime)}
          </p>
        )}

        {block.notes && (
          <p className="mt-1 whitespace-pre-line text-caption text-ink-muted">{block.notes}</p>
        )}

        {block.tasks.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {block.tasks.map((task) => {
              const toggle = toggleRecordCheckbox.bind(null, eventId, task.id, task.doneKey, !task.done);
              const late = isOverdue(task);
              const lateBy = daysLate(task);
              return (
                <li key={task.id} className="flex items-center gap-3">
                  <form action={toggle} className="flex items-center">
                    <button
                      type="submit"
                      aria-label={
                        task.done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`
                      }
                      className="flex h-11 w-5 items-center justify-center"
                    >
                      <span
                        className={`flex h-[11px] w-[11px] items-center justify-center border ${
                          task.done ? "border-accent bg-accent" : "border-rule bg-panel"
                        }`}
                      >
                        {task.done && (
                          <svg
                            width="8"
                            height="8"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#FFFDF8"
                            strokeWidth={3}
                            aria-hidden="true"
                          >
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </span>
                    </button>
                  </form>
                  <span
                    className={`flex-1 text-[13px] ${
                      task.done ? "text-ink-muted line-through" : "text-ink"
                    }`}
                  >
                    {task.title}
                    {task.screenName !== "Tasks" && (
                      <span className="ml-2 text-micro uppercase text-ink-muted">
                        {task.screenName}
                      </span>
                    )}
                  </span>
                  {task.dueDate && (
                    <span
                      className={`font-mono text-meta tabular-nums ${
                        late ? "text-danger" : "text-ink-muted"
                      }`}
                    >
                      {late
                        ? `${lateBy} day${lateBy === 1 ? "" : "s"} late`
                        : task.dueDate.toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}
                    </span>
                  )}
                  <span className="w-28 shrink-0 truncate text-right text-meta text-ink-muted">
                    {task.assigneeName ?? "Unassigned"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <details className="mt-2 print:hidden">
          <summary className="cursor-pointer list-none text-meta text-ink-muted hover:text-ink">
            + Add task
          </summary>
          <form action={addTask} className="mt-2 flex flex-wrap items-end gap-2">
            <input
              name="title"
              required
              placeholder="Task"
              className={`${field} min-w-[10rem] flex-1`}
            />
            <select name="assigneeId" defaultValue="" className={`${field} w-auto`}>
              <option value="">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <input name="dueDate" type="date" className={`${field} w-auto`} />
            <button
              type="submit"
              className="h-11 border border-rule px-3 text-ui text-ink hover:bg-panel-alt"
            >
              Add
            </button>
          </form>
        </details>

        {/* Non-checklist records attached to this block. Checklists are already nested
            above as tasks, so they're excluded rather than listed twice. */}
        <ReferencedBy
          eventId={eventId}
          targetType="SCHEDULE_ITEM"
          targetId={block.id}
          exclude={(viewType) => viewType === "CHECKLIST"}
          heading="Also attached"
          className="mt-3"
        />

        {block.budgetLine && (
          <p className="mt-3 border-t border-dashed border-rule pt-2 text-caption text-ink-muted">
            Draws on{" "}
            <Link href={`/events/${eventId}/budget`} className="text-accent hover:underline">
              {block.budgetLine.category}
            </Link>{" "}
            —{" "}
            <span className="font-mono tabular-nums">
              {formatMoney(block.budgetLine.committed)}
            </span>{" "}
            committed
          </p>
        )}
      </div>
    </div>
  );
}

/** Edit panel for a block still in the tray, so an AI draft can be fixed before placing. */
function UnplacedEditor({
  eventId,
  block,
  durationMinutes,
  suggestedStart,
}: {
  eventId: string;
  block: RunBlock;
  durationMinutes: number | null;
  suggestedStart: Date | null;
}) {
  const save = updateUnplacedItem.bind(null, eventId, block.id);
  const remove = deleteScheduleItem.bind(null, eventId, block.id);

  return (
    <details className="border border-t-0 border-rule bg-panel">
      <summary className="cursor-pointer list-none px-3 py-1.5 text-meta text-ink-muted hover:text-ink">
        Edit
      </summary>
      <div className="space-y-2 border-t border-rule-soft p-3">
        <form action={save} className="space-y-2">
          <label className="sr-only" htmlFor={`draft-title-${block.id}`}>
            Title
          </label>
          <input id={`draft-title-${block.id}`} name="title" defaultValue={block.title} required className={field} />
          <label className="sr-only" htmlFor={`draft-location-${block.id}`}>
            Location
          </label>
          <input
            id={`draft-location-${block.id}`}
            name="location"
            defaultValue={block.location ?? ""}
            placeholder="Location"
            className={field}
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="block text-caption text-ink-muted" htmlFor={`draft-duration-${block.id}`}>
                Duration (min)
              </label>
              <input
                id={`draft-duration-${block.id}`}
                name="durationMinutes"
                type="number"
                min={5}
                max={1440}
                step={5}
                required
                defaultValue={durationMinutes ?? 30}
                className={field}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-caption text-ink-muted" htmlFor={`draft-start-${block.id}`}>
                Suggested time
              </label>
              <input
                id={`draft-start-${block.id}`}
                name="suggestedStart"
                type="time"
                defaultValue={suggestedStart ? formatTime(suggestedStart) : ""}
                className={field}
              />
            </div>
          </div>
          <label className="sr-only" htmlFor={`draft-notes-${block.id}`}>
            Notes
          </label>
          <textarea
            id={`draft-notes-${block.id}`}
            name="notes"
            rows={2}
            defaultValue={block.notes ?? ""}
            placeholder="Notes"
            className={field}
          />
          <button type="submit" className="h-11 w-full bg-accent text-ui text-panel transition-opacity hover:opacity-90">
            Save
          </button>
        </form>
        <form action={remove} className="text-right">
          <button type="submit" className="text-meta text-ink-muted hover:text-danger">
            Delete
          </button>
        </form>
      </div>
    </details>
  );
}
