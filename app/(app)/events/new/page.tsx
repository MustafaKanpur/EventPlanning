import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { ensureBuiltInTemplates } from "@/lib/templates";
import { PageHeader } from "@/components/ui";
import { createEvent } from "./actions";
import { TemplatePicker } from "./template-picker";

const field =
  "w-full border border-rule bg-panel px-3 py-2 text-[14px] text-ink focus:border-accent focus:outline-none";
const label = "mb-1 block text-[12.5px] text-ink-muted";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: { template?: string };
}) {
  await ensureBuiltInTemplates();
  const templates = await prisma.template.findMany({
    include: { _count: { select: { screens: true } } },
    orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
  });

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader
        title="Create event"
        subtitle="You can fill in the rest — schedule, budget, people — once it exists."
      />

      <form action={createEvent} className="space-y-5">
        <div>
          <label className={label} htmlFor="name">
            Event name
          </label>
          <input id="name" name="name" required placeholder="Harvest Gala" className={field} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="eventDate">
              Event date
            </label>
            <input id="eventDate" name="eventDate" type="date" required className={field} />
          </div>
          <div>
            <label className={label} htmlFor="startTime">
              Start time <span className="text-ink-muted">(optional)</span>
            </label>
            <input id="startTime" name="startTime" type="time" className={field} />
          </div>
          <div>
            <label className={label} htmlFor="venue">
              Venue <span className="text-ink-muted">(optional)</span>
            </label>
            <input id="venue" name="venue" placeholder="Riverside Hall" className={field} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="capacity">
              Seats <span className="text-ink-muted">(optional)</span>
            </label>
            <input
              id="capacity"
              name="capacity"
              type="number"
              min="0"
              step="1"
              placeholder="300"
              className={`${field} font-mono tabular-nums`}
            />
            <p className="mt-1 text-meta text-ink-muted">
              Drives the registration count and its fill bar.
            </p>
          </div>
          <div>
            <label className={label} htmlFor="fundraisingGoal">
              Fundraising goal <span className="text-ink-muted">(optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[14px] text-ink-muted">$</span>
              <input
                id="fundraisingGoal"
                name="fundraisingGoal"
                type="number"
                min="0"
                step="0.01"
                placeholder="50000"
                className={`${field} font-mono tabular-nums`}
              />
            </div>
            <p className="mt-1 text-meta text-ink-muted">
              Leave empty and the budget simply won&apos;t show a goal.
            </p>
          </div>
        </div>

        <TemplatePicker templates={templates} preselect={searchParams.template} />

        <div className="flex items-center gap-4 border-t border-rule pt-5">
          <button
            type="submit"
            className="h-11 bg-accent px-4 text-ui text-panel transition-opacity hover:opacity-90"
          >
            Create event
          </button>
          <Link href="/dashboard" className="text-ui text-ink-muted transition-colors hover:text-ink">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
