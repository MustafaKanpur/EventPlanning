"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { useReadOnly } from "@/components/read-only";

import { approveDraftBlock, rejectDraftBlock } from "./actions";

/**
 * An AI-proposed block sitting on the timeline, awaiting a decision. Blue until approved;
 * clicking it opens a bubble beside it with Approve / Reject. Times and durations are
 * formatted on the server so they can't differ on hydration.
 */
export function PendingBlock({
  eventId,
  id,
  title,
  start,
  timeLabel,
  location,
  notes,
  overlaps,
}: {
  eventId: string;
  id: string;
  title: string;
  /** "19:00" */
  start: string;
  /** "19:00–19:45 · 45m" */
  timeLabel: string;
  location: string | null;
  notes: string | null;
  /** "Overlaps Dinner", when it clashes with another block. */
  overlaps: string | null;
}) {
  const [open, setOpen] = useState(false);
  // Read-only viewers see the proposal but can't open the Approve / Reject bubble.
  const readOnly = useReadOnly();
  const [isPending, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // Close on a click outside or Escape, returning focus to the block.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const decide = (action: typeof approveDraftBlock) =>
    startTransition(async () => {
      await action(eventId, id);
      setOpen(false);
    });

  const bubbleId = `proposal-${id}`;

  return (
    <div ref={root} className="relative print:hidden">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={readOnly}
        aria-expanded={open}
        aria-controls={bubbleId}
        className={`flex w-full border-b border-l-2 border-b-rule-soft border-l-proposed text-left transition-colors ${
          open ? "bg-proposed/20" : "bg-proposed/10 hover:bg-proposed/15"
        }`}
      >
        <span className="w-[92px] shrink-0 border-r border-rule-soft py-4 pl-6 pr-3">
          <span className="block font-mono text-[14px] leading-none tabular-nums text-proposed">{start}</span>
        </span>
        <span className="min-w-0 flex-1 px-4 py-4">
          <span className="block text-micro uppercase text-proposed">{readOnly ? "AI proposal" : "AI proposal · click to review"}</span>
          <span className="block text-[15px] text-ink">
            {title}
            {location && <span className="text-ink-muted"> · {location}</span>}
          </span>
          {overlaps && <span className="mt-1 block text-meta text-danger">{overlaps}</span>}
        </span>
      </button>

      {open && (
        <div
          id={bubbleId}
          role="dialog"
          aria-label={`Review proposed block: ${title}`}
          className="absolute right-2 top-full z-30 mt-1 w-72 border border-proposed bg-panel p-3 lg:left-full lg:right-auto lg:top-2 lg:ml-3 lg:mt-0"
        >
          <p className="text-micro uppercase text-proposed">Proposed by AI</p>
          <p className="mt-1 text-[14px] text-ink">{title}</p>
          <p className="font-mono text-meta tabular-nums text-ink-muted">{timeLabel}</p>
          {notes && <p className="mt-1 text-caption text-ink-muted">{notes}</p>}
          {overlaps && <p className="mt-1 text-meta text-danger">{overlaps}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => decide(approveDraftBlock)}
              className="h-11 flex-1 bg-proposed text-ui text-panel transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => decide(rejectDraftBlock)}
              className="h-11 flex-1 border border-rule text-ui text-ink transition-colors hover:bg-panel-alt disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
