"use client";

import type { FieldType, ViewType } from "@prisma/client";

import { OPTION_COLOR_CLASSES, type SelectOption } from "@/lib/screen-templates";
import { formatMoney } from "@/lib/format";

export type PreviewField = {
  key: string;
  label: string;
  type: FieldType;
  options?: SelectOption[];
};

/**
 * A small stand-in for the real view, drawn from the fields as they are being edited.
 *
 * It is deliberately NOT the production component: those are server components reading
 * real records, and the builder is a client form with nothing saved yet. So this draws
 * the same shapes with placeholder rows — enough to answer "what will this look like",
 * which a generic form preview never could.
 */
export function ViewPreview({
  viewType,
  fields,
}: {
  viewType: ViewType;
  fields: PreviewField[];
}) {
  const shown = fields.filter((f) => f.label.trim() !== "");

  if (shown.length === 0) {
    return (
      <div className="border border-rule bg-panel px-4 py-10 text-center text-[13px] text-ink-muted">
        Add a field to see the {viewType.toLowerCase()} take shape.
      </div>
    );
  }

  const rows = [0, 1, 2];
  const sample = (field: PreviewField, row: number): string => {
    switch (field.type) {
      case "CURRENCY":
        return formatMoney([450, 1200, 90][row]);
      case "NUMBER":
        return String([12, 4, 37][row]);
      case "DURATION":
        return ["45m", "1h 30m", "20m"][row];
      case "DATE":
      case "DATETIME":
        return ["8 Nov", "9 Nov", "12 Nov"][row];
      case "CHECKBOX":
        return row === 0 ? "✓" : "—";
      case "SELECT":
      case "MULTI_SELECT":
        return field.options?.[row % Math.max(1, field.options.length)]?.label ?? "Option";
      case "EMAIL":
        return ["ana@example.org", "sam@example.org", "kit@example.org"][row];
      case "URL":
        return "example.org/doc";
      case "LINK":
      case "PERSON":
        return ["Acme Catering", "Priya Raman", "Doors open"][row];
      case "LONG_TEXT":
        return "Some longer note…";
      default:
        return [`${field.label} one`, `${field.label} two`, `${field.label} three`][row];
    }
  };

  const wrap = "border border-rule bg-panel";

  if (viewType === "BOARD") {
    const group = shown.find((f) => f.type === "SELECT");
    const columns = group?.options?.length
      ? group.options.slice(0, 3)
      : [
          { value: "a", label: "To do", color: "gray" },
          { value: "b", label: "In progress", color: "blue" },
          { value: "c", label: "Done", color: "green" },
        ];
    return (
      <div className="flex gap-2 overflow-hidden">
        {columns.map((column, i) => (
          <div key={column.value} className={`${wrap} w-1/3 p-2`}>
            <span
              className={`inline-block px-1.5 py-0.5 text-micro uppercase ${
                OPTION_COLOR_CLASSES[column.color] ?? "bg-panel-alt text-ink-muted"
              }`}
            >
              {column.label}
            </span>
            {i < 2 && (
              <div className="mt-2 border border-rule bg-panel p-2">
                <p className="truncate text-meta text-ink">{sample(shown[0], i)}</p>
                {shown[1] && (
                  <p className="truncate text-meta text-ink-muted">{sample(shown[1], i)}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (viewType === "CHECKLIST") {
    return (
      <div className={wrap}>
        {rows.map((row) => (
          <div key={row} className="flex items-center gap-2 border-b border-rule-soft px-3 py-2 last:border-b-0">
            <span
              className={`h-[11px] w-[11px] shrink-0 border ${
                row === 0 ? "border-accent bg-accent" : "border-rule"
              }`}
            />
            <span className={`flex-1 text-meta ${row === 0 ? "text-ink-muted line-through" : "text-ink"}`}>
              {sample(shown[0], row)}
            </span>
            {shown[1] && <span className="text-meta text-ink-muted">{sample(shown[1], row)}</span>}
          </div>
        ))}
      </div>
    );
  }

  if (viewType === "TIMELINE") {
    return (
      <div className={wrap}>
        {rows.map((row) => (
          <div key={row} className="flex border-b border-rule-soft last:border-b-0">
            <div className="w-[64px] shrink-0 border-r border-rule-soft px-2 py-2">
              <p className="font-mono text-meta tabular-nums text-ink">
                {["16:00", "17:15", "20:00"][row]}
              </p>
            </div>
            <div className="min-w-0 flex-1 px-3 py-2">
              <p className="truncate text-meta text-ink">{sample(shown[0], row)}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (viewType === "CALENDAR") {
    return (
      <div className="grid grid-cols-7 border-l border-t border-rule bg-panel">
        {Array.from({ length: 21 }, (_, i) => (
          <div key={i} className="min-h-[34px] border-b border-r border-rule p-1">
            <span className="font-mono text-[9px] tabular-nums text-ink-muted">{i + 1}</span>
            {(i === 4 || i === 12) && (
              <span className="mt-0.5 block truncate border-l-2 border-accent pl-1 text-[9px] text-ink">
                {sample(shown[0], i === 4 ? 0 : 1)}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  const money = shown.filter((f) => f.type === "CURRENCY");
  const isLedger = viewType === "LEDGER";

  return (
    <div className={`${wrap} overflow-hidden`}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-rule bg-panel-alt">
            {shown.slice(0, 4).map((f) => (
              <th
                key={f.key}
                className={`px-2 py-1.5 text-micro uppercase text-ink-muted ${
                  f.type === "CURRENCY" ? "text-right" : ""
                }`}
              >
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-rule-soft">
          {rows.map((row) => (
            <tr key={row}>
              {shown.slice(0, 4).map((f) => (
                <td
                  key={f.key}
                  className={`truncate px-2 py-1.5 text-meta ${
                    f.type === "CURRENCY" ? "text-right font-mono tabular-nums text-ink" : "text-ink-muted"
                  }`}
                >
                  {sample(f, row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {isLedger && money.length > 0 && (
          <tfoot>
            <tr className="border-t border-rule bg-panel-alt">
              {shown.slice(0, 4).map((f, i) => (
                <td
                  key={f.key}
                  className={`px-2 py-1.5 text-meta ${
                    f.type === "CURRENCY" ? "text-right font-mono tabular-nums text-ink" : "text-ink-muted"
                  }`}
                >
                  {f.type === "CURRENCY" ? formatMoney(1740) : i === 0 ? "3 entries" : ""}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
