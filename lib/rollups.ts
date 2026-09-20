import { prisma } from "./prisma";
import { readDate, readText, titleKeyOf, valuesOf } from "./records";

/**
 * Rollups are what stop a user-built screen sitting beside the system instead of
 * participating in it. Two paths, both opt-in per field via `FieldDefinition.rollupTarget`:
 *
 *   CURRENCY  → a budget line id: the column's sum posts as committed spend
 *   DATE/TIME → the literal "RUN_OF_SHOW": records project onto the event-day timeline
 *
 * Both are computed on read rather than materialised on write. The brief says
 * "recompute on record write", and that would work, but it creates a second copy of a
 * number that already exists — exactly the drift the registration-revenue rewrite got
 * rid of earlier. One extra query per page keeps a single source of truth.
 */
export const RUN_OF_SHOW_TARGET = "RUN_OF_SHOW";

export type CurrencyRollup = {
  screenId: string;
  screenName: string;
  fieldLabel: string;
  recordCount: number;
  total: number;
};

/** Currency rollups for one event, grouped by the budget line they post to. */
export async function getCurrencyRollups(
  eventId: string,
): Promise<Map<string, CurrencyRollup[]>> {
  const fields = await prisma.fieldDefinition.findMany({
    where: {
      type: "CURRENCY",
      rollupTarget: { not: null },
      screen: { eventId },
    },
    include: {
      screen: {
        select: {
          id: true,
          name: true,
          records: { select: { values: true } },
        },
      },
    },
  });

  const byLine = new Map<string, CurrencyRollup[]>();
  for (const field of fields) {
    const lineId = field.rollupTarget;
    if (!lineId || lineId === RUN_OF_SHOW_TARGET) continue;

    const contributing = field.screen.records.filter((record) => {
      const raw = valuesOf(record)[field.key];
      return raw !== null && raw !== undefined && raw !== "" && Number(raw) !== 0;
    });
    if (contributing.length === 0) continue;

    const total = contributing.reduce(
      (sum, record) => sum + Number(valuesOf(record)[field.key] ?? 0),
      0,
    );

    const list = byLine.get(lineId) ?? [];
    list.push({
      screenId: field.screen.id,
      screenName: field.screen.name,
      fieldLabel: field.label,
      recordCount: contributing.length,
      total,
    });
    byLine.set(lineId, list);
  }
  return byLine;
}

export type TimelineProjection = {
  recordId: string;
  screenId: string;
  screenName: string;
  title: string;
  when: Date;
};

/**
 * Records projecting onto the run of show. They are not ScheduleItems and never become
 * them: the timeline draws them as light-weight entries so the day reads completely,
 * while the schedule itself stays the only thing anyone edits.
 */
export async function getTimelineProjections(eventId: string): Promise<TimelineProjection[]> {
  const fields = await prisma.fieldDefinition.findMany({
    where: {
      type: { in: ["DATE", "DATETIME"] },
      rollupTarget: RUN_OF_SHOW_TARGET,
      screen: { eventId },
    },
    include: {
      screen: {
        select: {
          id: true,
          name: true,
          fields: { orderBy: { position: "asc" } },
          records: { orderBy: { position: "asc" } },
        },
      },
    },
  });

  const projections: TimelineProjection[] = [];
  for (const field of fields) {
    const titleKey = titleKeyOf(field.screen.fields);
    for (const record of field.screen.records) {
      const values = valuesOf(record);
      const when = readDate(values, field.key);
      if (!when) continue;
      projections.push({
        recordId: record.id,
        screenId: field.screen.id,
        screenName: field.screen.name,
        title: titleKey ? readText(values, titleKey) || "Untitled" : "Untitled",
        when,
      });
    }
  }
  return projections.sort((a, b) => a.when.getTime() - b.when.getTime());
}
