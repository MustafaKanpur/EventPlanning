import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { linkTargetOf } from "@/lib/records";
import type { SelectOption } from "@/lib/screen-templates";
import { ScreenBuilder } from "../../screen-builder";
import { DeleteScreenButton } from "../../delete-screen-button";

export default async function EditScreenPage({
  params,
}: {
  params: { definitionId: string };
}) {
  const screen = await prisma.screenDefinition.findUnique({
    where: { id: params.definitionId },
    include: { fields: { orderBy: { position: "asc" } } },
  });
  if (!screen?.eventId) notFound();

  const budgetLines = await prisma.budgetLine.findMany({
    where: { eventId: screen.eventId },
    select: { id: true, category: true },
    orderBy: { category: "asc" },
  });

  const fields = screen.fields.map((field) => ({
    key: field.key,
    id: field.id,
    label: field.label,
    type: field.type,
    options: (field.options as { choices?: SelectOption[] } | null)?.choices ?? undefined,
    required: field.required,
    targetType: linkTargetOf(field) ?? undefined,
    rollupTarget: field.rollupTarget,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[28px] font-normal leading-tight text-ink">
            {screen.icon ? `${screen.icon} ` : ""}
            {screen.name}
          </h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            {screen.isDraft
              ? "Draft — not shown as a tab until you save it properly."
              : "Renaming a field keeps its stored values — they're keyed by a slug, not the label."}
          </p>
        </div>
        <Link
          href={`/events/${screen.eventId}/screens/${screen.id}`}
          className="text-ui text-ink-muted transition-colors hover:text-ink"
        >
          ← Back to screen
        </Link>
      </div>

      <ScreenBuilder
        eventId={screen.eventId}
        definitionId={screen.id}
        initialName={screen.name}
        initialIcon={screen.icon ?? ""}
        initialViewType={screen.viewType}
        initialGroupByFieldKey={screen.groupByFieldKey}
        budgetLines={budgetLines}
        initialFields={fields}
        discardSlot={<DeleteScreenButton eventId={screen.eventId} screenId={screen.id} />}
      />
    </div>
  );
}
