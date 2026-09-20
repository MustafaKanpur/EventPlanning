"use client";

import { useState } from "react";

type TemplateOption = {
  id: string;
  name: string;
  description: string | null;
  isBuiltIn: boolean;
  _count: { screens: number };
};

/**
 * Templates are the onboarding path, so "Start blank" is an option rather than the
 * default — a new event arriving as a populated workspace is the whole point.
 */
export function TemplatePicker({
  templates,
  preselect,
}: {
  templates: TemplateOption[];
  /** Set when arriving from "Use this →" on the templates page. */
  preselect?: string;
}) {
  const initial = preselect && templates.some((t) => t.id === preselect)
    ? preselect
    : (templates[0]?.id ?? "");
  const [selected, setSelected] = useState<string>(initial);

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-[12.5px] text-ink-muted">Start from a template</legend>
      <input type="hidden" name="templateId" value={selected} />

      <div className="grid gap-2 sm:grid-cols-2">
        {templates.map((template) => {
          const active = selected === template.id;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => setSelected(template.id)}
              aria-pressed={active}
              className={`border p-3 text-left transition-colors ${
                active ? "border-ink bg-panel-alt" : "border-rule bg-panel hover:bg-panel-alt"
              }`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-ink">{template.name}</span>
                <span className="font-mono text-meta tabular-nums text-ink-muted">
                  {template._count.screens} screens
                </span>
              </span>
              {template.description && (
                <span className="mt-0.5 block text-meta text-ink-muted">
                  {template.description}
                </span>
              )}
              {!template.isBuiltIn && (
                <span className="mt-1 block text-micro uppercase text-accent">Your template</span>
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setSelected("")}
          aria-pressed={selected === ""}
          className={`border p-3 text-left transition-colors ${
            selected === "" ? "border-ink bg-panel-alt" : "border-rule bg-panel hover:bg-panel-alt"
          }`}
        >
          <span className="text-[13px] text-ink">Start blank</span>
          <span className="mt-0.5 block text-meta text-ink-muted">
            Just Tasks and Files. Add your own screens later.
          </span>
        </button>
      </div>
    </fieldset>
  );
}
