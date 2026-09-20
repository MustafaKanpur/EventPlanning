"use client";

import { useEffect, useRef, useState } from "react";

import { IconSettings } from "@/components/ui/icon";
import { DeleteEvent } from "@/components/delete-event";
import { createTemplateFromEvent } from "@/app/(app)/templates/actions";

/**
 * Where destructive and rarely-used event actions live now. The header used to carry a
 * red "Delete event" button at full strength, which put the most dangerous action in the
 * most prominent spot on every tab.
 */
export function EventSettingsMenu({
  eventId,
  eventName,
  summary,
}: {
  eventId: string;
  eventName: string;
  summary?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Event settings"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center border border-rule text-ink-muted transition-colors hover:bg-panel-alt hover:text-ink"
      >
        <IconSettings size={16} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Event settings"
          className="absolute right-0 z-40 mt-1 w-52 border border-rule bg-panel py-1"
        >
          {/* Teams running the same event annually are the reuse case this exists for. */}
          <details className="border-b border-rule-soft">
            <summary className="flex h-11 cursor-pointer list-none items-center px-3 text-ui text-ink transition-colors hover:bg-panel-alt">
              Save as template
            </summary>
            <form
              action={createTemplateFromEvent.bind(null, eventId)}
              className="space-y-2 bg-panel-alt p-3"
            >
              <input
                name="name"
                defaultValue={`${eventName} template`}
                aria-label="Template name"
                className="w-full border border-rule bg-panel px-2 py-1.5 text-[13px] text-ink focus:border-accent focus:outline-none"
              />
              <textarea
                name="description"
                rows={2}
                placeholder="What it is for (optional)"
                className="w-full border border-rule bg-panel px-2 py-1.5 text-[13px] text-ink focus:border-accent focus:outline-none"
              />
              <p className="text-meta text-ink-muted">
                Copies this event&apos;s screens and fields. No records are included.
              </p>
              <button
                type="submit"
                className="h-11 w-full bg-accent text-ui text-panel transition-opacity hover:opacity-90"
              >
                Save template
              </button>
            </form>
          </details>

          <DeleteEvent
            eventId={eventId}
            eventName={eventName}
            summary={summary}
            variant="menu"
            onRequestClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
