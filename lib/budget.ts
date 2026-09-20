import type { Tone } from "@/components/ui/status-dot";
import type { CurrencyRollup } from "./rollups";

/**
 * The three money columns map onto the two-level budget the app already stores:
 *   Planned   = BudgetLine.allocatedAmount      — what this category was given
 *   Committed = Σ lineItems.plannedAmount       — what has been promised out of it
 *   Actual    = Σ lineItems.actualAmount        — what has actually left the account
 * Variance is Planned − Actual, so negative means over budget.
 */
export type LedgerLine = {
  id: string;
  category: string;
  vendors: string[];
  planned: number;
  committed: number;
  actual: number;
  variance: number;
  status: { label: string; tone: Tone };
  notes: string | null;
  /** Committed amounts rolled up from user-built screens, with their source. */
  rollups: CurrencyRollup[];
};

export type LineInput = {
  id: string;
  category: string;
  notes: string | null;
  allocatedAmount: unknown;
  lineItems: { plannedAmount: unknown; actualAmount: unknown }[];
  vendors: { name: string }[];
};

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v?.toString?.() ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function lineStatus(
  planned: number,
  committed: number,
  actual: number,
): { label: string; tone: Tone } {
  if (planned > 0 && actual > planned) return { label: "Over", tone: "danger" };
  if (planned === 0 && committed === 0 && actual === 0) {
    return { label: "No budget", tone: "neutral" };
  }
  if (actual > 0 && actual >= committed) return { label: "Settled", tone: "success" };
  if (committed > 0) return { label: "Committed", tone: "accent" };
  return { label: "Open", tone: "neutral" };
}

export function toLedger(
  lines: LineInput[],
  rollupsByLine: Map<string, CurrencyRollup[]> = new Map(),
): LedgerLine[] {
  return lines.map((line) => {
    const planned = num(line.allocatedAmount);
    const rollups = rollupsByLine.get(line.id) ?? [];
    // A rolled-up column is money promised on a screen the budget knows nothing about,
    // so it counts as committed alongside the line's own items.
    const rolledUp = rollups.reduce((s, r) => s + r.total, 0);
    const committed = line.lineItems.reduce((s, i) => s + num(i.plannedAmount), 0) + rolledUp;
    const actual = line.lineItems.reduce((s, i) => s + num(i.actualAmount), 0);
    return {
      id: line.id,
      category: line.category,
      vendors: line.vendors.map((v) => v.name),
      planned,
      committed,
      actual,
      variance: planned - actual,
      status: lineStatus(planned, committed, actual),
      notes: line.notes,
      rollups,
    };
  });
}

export type BudgetTotals = {
  allocated: number;
  committed: number;
  actual: number;
  revenue: number;
  /** Revenue actually taken minus money actually spent. */
  net: number;
};

export function budgetTotals(ledger: LedgerLine[], revenue: number): BudgetTotals {
  const allocated = ledger.reduce((s, l) => s + l.planned, 0);
  const committed = ledger.reduce((s, l) => s + l.committed, 0);
  const actual = ledger.reduce((s, l) => s + l.actual, 0);
  return { allocated, committed, actual, revenue, net: revenue - actual };
}

export type Segment = { key: "spent" | "committed" | "unallocated" | "over"; amount: number };

/**
 * Segments for the single spend bar, plus the scale they're drawn against.
 *
 * The scale is the larger of the allocation and what's actually been spent or promised,
 * so an overspend can't silently run off the end of the bar — it gets its own `over`
 * segment and the whole bar rescales.
 */
export function spendSegments(totals: BudgetTotals): {
  segments: Segment[];
  scale: number;
} {
  const { allocated, committed, actual } = totals;
  const committedNotSpent = Math.max(0, committed - actual);
  const used = actual + committedNotSpent;
  const scale = Math.max(allocated, used, 1);

  const segments: Segment[] = [
    { key: "spent", amount: actual },
    { key: "committed", amount: committedNotSpent },
  ];

  if (used > allocated) {
    segments.push({ key: "over", amount: used - allocated });
  } else {
    segments.push({ key: "unallocated", amount: allocated - used });
  }

  return { segments: segments.filter((s) => s.amount > 0), scale };
}

/**
 * Where the fundraising goal tick sits on the bar, as a percentage. Returns null when no
 * goal is set — that's the fix for the old "-$1.00" readout, which rendered a goal
 * comparison against a goal that didn't exist.
 */
export function goalMarkerPercent(goal: number | null, scale: number): number | null {
  if (goal === null || !Number.isFinite(goal) || goal <= 0) return null;
  if (goal > scale) return null; // off the end of the bar; the summary line states it instead
  return (goal / scale) * 100;
}
