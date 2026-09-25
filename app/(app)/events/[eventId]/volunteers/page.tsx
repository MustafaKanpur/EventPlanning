import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { formatShortDate, formatTime } from "@/lib/format";
import { GENDERS, describeRules } from "@/lib/volunteers";
import { MicroBar, StatusDot } from "@/components/ui";
import { CopyLink } from "../registrants/copy-link";
import { addSignup, createShift, deleteShift, removeSignup } from "./actions";

const input =
  "w-full border border-rule bg-panel px-3 py-2 text-[13px] text-ink focus:border-accent focus:outline-none";

export default async function EventVolunteersPage({ params }: { params: { eventId: string } }) {
  const { eventId } = params;
  const [shifts, volunteers] = await Promise.all([
    prisma.shift.findMany({
    where: { eventId },
    include: {
      signups: {
        include: { volunteer: { select: { id: true, name: true, status: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { startTime: "asc" },
    }),
    prisma.volunteer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL ?? "";
  const signupUrl = `${base.replace(/\/$/, "")}/volunteer/${eventId}`;
  const addShift = createShift.bind(null, eventId);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-6 border-b border-rule pb-6">
        <div>
          <p className="font-mono text-[34px] leading-none tabular-nums text-ink">
            {shifts.reduce((n, s) => n + s.signups.length, 0)}
            <span className="text-ink-muted"> / {shifts.reduce((n, s) => n + s.capacity, 0)}</span>
          </p>
          <p className="mt-1.5 text-[13px] text-ink-muted">
            volunteer spots filled across {shifts.length} shift{shifts.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-micro uppercase text-ink-muted">Volunteer sign-up link</p>
          <CopyLink url={signupUrl} />
        </div>
      </section>

      {shifts.length === 0 ? (
        <p className="text-[13px] text-ink-muted">No shifts yet. Add one below, then share the sign-up link.</p>
      ) : (
        <div className="space-y-4">
          {shifts.map((shift) => {
            const rules = describeRules(shift);
            const onShift = new Set(shift.signups.map((signup) => signup.volunteer.id));
            const available = volunteers.filter((v) => !onShift.has(v.id));
            return (
              <section key={shift.id} className="border border-rule bg-panel">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule-soft px-4 py-3">
                  <div>
                    <h2 className="text-[14px] font-medium text-ink">{shift.title}</h2>
                    <p className="text-meta text-ink-muted">
                      {formatShortDate(shift.startTime)} · {formatTime(shift.startTime)}–{formatTime(shift.endTime)}
                      {rules && ` · ${rules}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-mono text-[13px] tabular-nums text-ink">
                        {shift.signups.length} / {shift.capacity}
                      </p>
                      <MicroBar
                        value={shift.signups.length}
                        max={shift.capacity}
                        color={shift.signups.length >= shift.capacity ? "warn" : "success"}
                        className="mt-1 w-24"
                      />
                    </div>
                    <form action={deleteShift.bind(null, eventId, shift.id)}>
                      <button type="submit" className="text-meta text-ink-muted hover:text-danger">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
                {shift.signups.length === 0 ? (
                  <p className="px-4 py-3 text-[13px] text-ink-muted">Nobody signed up yet.</p>
                ) : (
                  <ul className="divide-y divide-rule-soft">
                    {shift.signups.map((signup) => (
                      <li key={signup.id} className="flex items-center justify-between gap-3 px-4 py-2">
                        <Link href={`/volunteers/${signup.volunteer.id}`} className="text-[13px] text-ink hover:text-accent">
                          {signup.volunteer.name}
                        </Link>
                        <div className="flex items-center gap-4">
                          {signup.volunteer.status === "PENDING" && (
                            <StatusDot status="PENDING" label="Volunteer pending" />
                          )}
                          <form action={removeSignup.bind(null, eventId, signup.id)}>
                            <button type="submit" className="text-meta text-ink-muted hover:text-danger">
                              Remove
                            </button>
                          </form>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {shift.signups.length < shift.capacity && available.length > 0 && (
                  <form
                    action={addSignup.bind(null, eventId, shift.id)}
                    className="flex items-center gap-2 border-t border-rule-soft px-4 py-2"
                  >
                    <label className="sr-only" htmlFor={`add-${shift.id}`}>
                      Add a volunteer to {shift.title}
                    </label>
                    <select id={`add-${shift.id}`} name="volunteerId" required defaultValue="" className={`${input} max-w-xs`}>
                      <option value="" disabled>
                        Add a volunteer…
                      </option>
                      {available.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="text-meta text-accent hover:text-ink">
                      Add
                    </button>
                  </form>
                )}
              </section>
            );
          })}
        </div>
      )}

      <section>
        <h2 className="mb-2 text-micro uppercase text-ink-muted">Add a shift</h2>
        <form action={addShift} className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="s-title" className="text-caption text-ink-muted">Title</label>
            <input id="s-title" name="title" required placeholder="e.g. Registration desk" className={input} />
          </div>
          <div className="space-y-1">
            <label htmlFor="s-start" className="text-caption text-ink-muted">Start</label>
            <input id="s-start" name="startTime" type="datetime-local" required className={input} />
          </div>
          <div className="space-y-1">
            <label htmlFor="s-end" className="text-caption text-ink-muted">End</label>
            <input id="s-end" name="endTime" type="datetime-local" required className={input} />
          </div>
          <div className="space-y-1">
            <label htmlFor="s-capacity" className="text-caption text-ink-muted">Volunteers needed</label>
            <input id="s-capacity" name="capacity" type="number" min="1" required className={input} />
          </div>
          <div className="space-y-1">
            <label htmlFor="s-age" className="text-caption text-ink-muted">Minimum age (optional)</label>
            <input id="s-age" name="minAge" type="number" min="0" className={input} />
          </div>
          <div className="space-y-1">
            <label htmlFor="s-gender" className="text-caption text-ink-muted">Gender (optional)</label>
            <select id="s-gender" name="gender" defaultValue="" className={input}>
              <option value="">Anyone</option>
              {GENDERS.filter((g) => g !== "Prefer not to say").map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="s-hours" className="text-caption text-ink-muted">Min. approved hours (optional)</label>
            <input id="s-hours" name="minHours" type="number" min="0" className={input} />
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="h-11 bg-accent px-4 text-ui text-panel transition-opacity hover:opacity-90">
              Add shift
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
