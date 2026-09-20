"use client";

import { useEffect, useState } from "react";

import { IconCheck, IconShare } from "@/components/ui/icon";

/** Copies the event's URL. Falls back to selecting nothing loudly — it just reports failure. */
export function ShareEventButton() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(t);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="flex h-11 items-center gap-2 border border-rule px-3 text-ui text-ink transition-colors hover:bg-panel-alt"
    >
      {state === "copied" ? <IconCheck size={15} /> : <IconShare size={15} />}
      <span aria-live="polite">
        {state === "copied" ? "Link copied" : state === "failed" ? "Copy failed" : "Share"}
      </span>
    </button>
  );
}
