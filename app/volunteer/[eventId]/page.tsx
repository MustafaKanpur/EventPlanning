import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { formatShortDate, formatTime } from "@/lib/format";
import { describeRules } from "@/lib/volunteers";
import { VolunteerFields } from "@/components/volunteer-fields";
import { signUpForShift } from "../actions";

export default async function EventVolunteerSignupPage({
  params,
  searchParams,
}: {
  params: { eventId: string };
  searchParams: { success?: string; error?: string };
}) {
  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    include: {
      shifts: { include: { _count: { select: { signups: true } } }, orderBy: { startTime: "asc" } },
    },
  });
  if (!event) notFound();

  const open = event.shifts.filter((s) => s._count.signups < s.capacity);
  const signUp = signUpForShift.bind(null, event.id);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ground px-4 py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/10 bg-panel p-8">
        <div className="space-y-1 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Volunteer at</p>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{event.name}</h1>
        </div>

        {event.status === "CANCELLED" ? (
          <p className="rounded-[3px] bg-panel-alt px-4 py-3 text-center text-sm text-danger">
            This event has been cancelled.
          </p>
        ) : searchParams.success === "1" ? (
          <p className="border border-rule bg-panel-alt px-4 py-3 text-center text-sm text-ink">
            You&apos;re signed up. See you there!
          </p>
        ) : open.length === 0 ? (
          <p className="border border-rule bg-panel-alt px-4 py-3 text-center text-sm text-ink">
            {event.shifts.length === 0 ? "No shifts are open yet." : "Every shift is full."}
          </p>
        ) : (
          <form action={signUp} className="space-y-4">
            {searchParams.error && (
              <p role="alert" className="border border-rule bg-panel-alt px-4 py-3 text-sm text-danger">
                {searchParams.error}
              </p>
            )}
            <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

            <fieldset className="space-y-2">
              <legend className="mb-1 text-xs font-medium text-ink-muted">Shift</legend>
              {event.shifts.map((shift) => {
                const left = shift.capacity - shift._count.signups;
                const rules = describeRules(shift);
                return (
                  <label
                    key={shift.id}
                    className={`flex gap-3 rounded-[3px] border border-rule px-3 py-2 text-sm ${left <= 0 ? "opacity-50" : "cursor-pointer"}`}
                  >
                    <input type="radio" name="shiftId" value={shift.id} required disabled={left <= 0} className="mt-1" />
                    <span>
                      <span className="block text-ink">{shift.title}</span>
                      <span className="block text-xs text-ink-muted">
                        {formatShortDate(shift.startTime)} · {formatTime(shift.startTime)}–{formatTime(shift.endTime)} ·{" "}
                        {left <= 0 ? "Full" : `${left} spot${left === 1 ? "" : "s"} left`}
                        {rules && ` · ${rules}`}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <VolunteerFields />
            <button
              type="submit"
              className="w-full rounded-[3px] bg-accent px-4 py-2 text-sm font-medium text-panel transition hover:opacity-90"
            >
              Sign up
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
