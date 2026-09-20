import Link from "next/link";

import { getCurrentTeamMember } from "@/lib/current-team-member";
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
  MicroBar,
  PageHeader,
  StatStrip,
  StatusDot,
  toneForStatus,
  type StatItem,
} from "@/components/ui";

export default async function DashboardPage() {
  const me = await getCurrentTeamMember();

  const events = me
    ? await prisma.event.findMany({
        where: { OR: [{ ownerId: me.id }, { members: { some: { teamMemberId: me.id } } }] },
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
          scheduleItems: { select: { id: true } },
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
    <div className="space-y-8">
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
          <Link
            href="/events/new"
            className="flex h-11 items-center border border-rule px-3 text-ui text-ink transition-colors hover:bg-panel-alt"
          >
            + Create event
          </Link>
        }
      />

      <StatStrip label="Needs you" items={stats} />

      <div className="overflow-x-auto border border-rule bg-panel">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="h-head border-b border-rule bg-panel-alt">
              {[
                ["Event", "left"],
                ["When", "left"],
                ["Run of show", "left"],
                ["Registration", "left"],
                ["Budget", "left"],
                ["Status", "right"],
              ].map(([label, align]) => (
                <th
                  key={label}
                  scope="col"
                  className={`px-4 text-micro font-medium uppercase text-ink-muted ${
                    align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-rule-soft">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-[13px] text-ink-muted">
                  No events yet.{" "}
                  <Link href="/events/new" className="text-accent hover:underline">
                    Create your first one
                  </Link>{" "}
                  to get started.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.event.id} className="h-row align-middle">
                  <td className="px-4 py-3">
                    <Link
                      href={`/events/${row.event.id}/schedule`}
                      className="text-[14px] text-ink hover:text-accent"
                    >
                      {row.event.name}
                    </Link>
                    <p className="mt-0.5 text-meta text-ink-muted">
                      {[row.event.venue, displayName(row.event.owner.name, row.event.owner.email)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Countdown date={row.event.eventDate} now={now} size="sm" />
                  </td>
                  <td className="w-40 px-4 py-3">
                    <span className="font-mono text-caption tabular-nums text-ink">
                      {row.doneTasks}/{row.totalTasks}
                    </span>
                    <span className="ml-1 text-meta text-ink-muted">done</span>
                    <MicroBar
                      value={row.doneTasks}
                      max={row.totalTasks}
                      color="accent"
                      className="mt-1.5"
                    />
                  </td>
                  <td className="w-40 px-4 py-3">
                    <span className="font-mono text-caption tabular-nums text-ink">
                      {row.seats}
                      {row.capacity !== null ? `/${row.capacity}` : ""}
                    </span>
                    <span className="ml-1 text-meta text-ink-muted">seats</span>
                    <MicroBar
                      value={row.seats}
                      max={row.capacity ?? Math.max(row.seats, 1)}
                      color="success"
                      className="mt-1.5"
                    />
                  </td>
                  <td className="w-44 px-4 py-3">
                    <span className="font-mono text-caption tabular-nums text-ink">
                      {formatMoney(row.spent)}
                    </span>
                    <span className="ml-1 text-meta text-ink-muted">
                      of {formatMoney(row.allocated)}
                    </span>
                    {/* Past 95% of the allocation the bar turns danger — the point at
                        which someone needs to look before it goes over. */}
                    <MicroBar
                      value={row.spent}
                      max={row.allocated || 1}
                      color={row.spentRatio > 0.95 ? "danger" : "accent"}
                      className="mt-1.5"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StatusDot
                      status={row.event.status}
                      tone={toneForStatus(row.event.status)}
                      className="justify-end"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-rule">
              <td colSpan={6} className="px-4 py-3">
                <Link href="/templates" className="text-[13px] text-accent hover:underline">
                  Start an event from a template →
                </Link>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
