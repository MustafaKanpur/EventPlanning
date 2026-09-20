"use client";

import { useRef } from "react";
import type { FieldDefinition } from "@prisma/client";

import { formatMoney } from "@/lib/format";
import type { LinkOption } from "@/lib/link-targets";
import { updateCell } from "@/app/(app)/events/[eventId]/screens/actions";
import { LinkPicker } from "./link-picker";

const base =
  "w-full bg-transparent px-2 py-1.5 text-[13px] text-ink focus:bg-panel-alt focus:outline-none";

/**
 * One inline-editable cell. It submits on blur (and on change for the pickers) rather
 * than behind a Save button: a table you have to confirm every cell of is a form, not
 * a table. The write merges a single field, so simultaneous edits to different columns
 * don't overwrite each other.
 */
export function Cell({
  eventId,
  recordId,
  field,
  value,
  linkOptions,
  readOnly = false,
}: {
  eventId: string;
  recordId: string;
  field: FieldDefinition;
  value: unknown;
  /** Options for this field's target type, when it is a LINK or PERSON. */
  linkOptions?: LinkOption[];
  readOnly?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = updateCell.bind(null, eventId, recordId, field.key);
  const submit = () => formRef.current?.requestSubmit();
  const text = value === null || value === undefined ? "" : String(value);

  if (readOnly) {
    return (
      <span className="block px-2 py-1.5 text-[13px] text-ink-muted">
        {text ? <span title={text}>{text.slice(0, 24)}</span> : "—"}
      </span>
    );
  }

  // A link cell is a picker plus a way through to the thing it points at: the value is
  // an id, but nobody should ever see an id.
  if (field.type === "LINK" || field.type === "PERSON") {
    const options = linkOptions ?? [];
    const chosen = options.find((o) => o.id === text);
    return (
      <div className="flex items-center gap-1">
        <form ref={formRef} action={action} className="min-w-0 flex-1">
          <LinkPicker
            options={options}
            value={text}
            label={field.label}
            onCommit={submit}
          />
        </form>
        {chosen && (
          <a
            href={chosen.href}
            aria-label={`Open ${chosen.label}`}
            className="shrink-0 px-1 text-meta text-accent hover:underline"
          >
            ↗
          </a>
        )}
      </div>
    );
  }

  if (field.type === "CHECKBOX") {
    const checked = value === true || value === "true";
    return (
      <form ref={formRef} action={action} className="flex items-center px-2">
        <input type="hidden" name="value" value={checked ? "false" : "true"} />
        <button
          type="submit"
          aria-label={checked ? `Untick ${field.label}` : `Tick ${field.label}`}
          className="flex h-11 w-11 items-center justify-center"
        >
          <span
            className={`flex h-[13px] w-[13px] items-center justify-center border ${
              checked ? "border-accent bg-accent" : "border-rule bg-panel"
            }`}
          >
            {checked && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#FFFDF8" strokeWidth={3} aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
          </span>
        </button>
      </form>
    );
  }

  if (field.type === "SELECT") {
    const choices = (field.options as { choices?: { value: string; label: string }[] } | null)?.choices ?? [];
    return (
      <form ref={formRef} action={action}>
        <select
          name="value"
          defaultValue={text}
          onChange={submit}
          aria-label={field.label}
          className={base}
        >
          <option value="">—</option>
          {choices.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </form>
    );
  }

  if (field.type === "LONG_TEXT") {
    return (
      <form ref={formRef} action={action}>
        <textarea
          name="value"
          defaultValue={text}
          onBlur={submit}
          rows={2}
          aria-label={field.label}
          className={base}
        />
      </form>
    );
  }

  const inputType =
    field.type === "NUMBER" || field.type === "CURRENCY" || field.type === "DURATION"
      ? "number"
      : field.type === "DATE"
        ? "date"
        : field.type === "DATETIME"
          ? "datetime-local"
          : field.type === "EMAIL"
            ? "email"
            : field.type === "URL"
              ? "url"
              : "text";

  const money = field.type === "CURRENCY";

  return (
    <form ref={formRef} action={action}>
      <input
        type={inputType}
        name="value"
        defaultValue={text}
        onBlur={submit}
        step={money ? "0.01" : field.type === "NUMBER" ? "any" : undefined}
        aria-label={field.label}
        title={money && text ? formatMoney(Number(text)) : undefined}
        className={`${base} ${
          money || field.type === "NUMBER" || field.type === "DURATION"
            ? "text-right font-mono tabular-nums"
            : ""
        }`}
      />
    </form>
  );
}
