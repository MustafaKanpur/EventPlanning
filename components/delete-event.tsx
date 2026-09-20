"use client";

import { useEffect, useState, useTransition } from "react";

import { deleteEvent } from "@/app/(app)/events/[eventId]/actions";

/**
 * Destructive enough to warrant a real modal rather than the inline `<details>` confirm
 * used elsewhere: it names the event and spells out what goes with it, and the default
 * focus/dismissal paths (Cancel, Escape, backdrop) all lead away from deleting.
 */
export function DeleteEvent({
  eventId,
  eventName,
  summary,
  variant = "button",
  onRequestClose,
}: {
  eventId: string;
  eventName: string;
  /** e.g. "3 tasks · 1 budget line" — what else disappears. Omitted when nothing else exists. */
  summary?: string;
  variant?: "button" | "link" | "menu";
  /** Lets a containing menu dismiss itself when the dialog takes over. */
  onRequestClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  // react-dom 18 has no useFormStatus, so the pending state comes from the transition.
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // Stop the page behind the dialog from scrolling while it's up.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, isPending]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          onRequestClose?.();
        }}
        className={
          variant === "menu"
            ? "flex h-11 w-full items-center px-3 text-left text-ui text-danger transition-colors hover:bg-panel-alt"
            : variant === "link"
              ? "flex h-11 shrink-0 items-center text-ui text-ink-muted transition-colors hover:text-danger"
              : "flex h-11 shrink-0 items-center border border-rule px-3 text-ui text-danger transition-colors hover:bg-panel-alt"
        }
      >
        Delete event
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
          onClick={() => !isPending && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-event-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md border border-rule bg-panel p-6"
          >
            <h2 id="delete-event-title" className="font-display text-[24px] font-normal leading-tight text-ink">
              Delete “{eventName}”?
            </h2>
            <p className="mt-2 text-[13px] text-ink-muted">
              This permanently deletes the event{summary ? `, along with ${summary}` : ""}. It
              can&apos;t be undone.
            </p>
            <p className="mt-2 text-meta text-ink-muted">
              Screens you built stay in the Builder library — only this event&apos;s copies of
              their records are removed.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="h-11 border border-rule px-4 text-ui text-ink transition-colors hover:bg-panel-alt disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(() => deleteEvent(eventId))}
                className="h-11 bg-danger px-4 text-ui text-panel transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {isPending ? "Deleting…" : "Delete event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
