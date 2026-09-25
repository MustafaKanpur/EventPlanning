import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { formatShortDate, formatTime } from "@/lib/format";
import { dateInputValue, formatDay } from "@/lib/volunteers";
import { StatusDot } from "@/components/ui";
import { VolunteerFields } from "@/components/volunteer-fields";
import {
  addHours,
  approveHours,
  approveVolunteer,
  deleteHours,
  deleteVolunteer,
  updateHours,
  updateVolunteer,
} from "../actions";

const input =
  "w-full rounded-[3px] border border-rule bg-panel px-3 py-2 text-sm focus:border-accent focus:outline-none";
const button =
  "rounded-[3px] bg-accent px-3 py-1.5 text-xs font-medium text-panel transition hover:opacity-90";

export default async function VolunteerProfilePage({ params }: { params: { volunteerId: string } }) {
  const volunteer = await prisma.volunteer.findUnique({
    where: { id: params.volunteerId },
    include: {
      signups: {
        include: { shift: { include: { event: { select: { id: true, name: true } } } } },
        orderBy: { shift: { startTime: "desc" } },
      },
      hoursEntries: { include: { event: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!volunteer) notFound();

  const approved = volunteer.hoursEntries
    .filter((h) => h.status === "APPROVED")
    .reduce((sum, h) => sum + Number(h.hours), 0);
  // Hours can only go against events this person has signed up to work.
  const events = Array.from(
    new Map(volunteer.signups.map((s) => [s.shift.event.id, s.shift.event])).values(),
  );

  return (
    <div className="space-y-8">
      <div>
        <nav aria-label="Breadcrumb" className="text-caption text-ink-muted">
          <Link href="/volunteers" className="hover:text-ink">
            Volunteers
          </Link>
          <span className="px-1.5" aria-hidden="true">
            /
          </span>
          <span className="text-ink">{volunteer.name}</span>
        </nav>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{volunteer.name}</h1>
          {volunteer.status === "PENDING" ? (
            <form action={approveVolunteer.bind(null, volunteer.id)} className="flex items-center gap-3">
              <StatusDot status="PENDING" label="Pending approval" />
              <button type="submit" className={button}>
                Approve
              </button>
            </form>
          ) : (
            <StatusDot status="APPROVED" tone="success" />
          )}
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          <span className="font-mono tabular-nums text-ink">{approved}</span> approved hours · joined{" "}
          {formatDay(volunteer.joinedAt)}
        </p>
      </div>

      <details className="rounded-[3px] border border-rule bg-panel">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink hover:bg-panel-alt">
          Details
        </summary>
        <form
          action={updateVolunteer.bind(null, volunteer.id)}
          className="grid gap-3 border-t border-rule-soft px-4 py-3 sm:grid-cols-3"
        >
          <VolunteerFields volunteer={volunteer} lockEmail />
          <div className="space-y-1">
            <label htmlFor="v-joined" className="text-xs font-medium text-ink-muted">
              Date joined
            </label>
            <input
              id="v-joined"
              name="joinedAt"
              type="date"
              defaultValue={dateInputValue(volunteer.joinedAt)}
              className={input}
            />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" className={button}>
              Save
            </button>
          </div>
        </form>
      </details>

      <section className="space-y-2">
        <h2 className="text-micro uppercase text-ink-muted">Shifts</h2>
        {volunteer.signups.length === 0 ? (
          <p className="text-sm text-ink-muted">Not signed up for any shifts yet.</p>
        ) : (
          <ul className="divide-y divide-rule rounded-[3px] border border-rule bg-panel">
            {volunteer.signups.map((s) => (
              <li key={s.id} className="px-4 py-3 text-sm text-ink">
                <Link href={`/events/${s.shift.event.id}/volunteers`} className="hover:text-accent">
                  {s.shift.event.name}
                </Link>{" "}
                · {s.shift.title} ·{" "}
                <span className="text-ink-muted">
                  {formatShortDate(s.shift.startTime)} {formatTime(s.shift.startTime)}–{formatTime(s.shift.endTime)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-micro uppercase text-ink-muted">Hours</h2>
        {events.length === 0 ? (
          <p className="text-sm text-ink-muted">Hours can be logged once they&apos;ve signed up for an event.</p>
        ) : (
          <form action={addHours.bind(null, volunteer.id)} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label htmlFor="h-event" className="text-xs font-medium text-ink-muted">
                Event
              </label>
              <select id="h-event" name="eventId" required className={input}>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-24 space-y-1">
              <label htmlFor="h-hours" className="text-xs font-medium text-ink-muted">
                Hours
              </label>
              <input id="h-hours" name="hours" type="number" min="0.25" step="0.25" required className={input} />
            </div>
            <div className="space-y-1">
              <label htmlFor="h-note" className="text-xs font-medium text-ink-muted">
                Note (optional)
              </label>
              <input id="h-note" name="note" className={input} />
            </div>
            <button type="submit" className={button}>
              Log hours
            </button>
          </form>
        )}

        {volunteer.hoursEntries.length > 0 && (
          <ul className="divide-y divide-rule rounded-[3px] border border-rule bg-panel">
            {volunteer.hoursEntries.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <p className="text-ink">
                  <span className="font-mono tabular-nums">{Number(h.hours)}h</span> at {h.event.name}
                  {h.note && <span className="text-ink-muted"> · {h.note}</span>}
                </p>
                <div className="flex items-center gap-3">
                  <StatusDot status={h.status} tone={h.status === "APPROVED" ? "success" : undefined} />
                  {h.status === "PENDING" && (
                    <form action={approveHours.bind(null, volunteer.id, h.id)}>
                      <button type="submit" className={button}>
                        Approve
                      </button>
                    </form>
                  )}
                  <details>
                    <summary className="cursor-pointer list-none text-xs font-medium text-accent hover:text-ink">
                      Edit
                    </summary>
                    <form
                      action={updateHours.bind(null, volunteer.id, h.id)}
                      className="mt-2 grid w-56 gap-2 rounded-[3px] border border-rule bg-panel-alt p-3"
                    >
                      <label className="sr-only" htmlFor={`hours-${h.id}`}>
                        Hours
                      </label>
                      <input
                        id={`hours-${h.id}`}
                        name="hours"
                        type="number"
                        min="0.25"
                        step="0.25"
                        required
                        defaultValue={Number(h.hours)}
                        className={input}
                      />
                      <label className="sr-only" htmlFor={`note-${h.id}`}>
                        Note
                      </label>
                      <input id={`note-${h.id}`} name="note" defaultValue={h.note ?? ""} className={input} />
                      <button type="submit" className={button}>
                        Save (needs re-approval)
                      </button>
                    </form>
                  </details>
                  <form action={deleteHours.bind(null, volunteer.id, h.id)}>
                    <button type="submit" className="text-xs text-ink-muted hover:text-danger">
                      Delete
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="relative w-fit">
        <summary className="cursor-pointer list-none text-xs text-ink-muted hover:text-danger">
          Delete volunteer
        </summary>
        <div className="absolute left-0 z-10 mt-1 w-72 border border-rule bg-panel p-4">
          <p className="text-[13px] text-ink">
            Delete {volunteer.name}, their shift sign-ups and every hour entry? This can&apos;t be undone.
          </p>
          <form action={deleteVolunteer.bind(null, volunteer.id)} className="mt-3">
            <button type="submit" className="h-11 bg-danger px-3 text-ui text-panel transition-opacity hover:opacity-90">
              Yes, delete
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
