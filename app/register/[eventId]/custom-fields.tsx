import type { FieldDefinition } from "@prisma/client";

import { choicesOf } from "@/lib/registration-form";

const input =
  "w-full rounded-[3px] border border-rule px-3 py-2 text-sm focus:border-accent focus:outline-none";

/**
 * The organiser's own questions, rendered from their field definitions. Everything here
 * is a plain form control with a real <label> — the public form has to work for anyone,
 * on any device, with no JavaScript required to submit it.
 */
export function CustomFields({ fields }: { fields: FieldDefinition[] }) {
  if (fields.length === 0) return null;

  return (
    <>
      {fields.map((f) => {
        const id = `q-${f.key}`;
        const label = (
          <label htmlFor={id} className="text-sm font-medium text-ink">
            {f.label}
            {!f.required && <span className="font-normal text-ink-muted"> (optional)</span>}
          </label>
        );

        if (f.type === "CHECKBOX") {
          return (
            <div key={f.id} className="flex items-center gap-2">
              <input id={id} name={f.key} type="checkbox" className="h-4 w-4" />
              <label htmlFor={id} className="text-sm text-ink">
                {f.label}
              </label>
            </div>
          );
        }

        if (f.type === "SELECT" || f.type === "MULTI_SELECT") {
          const choices = choicesOf(f);
          return (
            <div key={f.id} className="space-y-1">
              {label}
              <select
                id={id}
                name={f.key}
                required={f.required}
                multiple={f.type === "MULTI_SELECT"}
                defaultValue={f.type === "MULTI_SELECT" ? [] : ""}
                className={input}
              >
                {f.type === "SELECT" && <option value="">Choose…</option>}
                {choices.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (f.type === "LONG_TEXT") {
          return (
            <div key={f.id} className="space-y-1">
              {label}
              <textarea id={id} name={f.key} required={f.required} rows={3} className={input} />
            </div>
          );
        }

        return (
          <div key={f.id} className="space-y-1">
            {label}
            <input
              id={id}
              name={f.key}
              required={f.required}
              type={
                f.type === "NUMBER"
                  ? "number"
                  : f.type === "DATE"
                    ? "date"
                    : f.type === "EMAIL"
                      ? "email"
                      : f.type === "URL"
                        ? "url"
                        : "text"
              }
              className={input}
            />
          </div>
        );
      })}
    </>
  );
}
