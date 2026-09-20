"use client";

import { useEffect, useRef, useState } from "react";

import { IconSettings } from "@/components/ui/icon";
import { DeleteEvent } from "@/components/delete-event";

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
