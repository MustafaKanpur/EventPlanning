import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

import { SCREEN_TEMPLATES } from "@/lib/screen-templates";
import { ScreenBuilder } from "../screen-builder";
import type { BuilderField } from "../types";

export default async function NewScreenPage({
  searchParams,
}: {
  searchParams: { eventId?: string; template?: string };
}) {
  // A screen belongs to an event now, so the builder can't be opened without one.
  if (!searchParams.eventId) notFound();

  const budgetLines = await prisma.budgetLine.findMany({
    where: { eventId: searchParams.eventId },
    select: { id: true, category: true },
    orderBy: { category: "asc" },
  });

  const template = searchParams.template
    ? SCREEN_TEMPLATES.find((t) => t.id === searchParams.template)
    : undefined;

  const initialFields: BuilderField[] | undefined = template?.fields.map((field, i) => ({
    key: `tpl-${i}`,
    label: field.label,
    type: field.type,
    options: field.options,
    required: false,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[28px] font-normal leading-tight text-ink">
            {template ? `Build from “${template.name}”` : "Build a screen"}
          </h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            It becomes a tab on this event, and its records live with the event.
          </p>
        </div>
        <Link
          href={`/events/${searchParams.eventId}/schedule`}
          className="text-ui text-ink-muted transition-colors hover:text-ink"
        >
          ← Back to event
        </Link>
      </div>

      <ScreenBuilder
        eventId={searchParams.eventId}
        initialFields={initialFields}
        budgetLines={budgetLines}
      />
    </div>
  );
}
