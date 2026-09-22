import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { MicroBar, Money, StatusDot, toneForStatus } from "@/components/ui";
import {
  answersOf,
  choicesOf,
  displayAnswer,
  filterParam,
  getRegistrationForm,
  matchesFilters,
  readFilters,
} from "@/lib/registration-form";
import { updateRegistrant } from "./actions";
import { CopyLink } from "./copy-link";

const STATUS_OPTIONS = ["UNPAID", "PENDING", "PAID", "REFUNDED"] as const;
const field =
  "w-full border border-rule bg-panel px-3 py-2 text-[13px] text-ink focus:border-accent focus:outline-none";

/** Unpaid first — they're the ones needing chasing — then by newest registration. */
const SORT_WEIGHT: Record<string, number> = { UNPAID: 0, PENDING: 1, PAID: 2, REFUNDED: 3 };

export default async function RegistrationPage({
  params,
  searchParams,
}: {
  params: { eventId: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { eventId } = params;

  const [event, registrants, budgetLines, form] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: { capacity: true, name: true },
    }),
    prisma.registrant.findMany({
      where: { eventId },
      include: { budgetLine: { select: { id: true, category: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.budgetLine.findMany({ where: { eventId }, orderBy: { category: "asc" } }),
    getRegistrationForm(eventId),
  ]);

  // Custom questions become columns, and each one becomes a filter.
  const customFields = form?.fields ?? [];
  const filters = readFilters(customFields, searchParams);
  const visible = registrants.filter((r) => matchesFilters(answersOf(r), filters));

  const sorted = [...visible].sort(
    (a, b) => (SORT_WEIGHT[a.paymentStatus] ?? 9) - (SORT_WEIGHT[b.paymentStatus] ?? 9),
  );

  const paid = visible.filter((r) => r.paymentStatus === "PAID");
  const revenue = paid.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  const outstanding = visible
    .filter((r) => r.paymentStatus === "UNPAID" || r.paymentStatus === "PENDING")
    .reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  const capacity = event?.capacity ?? null;

  // The public URL should be the deployed one, not whatever host this happens to run on.
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL ?? "";
  const registrationUrl = `${base.replace(/\/$/, "")}/register/${eventId}`;

  // Which line paid registrations credit. Registrants carry the link individually; this
  // reports the one they mostly use, so the budget connection is visible from here too.
  const postsTo = paid.find((r) => r.budgetLine)?.budgetLine ?? null;

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-6 border-b border-rule pb-6">
        <div>
          <p className="font-mono text-[34px] leading-none tabular-nums text-ink">
            {visible.length}
            {capacity !== null && <span className="text-ink-muted"> / {capacity}</span>}
          </p>
          <p className="mt-1.5 text-[13px] text-ink-muted">
            {capacity !== null ? "seats taken" : "registered"} ·{" "}
            <span className="font-mono tabular-nums text-ink">{formatMoney(revenue)}</span>{" "}
            collected
            {outstanding > 0 && (
              <>
                {" "}
                · <span className="font-mono tabular-nums text-danger">
                  {formatMoney(outstanding)}
                </span>{" "}
                outstanding
              </>
            )}
          </p>
          {capacity !== null && (
            <MicroBar
              value={visible.length}
              max={capacity}
              color={registrants.length >= capacity ? "warn" : "success"}
              className="mt-3 w-64"
            />
          )}
          <p className="mt-3 text-meta text-ink-muted">
            Revenue posts to:{" "}
            {postsTo ? (
              <Link href={`/events/${eventId}/budget`} className="text-accent hover:underline">
                {postsTo.category}
              </Link>
            ) : (
              <Link href={`/events/${eventId}/budget`} className="text-accent hover:underline">
                no budget line yet
              </Link>
            )}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-micro uppercase text-ink-muted">Public registration link</p>
          <CopyLink url={registrationUrl} />
          <p className="pt-1 text-right">
            <Link
              href={`/events/${eventId}/registrants/form`}
              className="text-ui text-ink-muted transition-colors hover:text-ink"
            >
              Customise form
              {customFields.length > 0 && (
                <span className="text-ink-muted"> · {customFields.length} extra question
                  {customFields.length === 1 ? "" : "s"}</span>
              )}
            </Link>
          </p>
        </div>
      </section>

      {customFields.length > 0 && (
        <form method="GET" className="flex flex-wrap items-end gap-3 border-b border-rule pb-4">
          <p className="text-micro uppercase text-ink-muted">Filter</p>
          {customFields.map((f) => {
            const current = filters.find((x) => x.field.key === f.key)?.value ?? "";
            const id = `filter-${f.key}`;
            if (f.type === "SELECT" || f.type === "MULTI_SELECT") {
              return (
                <div key={f.id} className="space-y-1">
                  <label className="block text-caption text-ink-muted" htmlFor={id}>
                    {f.label}
                  </label>
                  <select
                    id={id}
                    name={filterParam(f)}
                    defaultValue={current}
                    className="h-11 border border-rule bg-panel px-2 text-[13px] text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="">Any</option>
                    {choicesOf(f).map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }
            if (f.type === "CHECKBOX") {
              return (
                <div key={f.id} className="space-y-1">
                  <label className="block text-caption text-ink-muted" htmlFor={id}>
                    {f.label}
                  </label>
                  <select
                    id={id}
                    name={filterParam(f)}
                    defaultValue={current}
                    className="h-11 border border-rule bg-panel px-2 text-[13px] text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="">Any</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              );
            }
            return (
              <div key={f.id} className="space-y-1">
                <label className="block text-caption text-ink-muted" htmlFor={id}>
                  {f.label}
                </label>
                <input
                  id={id}
                  name={filterParam(f)}
                  defaultValue={current}
                  placeholder="Contains…"
                  className="h-11 w-40 border border-rule bg-panel px-2 text-[13px] text-ink focus:border-accent focus:outline-none"
                />
              </div>
            );
          })}
          <button
            type="submit"
            className="h-11 border border-rule px-3 text-ui text-ink transition-colors hover:bg-panel-alt"
          >
            Apply
          </button>
          {filters.length > 0 && (
            <Link
              href={`/events/${eventId}/registrants`}
              className="flex h-11 items-center text-ui text-ink-muted hover:text-ink"
            >
              Clear ({filters.length})
            </Link>
          )}
        </form>
      )}

      <div className="overflow-x-auto border border-rule bg-panel">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="h-head border-b border-rule bg-panel-alt">
              {["Name", "Email", "Tier", "Amount", "Paid", "Registered"].map((label, i) => (
                <th
                  key={label}
                  scope="col"
                  className={`px-4 text-micro font-medium uppercase text-ink-muted ${
                    i === 3 ? "text-right" : "text-left"
                  }`}
                >
                  {label}
                </th>
              ))}
              {customFields.map((f) => (
                <th
                  key={f.id}
                  scope="col"
                  className="px-4 text-micro font-medium uppercase text-ink-muted"
                >
                  {f.label}
                </th>
              ))}
              <th scope="col" className="px-4 text-micro font-medium uppercase text-ink-muted">
                Budget line
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule-soft">
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={7 + customFields.length}
                  className="px-4 py-10 text-[13px] text-ink-muted"
                >
                  {filters.length > 0
                    ? "No registrations match these filters."
                    : "Nobody has registered yet. Share the link above to start taking sign-ups."}
                </td>
              </tr>
            ) : (
              sorted.map((registrant) => {
                const update = updateRegistrant.bind(null, eventId, registrant.id);
                const amount = Number(registrant.amount ?? 0);
                return (
                  <tr key={registrant.id} className="align-top">
                    <td className="px-4 py-4">
                      <p className="text-[14px] text-ink">{registrant.name}</p>
                      {registrant.notes && (
                        <p className="mt-0.5 whitespace-pre-line text-meta text-ink-muted">
                          {registrant.notes}
                        </p>
                      )}
                      <details className="mt-1">
                        <summary className="cursor-pointer list-none text-meta text-ink-muted hover:text-ink">
                          Edit
                        </summary>
                        <form action={update} className="mt-2 w-64 space-y-2">
                          <input
                            type="hidden"
                            name="paymentStatus"
                            value={registrant.paymentStatus}
                          />
                          <input
                            type="hidden"
                            name="budgetLineId"
                            value={registrant.budgetLineId ?? ""}
                          />
                          <input
                            name="name"
                            defaultValue={registrant.name}
                            aria-label="Name"
                            className={field}
                          />
                          <input
                            name="email"
                            type="email"
                            defaultValue={registrant.email}
                            aria-label="Email"
                            className={field}
                          />
                          <input
                            name="amount"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={amount}
                            aria-label="Amount"
                            className={field}
                          />
                          <textarea
                            name="notes"
                            rows={2}
                            defaultValue={registrant.notes ?? ""}
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
                      </details>
                    </td>
                    <td className="px-4 py-4 text-[13px] text-ink-muted">
                      <a href={`mailto:${registrant.email}`} className="hover:text-accent">
                        {registrant.email}
                      </a>
                    </td>
                    <td className="px-4 py-4 text-[13px] text-ink-muted">
                      {amount >= 300 ? "Patron" : amount > 0 ? "Standard" : "Guest"}
                    </td>
                    <td className="px-4 py-4">
                      <Money amount={amount} />
                    </td>
                    <td className="px-4 py-4">
                      <StatusDot
                        status={registrant.paymentStatus}
                        tone={toneForStatus(registrant.paymentStatus)}
                      />
                    </td>
                    <td className="px-4 py-4 font-mono text-meta tabular-nums text-ink-muted">
                      {registrant.createdAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    {customFields.map((f) => (
                      <td key={f.id} className="px-4 py-4 text-[13px] text-ink-muted">
                        {displayAnswer(f, answersOf(registrant)[f.key])}
                      </td>
                    ))}
                    <td className="px-4 py-4">
                      <form action={update} className="flex flex-wrap items-center gap-2">
                        <label className="sr-only" htmlFor={`status-${registrant.id}`}>
                          Payment status
                        </label>
                        <select
                          id={`status-${registrant.id}`}
                          name="paymentStatus"
                          defaultValue={registrant.paymentStatus}
                          className="h-11 border border-rule bg-panel px-2 text-caption text-ink focus:border-accent focus:outline-none"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <label className="sr-only" htmlFor={`line-${registrant.id}`}>
                          Budget line
                        </label>
                        <select
                          id={`line-${registrant.id}`}
                          name="budgetLineId"
                          defaultValue={registrant.budgetLineId ?? ""}
                          className="h-11 border border-rule bg-panel px-2 text-caption text-ink focus:border-accent focus:outline-none"
                        >
                          <option value="">No line</option>
                          {budgetLines.map((line) => (
                            <option key={line.id} value={line.id}>
                              {line.category}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="h-11 px-1 text-meta text-ink-muted hover:text-ink"
                        >
                          Save
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
