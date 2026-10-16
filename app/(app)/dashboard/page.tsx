import Link from "next/link";

import { getCurrentTeamMember } from "@/lib/current-team-member";
import { isReadOnly } from "@/lib/event-access";
import { accessibleEvents } from "@/lib/event-access";
import { prisma } from "@/lib/prisma";
import { daysUntil, displayName, formatMoney } from "@/lib/format";
import {
  checklistProgress,
  checklistShape,
  countOverdue,
  type ChecklistScreen,
} from "@/lib/records";
import {
  Countdown,
  DateStub,
  MicroBar,
  PageHeader,
  StatStrip,
  StatusDot,
  toneForStatus,
  type StatItem,
} from "@/components/ui";

export default async function DashboardPage() {
  const me = await getCurrentTeamMember();
  // Read-only accounts can't create events, so they aren't offered it.
  const canCreate = me ? !(await isReadOnly(me)) : false;

  const events = me
    ? await prisma.event.findMany({
        where: accessibleEvents(me),
        orderBy: { eventDate: "asc" },
        include: {
          owner: true,
          screens: {
            where: { viewType: "CHECKLIST" },
            include: {
              fields: { orderBy: { position: "asc" } },
              records: { orderBy: { position: "asc" } },
            },
          },
          scheduleItems: { where: { aiDrafted: false }, select: { id: true } },
          registrants: { select: { amount: true, paymentStatus: true } },
          budgetLines: {
            select: {
              allocatedAmount: true,
              lineItems: { select: { actualAmount: true } },
              vendors: { select: { name: true, status: true, lastContactedAt: true } },
            },
          },
        },
      })
    : [];

  const now = new Date();

  const rows = events.map((event) => {
    // Progress and overdue now come from every checklist on the event, not a Task
    // table — so a team that builds "Permits" as a checklist is counted here without
    // configuring anything.
    const checklists: ChecklistScreen[] = event.screens.flatMap((screen) => {
      const shape = checklistShape(screen.fields);
      return shape ? [{ ...screen, shape }] : [];
    });
    const overdue = countOverdue(checklists, now);
    const progress = checklists.reduce(
      (acc, screen) => {
        const p = checklistProgress(screen.records, screen.shape);
        return { done: acc.done + p.done, total: acc.total + p.total };
      },
      { done: 0, total: 0 },
    );

    const paid = event.registrants.filter((r) => r.paymentStatus === "PAID");
    const unpaid = event.registrants.filter(
      (r) => r.paymentStatus === "UNPAID" || r.paymentStatus === "PENDING",
    );
    const allocated = event.budgetLines.reduce((s, l) => s + Number(l.allocatedAmount), 0);
    const spent = event.budgetLines.reduce(
      (s, l) => s + l.lineItems.reduce((a, i) => a + Number(i.actualAmount), 0),
      0,
    );
    return {
      event,
      doneTasks: progress.done,
      totalTasks: progress.total,
      overdue,
      seats: event.registrants.length,
      capacity: event.capacity,
      paidTotal: paid.reduce((s, r) => s + Number(r.amount ?? 0), 0),
      unpaidTotal: unpaid.reduce((s, r) => s + Number(r.amount ?? 0), 0),
      allocated,
      spent,
      spentRatio: allocated > 0 ? spent / allocated : 0,
    };
  });

  const active = rows.filter((r) => !["COMPLETED", "CANCELLED"].includes(r.event.status));
  const next = active.find((r) => daysUntil(r.event.eventDate, now) >= 0) ?? active[0];

  // "Needs you" — the three things most likely to need action today, each pointing at
  // the screen where it gets resolved.
  const worstOverdue = rows
    .flatMap((r) => r.overdue.items.map((item) => ({ item, row: r })))
    .sort((a, b) => b.item.days - a.item.days)[0];

  const unpaidTotal = rows.reduce((s, r) => s + r.unpaidTotal, 0);
  const unpaidEvent = rows.filter((r) => r.unpaidTotal > 0).sort((a, b) => b.unpaidTotal - a.unpaidTotal)[0];

  const waitingVendor = events
    .flatMap((event) =>
      event.budgetLines.flatMap((line) =>
        line.vendors
          .filter((v) => v.status === "AWAITING_REPLY" && v.lastContactedAt)
          .map((v) => ({ vendor: v, event, days: daysUntil(now, v.lastContactedAt!) })),
      ),
    )
    .sort((a, b) => b.days - a.days)[0];

  const stats: StatItem[] = [
    {
      figure: rows.reduce((s, r) => s + r.overdue.count, 0),
      caption: worstOverdue
        ? `items overdue — worst is “${worstOverdue.item.title}” (${worstOverdue.item.screenName}) on ${worstOverdue.row.event.name}`
        : "items overdue. Nothing has slipped.",
      tone: worstOverdue ? "danger" : "neutral",
      href: worstOverdue ? `/events/${worstOverdue.row.event.id}/schedule` : undefined,
    },
    {
      figure: formatMoney(unpaidTotal),
      caption: unpaidEvent
        ? `unpaid registrations, mostly on ${unpaidEvent.event.name}`
        : "unpaid registrations outstanding.",
      tone: unpaidTotal > 0 ? "warn" : "neutral",
      href: unpaidEvent ? `/events/${unpaidEvent.event.id}/registrants` : undefined,
    },
    {
      figure: waitingVendor ? waitingVendor.days : "—",
      caption: waitingVendor
        ? `days waiting on ${waitingVendor.vendor.name} (${waitingVendor.event.name})`
        : "no vendor replies outstanding.",
      tone: waitingVendor && waitingVendor.days > 7 ? "danger" : "neutral",
      href: waitingVendor ? `/events/${waitingVendor.event.id}/budget` : undefined,
    },
  ];

  const nextDays = next ? daysUntil(next.event.eventDate, now) : null;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Events"
        subtitle={
          events.length === 0
            ? "Nothing planned yet"
            : `${active.length} active${
                nextDays !== null && nextDays >= 0 ? ` · next one in ${nextDays} days` : ""
              }`
        }
        actions={
          canCreate && (
            <Link
              href="/events/new"
              className="flex h-11 items-center rounded-md bg-accent px-4 text-ui font-medium text-panel transition-opacity hover:opacity-90"
            >
              Create event
            </Link>
          )
        }
      />

      <StatStrip label="Needs you" items={stats} />

      <section aria-labelledby="events-heading" className="space-y-3">
        <h2 id="events-heading" className="text-micro font-medium text-ink-muted">
          Coming up
        </h2>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-rule px-6 py-10 text-center">
            <p className="font-display text-[26px] text-ink">No events yet</p>
            <p className="mt-1 text-[13px] text-ink-muted">
              {canCreate ? (
                <>
                  <Link href="/events/new" className="text-accent hover:underline">
                    Create your first event
                  </Link>{" "}
                  or start from a template.
                </>
              ) : (
                "Events you're added to will appear here."
              )}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.event.id}>
                <Link
                  href={`/events/${row.event.id}/schedule`}
                  className="group flex rounded-lg border border-rule bg-panel transition-colors hover:border-ink-muted"
                >
                  <DateStub date={row.event.eventDate} className="py-4" />
                  <div className="perforation flex min-w-0 flex-1 flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:gap-8">
                    <div className="min-w-0 lg:w-64 lg:shrink-0">
                      <p className="truncate text-[16px] font-semibold text-ink group-hover:text-accent">
                        {row.event.name}
                      </p>
                      <p className="mt-0.5 truncate text-meta text-ink-muted">
                        {[row.event.venue, displayName(row.event.owner.name, row.event.owner.email)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <StatusDot
                        status={row.event.status}
                        tone={toneForStatus(row.event.status)}
                        className="mt-2"
                      />
                    </div>

                    <dl className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
                      <Metric label="Run of show" value={`${row.doneTasks}/${row.totalTasks}`} unit="done">
                        <MicroBar value={row.doneTasks} max={row.totalTasks} color="accent" />
                      </Metric>
                      <Metric
                        label="Registration"
                        value={`${row.seats}${row.capacity !== null ? `/${row.capacity}` : ""}`}
                        unit="seats"
                      >
                        <MicroBar
                          value={row.seats}
                          max={row.capacity ?? Math.max(row.seats, 1)}
                          color="success"
                        />
                      </Metric>
                      <Metric
                        label="Budget"
                        value={formatMoney(row.spent)}
                        unit={`of ${formatMoney(row.allocated)}`}
                      >
                        {/* Past 95% of the allocation the bar turns danger — the point at
                            which someone needs to look before it goes over. */}
                        <MicroBar
                          value={row.spent}
                          max={row.allocated || 1}
                          color={row.spentRatio > 0.95 ? "danger" : "accent"}
                        />
                      </Metric>
                    </dl>

                    <Countdown
                      date={row.event.eventDate}
                      now={now}
                      size="sm"
                      className="lg:w-16 lg:items-end"
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Link href="/templates" className="inline-block text-[13px] text-accent hover:underline">
          Start an event from a template
        </Link>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  children,
}: {
  label: string;
  value: string;
  unit: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-meta text-ink-muted">{label}</dt>
      <dd className="mt-1">
        <span className="text-caption font-medium tabular-nums text-ink">{value}</span>
        <span className="ml-1 text-meta text-ink-muted">{unit}</span>
        <span className="mt-1.5 block">{children}</span>
      </dd>
    </div>
  );
}
