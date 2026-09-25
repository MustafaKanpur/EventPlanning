import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { dateInputValue, formatDay } from "@/lib/volunteers";
import { StatusDot } from "@/components/ui";
import { VolunteerFields } from "@/components/volunteer-fields";
import { CopyLink } from "@/app/(app)/events/[eventId]/registrants/copy-link";
import { addVolunteer, approveHours, approveVolunteer } from "./actions";

const button =
  "rounded-[3px] bg-accent px-3 py-1.5 text-xs font-medium text-panel transition hover:opacity-90";

export default async function VolunteersPage() {
  const [volunteers, approvedHours, pendingHours] = await Promise.all([
    prisma.volunteer.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] }),
    prisma.hoursEntry.groupBy({
      by: ["volunteerId"],
      where: { status: "APPROVED" },
      _sum: { hours: true },
    }),
    prisma.hoursEntry.findMany({
      where: { status: "PENDING" },
      include: { volunteer: { select: { name: true } }, event: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const hoursBy = new Map(approvedHours.map((h) => [h.volunteerId, Number(h._sum.hours ?? 0)]));

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL ?? "";
  const signupUrl = `${base.replace(/\/$/, "")}/volunteer`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Volunteers</h1>
          <p className="text-sm text-ink-muted">
            Everyone who volunteers with the organization. Shifts live on each event&apos;s Volunteers tab.
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-micro uppercase text-ink-muted">Volunteer sign-up link</p>
          <CopyLink url={signupUrl} />
        </div>
      </div>

      <details className="rounded-[3px] border border-rule bg-panel">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink hover:bg-panel-alt">
          + Add volunteer
        </summary>
        <form action={addVolunteer} className="grid gap-3 border-t border-rule-soft px-4 py-3 sm:grid-cols-3">
          <VolunteerFields />
          <div className="space-y-1">
            <label htmlFor="v-joined" className="text-xs font-medium text-ink-muted">
              Date joined
            </label>
            <input
              id="v-joined"
              name="joinedAt"
              type="date"
              defaultValue={dateInputValue(new Date())}
              className="w-full rounded-[3px] border border-rule bg-panel px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" className={button}>
              Add
            </button>
          </div>
        </form>
      </details>

      {pendingHours.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-micro uppercase text-ink-muted">Hours awaiting approval</h2>
          <div className="divide-y divide-rule rounded-[3px] border border-rule bg-panel">
            {pendingHours.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <p className="text-ink">
                  <Link href={`/volunteers/${entry.volunteerId}`} className="hover:text-accent">
                    {entry.volunteer.name}
                  </Link>{" "}
                  · <span className="font-mono tabular-nums">{Number(entry.hours)}h</span> at {entry.event.name}
                  {entry.note && <span className="text-ink-muted"> · {entry.note}</span>}
                </p>
                <form action={approveHours.bind(null, entry.volunteerId, entry.id)}>
                  <button type="submit" className={button}>
                    Approve
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {volunteers.length === 0 ? (
        <div className="rounded-[3px] border border-rule bg-panel px-4 py-10">
          <p className="text-ink-muted">No volunteers yet. Share the sign-up link, or add someone above.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[3px] border border-rule bg-panel">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-rule bg-panel-alt">
                {["Name", "Email", "Phone", "Hours", "Joined", "Status"].map((label) => (
                  <th key={label} scope="col" className="px-4 py-2 text-micro font-medium uppercase text-ink-muted">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-rule-soft">
              {volunteers.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-3">
                    <Link href={`/volunteers/${v.id}`} className="text-ink hover:text-accent">
                      {v.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{v.email}</td>
                  <td className="px-4 py-3 text-ink-muted">{v.phone ?? "—"}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-ink">{hoursBy.get(v.id) ?? 0}</td>
                  <td className="px-4 py-3 text-ink-muted">{formatDay(v.joinedAt)}</td>
                  <td className="px-4 py-3">
                    {v.status === "PENDING" ? (
                      <form action={approveVolunteer.bind(null, v.id)} className="flex items-center gap-3">
                        <StatusDot status="PENDING" />
                        <button type="submit" className={button}>
                          Approve
                        </button>
                      </form>
                    ) : (
                      <StatusDot status="APPROVED" tone="success" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
