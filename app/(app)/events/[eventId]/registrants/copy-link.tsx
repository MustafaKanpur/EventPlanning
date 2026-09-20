"use client";

import { useEffect, useState } from "react";

/**
 * The public link used to sit in a yellow callout printing a raw localhost URL. It's a
 * read-only input plus a Copy button now — the thing people actually do with it is copy
 * it, and a selectable input is the plainest way to offer that.
 */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="public-registration-link">
        Public registration link
      </label>
      <input
        id="public-registration-link"
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="h-11 w-full min-w-0 border border-rule bg-panel px-3 font-mono text-caption text-ink-muted focus:border-accent focus:outline-none sm:w-[22rem]"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            /* the input is selectable as a fallback */
          }
        }}
        className="h-11 shrink-0 border border-rule px-3 text-ui text-ink transition-colors hover:bg-panel-alt"
      >
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}
