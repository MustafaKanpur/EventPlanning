import { formatMoney } from "@/lib/format";
import { goalMarkerPercent, type BudgetTotals } from "@/lib/budget";
import { spendSegments } from "@/lib/budget";

const SEGMENT_STYLE: Record<string, { bg: string; label: string }> = {
  spent: { bg: "bg-accent", label: "Spent" },
  committed: { bg: "bg-accent/40", label: "Committed, not yet spent" },
  unallocated: { bg: "bg-panel-alt", label: "Unallocated" },
  over: { bg: "bg-danger", label: "Over allocation" },
};

/**
 * One bar instead of four KPI tiles. It answers the only question the tiles were
 * circling: of the money set aside, how much is gone, how much is promised, how much is
 * still free — on a single scale, so the proportions are readable at a glance.
 */
export function SpendBar({ totals, goal }: { totals: BudgetTotals; goal: number | null }) {
  const { segments, scale } = spendSegments(totals);
  const goalPercent = goalMarkerPercent(goal, scale);

  return (
    <section aria-label="Budget usage">
      <div className="relative flex h-10 w-full overflow-hidden border border-rule bg-panel">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={SEGMENT_STYLE[segment.key].bg}
            style={{ width: `${(segment.amount / scale) * 100}%` }}
            title={`${SEGMENT_STYLE[segment.key].label}: ${formatMoney(segment.amount)}`}
          />
        ))}

        {goalPercent !== null && (
          <div
            className="absolute inset-y-0 w-px bg-ink"
            style={{ left: `${goalPercent}%` }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* The bar is decorative on its own; the legend carries the same figures as text. */}
      <ul className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-ink-muted">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 border border-rule ${SEGMENT_STYLE[segment.key].bg}`}
              aria-hidden="true"
            />
            {SEGMENT_STYLE[segment.key].label}
            <span className="font-mono tabular-nums text-ink">{formatMoney(segment.amount)}</span>
          </li>
        ))}
        {goalPercent !== null && (
          <li className="flex items-center gap-2">
            <span className="h-3 w-px shrink-0 bg-ink" aria-hidden="true" />
            Fundraising goal
            <span className="font-mono tabular-nums text-ink">{formatMoney(goal)}</span>
          </li>
        )}
      </ul>
    </section>
  );
}
