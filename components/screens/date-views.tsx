import Link from "next/link";
import type { FieldDefinition, ScreenRecord } from "@prisma/client";

import { formatLongDate, formatMoney, formatTime } from "@/lib/format";
import { readDate, readText, titleKeyOf, valuesOf } from "@/lib/records";
import { monthGrid, monthKey, sameDay } from "@/lib/screen-views";
import { TimeGutter } from "./time-gutter";

type Shared = {
  records: ScreenRecord[];
  fields: FieldDefinition[];
  dateField: FieldDefinition;
};

function label(record: ScreenRecord, fields: FieldDefinition[]): string {
  const titleKey = titleKeyOf(fields);
  return titleKey ? readText(valuesOf(record), titleKey) || "Untitled" : "Untitled";
}

function secondary(record: ScreenRecord, fields: FieldDefinition[], skip: string[]): string {
  const values = valuesOf(record);
  const extra = fields.find((f) => !skip.includes(f.key) && readText(values, f.key) !== "");
  return extra ? readText(values, extra.key) : "";
}

/**
 * TIMELINE: the same left gutter the run of show uses, so a user-built timeline reads as
 * part of the app rather than a separate widget. Records with no date go to a rail
 * instead of being dropped — mirroring "Not yet placed" on the run of show.
 */
