import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { ScreenView } from "@/components/screens/screen-view";
import { listOptionsForTargets } from "@/lib/link-targets";
import { linkTargetOf } from "@/lib/records";

export default async function ScreenPage({
  params,
  searchParams,
}: {
  params: { eventId: string; screenId: string };
  searchParams: { month?: string };
}) {
  const screen = await prisma.screenDefinition.findUnique({
    where: { id: params.screenId },
    include: {
      fields: { orderBy: { position: "asc" } },
      records: { orderBy: { position: "asc" } },
    },
  });
  if (!screen || screen.eventId !== params.eventId) notFound();

  // Only the targets this screen actually links to get loaded.
  const targets = screen.fields
    .map((f) => linkTargetOf(f))
    .filter((t): t is NonNullable<typeof t> => t !== null);
  const linkOptions = await listOptionsForTargets(params.eventId, targets);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-[22px] font-normal leading-none text-ink">
            {screen.icon ? `${screen.icon} ` : ""}
            {screen.name}
          </h2>
          <p className="mt-1.5 text-meta uppercase tracking-[0.09em] text-ink-muted">
            {screen.viewType.toLowerCase()} · {screen.fields.length} field
            {screen.fields.length === 1 ? "" : "s"}
            {screen.isSystem && " · default screen"}
          </p>
        </div>
        <Link
          href={`/builder/${screen.id}/edit?eventId=${params.eventId}`}
          className="text-ui text-ink-muted transition-colors hover:text-ink"
        >
          Edit fields
        </Link>
      </div>

      <ScreenView
        eventId={params.eventId}
        screen={screen}
        linkOptions={linkOptions}
        month={searchParams.month}
        basePath={`/events/${params.eventId}/screens/${screen.id}`}
      />
    </div>
  );
}
