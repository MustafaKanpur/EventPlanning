import Link from "next/link";
import type { LinkTarget } from "@prisma/client";

import { formatMoney } from "@/lib/format";
import { getRecordsLinkedTo, readText, titleKeyOf, valuesOf } from "@/lib/records";

/**
 * The other half of a LINK field: what points *at* this thing.
 *
 * A budget line shows the Vendor Stalls rows that draw on it, a schedule block shows
 * what's attached to it, a vendor shows where it's been booked — none of which knows
 * that "Vendor Stalls" exists. Backed by the same `getRecordsLinkedTo` the run of show
 * uses, so a new user-built screen appears here the moment it links to something.
 *
 * `exclude` lets a caller drop records it already renders itself — the run of show
 * nests checklist items as tasks, so it doesn't want them listed twice.
 */
export async function ReferencedBy({
  eventId,
  targetType,
  targetId,
  exclude = () => false,
  heading = "Referenced by",
  className = "",
}: {
  eventId: string;
  targetType: LinkTarget;
  targetId: string;
  exclude?: (viewType: string, screenName: string) => boolean;
  heading?: string;
  className?: string;
}) {
  const records = (await getRecordsLinkedTo(targetType, targetId)).filter(
    (record) => !exclude(record.screen.viewType, record.screen.name),
  );
  if (records.length === 0) return null;

  // Grouped by screen, because "3 rows from Vendor Stalls" is the useful unit.
  const byScreen = new Map<string, typeof records>();
  for (const record of records) {
    const list = byScreen.get(record.screen.id) ?? [];
    list.push(record);
    byScreen.set(record.screen.id, list);
  }

  return (
    <div className={className}>
      <p className="text-micro uppercase text-ink-muted">{heading}</p>
      <ul className="mt-1 space-y-1">
        {Array.from(byScreen.values()).map((group) => {
          const screen = group[0].screen;
          const titleKey = titleKeyOf(screen.fields);
          const currencyField = screen.fields.find((f) => f.type === "CURRENCY");
          const total = currencyField
            ? group.reduce((sum, r) => sum + Number(valuesOf(r)[currencyField.key] ?? 0), 0)
            : null;

          return (
            <li key={screen.id} className="text-[13px]">
              <Link
                href={`/events/${eventId}/screens/${screen.id}`}
                className="text-accent hover:underline"
              >
                {screen.name}
              </Link>
              <span className="text-ink-muted">
                {" "}
                — {group.length} record{group.length === 1 ? "" : "s"}
                {total !== null && total > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    <span className="font-mono tabular-nums">{formatMoney(total)}</span>
                  </>
                )}
              </span>
              <p className="text-meta text-ink-muted">
                {group
                  .slice(0, 3)
                  .map((r) => (titleKey ? readText(valuesOf(r), titleKey) || "Untitled" : "Untitled"))
                  .join(", ")}
                {group.length > 3 && ` +${group.length - 3} more`}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