export function TimelineView({ records, fields, dateField }: Shared) {
  const dated = records
    .map((record) => ({ record, when: readDate(valuesOf(record), dateField.key) }))
    .filter((r): r is { record: ScreenRecord; when: Date } => r.when !== null)
    .sort((a, b) => a.when.getTime() - b.when.getTime());

  const undated = records.filter((record) => !readDate(valuesOf(record), dateField.key));

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="min-w-0 flex-1 border border-rule bg-panel">
        {dated.length === 0 ? (
          <p className="px-4 py-10 text-[13px] text-ink-muted">
            Nothing has a {dateField.label.toLowerCase()} yet.
          </p>
        ) : (
          dated.map(({ record, when }) => (
            <div key={record.id} className="flex border-b border-rule-soft last:border-b-0">
              <TimeGutter
                time={formatTime(when)}
                caption={when.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              />
              <div className="min-w-0 flex-1 px-4 py-4">
                <p className="text-[15px] text-ink">{label(record, fields)}</p>
                {secondary(record, fields, [dateField.key, titleKeyOf(fields) ?? ""]) && (
                  <p className="text-caption text-ink-muted">
                    {secondary(record, fields, [dateField.key, titleKeyOf(fields) ?? ""])}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <aside className="w-full shrink-0 lg:w-[260px]">
        <h3 className="mb-2 text-micro uppercase text-ink-muted">Not yet placed</h3>
        {undated.length === 0 ? (
          <p className="border border-rule bg-panel px-3 py-4 text-[13px] text-ink-muted">
            Everything has a date.
          </p>
        ) : (
          <ul className="divide-y divide-rule-soft border border-rule bg-panel">
            {undated.map((record) => (
              <li key={record.id} className="px-3 py-2 text-[13px] text-ink">
                {label(record, fields)}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

/** CALENDAR: a month grid. The month is a URL param so it survives a reload. */
export function CalendarView({
  records,
  fields,
  dateField,
  month,
  basePath,
}: Shared & { month: Date; basePath: string }) {
  const cells = monthGrid(month);
  const today = new Date();

  const byDay = new Map<string, ScreenRecord[]>();
  for (const record of records) {
    const when = readDate(valuesOf(record), dateField.key);
    if (!when) continue;
    const key = `${when.getFullYear()}-${when.getMonth()}-${when.getDate()}`;
    byDay.set(key, [...(byDay.get(key) ?? []), record]);
  }

  const prev = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const undatedCount = records.filter((r) => !readDate(valuesOf(r), dateField.key)).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[19px] font-normal text-ink">
          {month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </h3>
        <div className="flex items-center gap-4">
          {undatedCount > 0 && (
            <span className="text-meta text-ink-muted">
              {undatedCount} without a date
            </span>
          )}
          <Link
            href={`${basePath}?month=${monthKey(prev)}`}
            className="text-ui text-ink-muted hover:text-ink"
          >
            ← Prev
          </Link>
          <Link
            href={`${basePath}?month=${monthKey(next)}`}
            className="text-ui text-ink-muted hover:text-ink"
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 border-l border-t border-rule bg-panel">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div
            key={day}
            className="border-b border-r border-rule bg-panel-alt px-2 py-1.5 text-micro uppercase text-ink-muted"
          >
            {day}
          </div>
        ))}
        {cells.map(({ date, inMonth }) => {
          const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          const dayRecords = byDay.get(key) ?? [];
          return (
            <div
              key={date.toISOString()}
              className={`min-h-[92px] border-b border-r border-rule p-1.5 ${
                inMonth ? "" : "bg-panel-alt/50"
              }`}
            >
              <p
                className={`font-mono text-meta tabular-nums ${
                  sameDay(date, today)
                    ? "text-danger"
                    : inMonth
                      ? "text-ink"
                      : "text-ink-muted"
                }`}
              >
                {date.getDate()}
              </p>
              <ul className="mt-1 space-y-1">
                {dayRecords.slice(0, 3).map((record) => (
                  <li
                    key={record.id}
                    className="truncate border-l-2 border-accent pl-1 text-meta text-ink"
                    title={label(record, fields)}
                  >
                    {label(record, fields)}
                  </li>
                ))}
                {dayRecords.length > 3 && (
                  <li className="text-meta text-ink-muted">+{dayRecords.length - 3} more</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="text-meta text-ink-muted">
        Showing {records.length - undatedCount} dated record
        {records.length - undatedCount === 1 ? "" : "s"} · {formatLongDate(month)} onwards
      </p>
    </div>
  );
}

/** LEDGER: money columns, right-aligned tabular, totalled in a footer row. */
export function LedgerView({
  records,
  fields,
  currencyKeys,
}: {
  records: ScreenRecord[];
  fields: FieldDefinition[];
  currencyKeys: string[];
}) {
  const totals = new Map<string, number>();
  for (const key of currencyKeys) {
    totals.set(
      key,
      records.reduce((sum, record) => sum + Number(valuesOf(record)[key] ?? 0), 0),
    );
  }

  return (
    <div className="overflow-x-auto border border-rule bg-panel">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="h-head border-b border-rule bg-panel-alt">
            {fields.map((f) => (
              <th
                key={f.id}
                scope="col"
                className={`px-3 text-micro font-medium uppercase text-ink-muted ${
                  f.type === "CURRENCY" ? "text-right" : "text-left"
                }`}
              >
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-rule-soft">
          {records.length === 0 ? (
            <tr>
              <td colSpan={fields.length} className="px-3 py-10 text-[13px] text-ink-muted">
                No entries yet.
              </td>
            </tr>
          ) : (
            records.map((record) => {
              const values = valuesOf(record);
              return (
                <tr key={record.id}>
                  {fields.map((f) => (
                    <td
                      key={f.id}
                      className={`px-3 py-3 text-[13px] ${
                        f.type === "CURRENCY"
                          ? "text-right font-mono tabular-nums text-ink"
                          : "text-ink-muted"
                      }`}
                    >
                      {f.type === "CURRENCY"
                        ? formatMoney(Number(values[f.key] ?? 0))
                        : f.type === "CHECKBOX"
                          ? values[f.key] === true
                            ? "✓"
                            : "—"
                          : readText(values, f.key) || "—"}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
        {records.length > 0 && (
          <tfoot>
            <tr className="border-t border-rule bg-panel-alt">
              {fields.map((f, i) => (
                <td
                  key={f.id}
                  className={`px-3 py-3 text-[13px] ${
                    f.type === "CURRENCY"
                      ? "text-right font-mono tabular-nums text-ink"
                      : "text-ink-muted"
                  }`}
                >
                  {f.type === "CURRENCY"
                    ? formatMoney(totals.get(f.key) ?? 0)
                    : i === 0
                      ? `${records.length} entries`
                      : ""}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
