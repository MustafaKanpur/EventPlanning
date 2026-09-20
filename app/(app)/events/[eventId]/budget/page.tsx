import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { budgetTotals, toLedger } from "@/lib/budget";
import { getCurrencyRollups } from "@/lib/rollups";
import { Money, StatusDot } from "@/components/ui";
import { ReferencedBy } from "@/components/screens/referenced-by";
import { SpendBar } from "./spend-bar";
import {
  createBudgetLine,
  createBudgetLineItem,
  createVendor,
  deleteBudgetLine,
  deleteBudgetLineItem,
  deleteVendor,
  updateBudgetLine,
  updateBudgetLineItem,
  updateVendor,
} from "./actions";

const field =
  "w-full border border-rule bg-panel px-3 py-2 text-[13px] text-ink focus:border-accent focus:outline-none";
const textButton = "text-ui text-ink-muted transition-colors hover:text-ink";
const smallButton = "h-11 border border-rule px-3 text-ui text-ink transition-colors hover:bg-panel-alt";

const COLUMNS = [
  { key: "category", label: "Category" },
  { key: "vendor", label: "Vendor" },
  { key: "planned", label: "Planned", align: "right" as const },
  { key: "committed", label: "Committed", align: "right" as const },
  { key: "actual", label: "Actual", align: "right" as const },
  { key: "variance", label: "Variance", align: "right" as const },
  { key: "status", label: "Status" },
];

export default async function BudgetPage({ params }: { params: { eventId: string } }) {
  const { eventId } = params;

  const [event, lines, paidRegistrants, rollupsByLine] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { fundraisingGoal: true } }),
    prisma.budgetLine.findMany({
      where: { eventId },
      include: { lineItems: { orderBy: { position: "asc" } }, vendors: { orderBy: { name: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.registrant.findMany({
      where: { eventId, paymentStatus: "PAID" },
      select: { amount: true },
    }),
    getCurrencyRollups(eventId),
  ]);

  const ledger = toLedger(lines, rollupsByLine);
  const revenue = paidRegistrants.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  const totals = budgetTotals(ledger, revenue);
  const goal = event?.fundraisingGoal ? Number(event.fundraisingGoal) : null;

  const addLine = createBudgetLine.bind(null, eventId);
  const lineById = new Map(lines.map((l) => [l.id, l]));

  return (
    <div className="space-y-8">
      <SpendBar totals={totals} goal={goal} />

      {/* One line of figures, not a grid of tiles. */}
      <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-[13px] tabular-nums text-ink-muted">
        <span>
          Allocated <span className="text-ink">{formatMoney(totals.allocated)}</span>
        </span>
        <span>
          Committed <span className="text-ink">{formatMoney(totals.committed)}</span>
        </span>
        <span>
          Actual <span className="text-ink">{formatMoney(totals.actual)}</span>
        </span>
        <span>
          Registration <span className="text-ink">{formatMoney(totals.revenue)}</span>
        </span>
        <span>
          Net{" "}
          <span className={totals.net < 0 ? "text-danger" : "text-ink"}>
            {formatMoney(totals.net)}
          </span>
        </span>
        {/* No goal set → no goal comparison at all, rather than a bare negative. */}
        {goal !== null && (
          <span>
            vs goal{" "}
            <span className={totals.revenue - goal < 0 ? "text-danger" : "text-ink"}>
              {formatMoney(totals.revenue - goal, { signed: true })}
            </span>
          </span>
        )}
      </p>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3">
          <h2 className="font-display text-[22px] font-normal leading-none text-ink">Ledger</h2>
          <details className="relative">
            <summary className={`cursor-pointer list-none ${textButton}`}>+ Add category</summary>
            <form
              action={addLine}
              className="absolute right-0 z-20 mt-2 w-80 space-y-2 border border-rule bg-panel p-4"
            >
              <div className="space-y-1">
                <label className="block text-caption text-ink-muted" htmlFor="new-category">
                  Category
                </label>
                <input id="new-category" name="category" required placeholder="Food" className={field} />
              </div>
              <div className="space-y-1">
                <label className="block text-caption text-ink-muted" htmlFor="new-allocated">
                  Planned budget
                </label>
                <input
                  id="new-allocated"
                  name="allocatedAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                  className={field}
                />
              </div>
              <textarea name="notes" rows={2} placeholder="Notes (optional)" className={field} />
              <button
                type="submit"
                className="h-11 w-full bg-accent text-ui text-panel transition-opacity hover:opacity-90"
              >
                Add category
              </button>
            </form>
          </details>
        </div>

        <div className="overflow-x-auto border border-rule bg-panel">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="h-head border-b border-rule bg-panel-alt">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={`px-4 text-micro font-medium uppercase text-ink-muted ${
                      col.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-rule-soft">
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-10 text-[13px] text-ink-muted">
                    No categories yet. Add one to start tracking spend against the event.
                  </td>
                </tr>
              ) : (
                ledger.map((row) => (
                  <LedgerRow
                    key={row.id}
                    eventId={eventId}
                    row={row}
                    source={lineById.get(row.id)!}
                  />
                ))
              )}

              {/* Money coming in, shown in the same ledger as money going out — the link
                  between registration and budget is the point of the app. */}
              <tr className="border-t border-rule bg-accent/[0.06]">
                <td className="px-4 py-4">
                  <Link
                    href={`/events/${eventId}/registrants`}
                    className="text-[13px] text-accent hover:underline"
                  >
                    Registration revenue
                  </Link>
                  <p className="text-meta text-ink-muted">auto-posted from registration</p>
                </td>
                <td className="px-4 py-4 text-[13px] text-ink-muted">
                  {paidRegistrants.length} paid
                </td>
                <td className="px-4 py-4" />
                <td className="px-4 py-4" />
                <td className="px-4 py-4">
                  <span className="block text-right font-mono tabular-nums text-accent">
                    +{formatMoney(revenue)}
                  </span>
                </td>
                <td className="px-4 py-4" />
                <td className="px-4 py-4">
                  <StatusDot status="income" label="Income" tone="accent" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

type SourceLine = {
  id: string;
  notes: string | null;
  allocatedAmount: unknown;
  lineItems: {
    id: string;
    name: string;
    plannedAmount: unknown;
    actualAmount: unknown;
    notes: string | null;
  }[];
  vendors: { id: string; name: string; contactEmail: string | null; notes: string | null }[];
};

function LedgerRow({
  eventId,
  row,
  source,
}: {
  eventId: string;
  row: ReturnType<typeof toLedger>[number];
  source: SourceLine;
}) {
  const editLine = updateBudgetLine.bind(null, eventId, row.id);
  const removeLine = deleteBudgetLine.bind(null, eventId, row.id);
  const addItem = createBudgetLineItem.bind(null, eventId, row.id);
  const addVendor = createVendor.bind(null, eventId, row.id);

  return (
    <>
      <tr className="align-top">
        <td className="px-4 py-4">
          <p className="text-[14px] text-ink">{row.category}</p>
          {row.notes && (
            <p className="mt-0.5 whitespace-pre-line text-meta text-ink-muted">{row.notes}</p>
          )}
          {/* Where committed money came from, when it came from a screen rather than a
              line item. Without attribution the Committed figure is unexplainable. */}
          {row.rollups.map((rollup) => (
            <p key={rollup.screenId} className="mt-0.5 text-meta text-accent">
              <Link
                href={`/events/${eventId}/screens/${rollup.screenId}`}
                className="hover:underline"
              >
                from {rollup.screenName}
              </Link>{" "}
              <span className="text-ink-muted">
                — {rollup.recordCount} record{rollup.recordCount === 1 ? "" : "s"} ·{" "}
                <span className="font-mono tabular-nums">{formatMoney(rollup.total)}</span>
              </span>
            </p>
          ))}
        </td>
        <td className="px-4 py-4 text-[13px] text-ink-muted">
          {row.vendors.length ? row.vendors.join(", ") : "—"}
        </td>
        <td className="px-4 py-4">
          <Money amount={row.planned} />
        </td>
        <td className="px-4 py-4">
          <Money amount={row.committed} />
        </td>
        <td className="px-4 py-4">
          <Money amount={row.actual} />
        </td>
        <td className="px-4 py-4">
          <Money amount={row.variance} colorNegative />
        </td>
        <td className="px-4 py-4">
          <StatusDot status={row.status.label} label={row.status.label} tone={row.status.tone} />
        </td>
      </tr>

      <tr>
        <td colSpan={7} className="px-4 pb-4">
          <details>
            <summary className="cursor-pointer list-none text-meta text-ink-muted hover:text-ink">
              {source.lineItems.length} line item
              {source.lineItems.length === 1 ? "" : "s"} · {source.vendors.length} vendor
              {source.vendors.length === 1 ? "" : "s"}
            </summary>

            <div className="mt-3 grid gap-6 border-t border-rule-soft pt-3 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-micro uppercase text-ink-muted">Line items</h3>
                {source.lineItems.length === 0 ? (
                  <p className="text-[13px] text-ink-muted">Nothing itemised yet.</p>
                ) : (
                  <ul className="divide-y divide-rule-soft">
                    {source.lineItems.map((item) => {
                      const editItem = updateBudgetLineItem.bind(null, eventId, item.id);
                      const removeItem = deleteBudgetLineItem.bind(null, eventId, item.id);
                      return (
                        <li key={item.id} className="py-2">
                          <div className="flex items-baseline justify-between gap-3 text-[13px]">
                            <span className="text-ink">{item.name}</span>
                            <span className="font-mono tabular-nums text-ink-muted">
                              {formatMoney(item.plannedAmount as number)} planned ·{" "}
                              {formatMoney(item.actualAmount as number)} actual
                            </span>
                          </div>
                          {item.notes && (
                            <p className="whitespace-pre-line text-meta text-ink-muted">
                              {item.notes}
                            </p>
                          )}
                          <details className="mt-1">
                            <summary className="cursor-pointer list-none text-meta text-ink-muted hover:text-ink">
                              Edit
                            </summary>
                            <form action={editItem} className="mt-2 flex flex-wrap items-end gap-2">
                              <input name="name" defaultValue={item.name} className={`${field} w-40`} />
                              <input
                                name="plannedAmount"
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={Number(item.plannedAmount)}
                                aria-label="Planned"
                                className={`${field} w-28`}
                              />
                              <input
                                name="actualAmount"
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={Number(item.actualAmount)}
                                aria-label="Actual"
                                className={`${field} w-28`}
                              />
                              <textarea
                                name="notes"
                                rows={2}
                                defaultValue={item.notes ?? ""}
                                placeholder="Notes"
                                className={field}
                              />
                              <button type="submit" className={smallButton}>
                                Save
                              </button>
                            </form>
                            <form action={removeItem} className="mt-1">
                              <button
                                type="submit"
                                className="text-meta text-ink-muted hover:text-danger"
                              >
                                Delete
                              </button>
                            </form>
                          </details>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <details className="mt-2">
                  <summary className="cursor-pointer list-none text-meta text-ink-muted hover:text-ink">
                    + Add line item
                  </summary>
                  <form action={addItem} className="mt-2 flex flex-wrap items-end gap-2">
                    <input
                      name="name"
                      required
                      placeholder="Catering deposit"
                      className={`${field} w-40`}
                    />
                    <input
                      name="plannedAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue="0"
                      aria-label="Planned"
                      className={`${field} w-28`}
                    />
                    <input
                      name="actualAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue="0"
                      aria-label="Actual"
                      className={`${field} w-28`}
                    />
                    <button type="submit" className={smallButton}>
                      Add
                    </button>
                  </form>
                </details>
              </div>

              <div>
                <h3 className="mb-2 text-micro uppercase text-ink-muted">Vendors</h3>
                {source.vendors.length === 0 ? (
                  <p className="text-[13px] text-ink-muted">No vendors on this category.</p>
                ) : (
                  <ul className="divide-y divide-rule-soft">
                    {source.vendors.map((vendor) => {
                      const editVendor = updateVendor.bind(null, eventId, vendor.id);
                      const removeVendor = deleteVendor.bind(null, eventId, vendor.id);
                      return (
                        <li key={vendor.id} className="py-2 text-[13px]">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-ink">{vendor.name}</span>
                            {vendor.contactEmail && (
                              <a
                                href={`mailto:${vendor.contactEmail}`}
                                className="text-meta text-accent hover:underline"
                              >
                                {vendor.contactEmail}
                              </a>
                            )}
                          </div>
                          {vendor.notes && (
                            <p className="whitespace-pre-line text-meta text-ink-muted">
                              {vendor.notes}
                            </p>
                          )}
                          {/* Where this vendor turns up on user-built screens. */}
                          <ReferencedBy
                            eventId={eventId}
                            targetType="VENDOR"
                            targetId={vendor.id}
                            heading="Booked on"
                            className="mt-1"
                          />
                          <details className="mt-1">
                            <summary className="cursor-pointer list-none text-meta text-ink-muted hover:text-ink">
                              Edit
                            </summary>
                            <form action={editVendor} className="mt-2 space-y-2">
                              <input name="name" defaultValue={vendor.name} className={field} />
                              <input
                                name="contactEmail"
                                type="email"
                                defaultValue={vendor.contactEmail ?? ""}
                                placeholder="Contact email"
                                className={field}
                              />
                              <textarea
                                name="notes"
                                rows={2}
                                defaultValue={vendor.notes ?? ""}
                                placeholder="Notes"
                                className={field}
                              />
                              <button type="submit" className={smallButton}>
                                Save
                              </button>
                            </form>
                            <form action={removeVendor} className="mt-1">
                              <button
                                type="submit"
                                className="text-meta text-ink-muted hover:text-danger"
                              >
                                Delete
                              </button>
                            </form>
                          </details>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <details className="mt-2">
                  <summary className="cursor-pointer list-none text-meta text-ink-muted hover:text-ink">
                    + Add vendor
                  </summary>
                  <form action={addVendor} className="mt-2 flex flex-wrap items-end gap-2">
                    <input name="name" required placeholder="Vendor name" className={`${field} w-44`} />
                    <input
                      name="contactEmail"
                      type="email"
                      placeholder="Contact email"
                      className={`${field} w-52`}
                    />
                    <button type="submit" className={smallButton}>
                      Add
                    </button>
                  </form>
                </details>
              </div>
            </div>

            {/* What user-built screens draw on this line — the budget doesn't know
                which screens exist, it just asks what points at it. */}
            <ReferencedBy
              eventId={eventId}
              targetType="BUDGET_LINE"
              targetId={row.id}
              className="mt-4 border-t border-rule-soft pt-3"
            />

            <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-rule-soft pt-3">
              <form action={editLine} className="flex flex-wrap items-end gap-2">
                <input
                  name="category"
                  defaultValue={row.category}
                  aria-label="Category"
                  className={`${field} w-40`}
                />
                <input
                  name="allocatedAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={row.planned}
                  aria-label="Planned budget"
                  className={`${field} w-32`}
                />
                <input
                  name="notes"
                  defaultValue={row.notes ?? ""}
                  placeholder="Notes"
                  className={`${field} w-56`}
                />
                <button type="submit" className={smallButton}>
                  Save category
                </button>
              </form>
              <form action={removeLine}>
                <button type="submit" className="h-11 px-2 text-meta text-ink-muted hover:text-danger">
                  Delete category
                </button>
              </form>
            </div>
          </details>
        </td>
      </tr>
    </>
  );
}
