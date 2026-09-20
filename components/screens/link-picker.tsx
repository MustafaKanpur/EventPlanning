"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { LinkOption } from "@/lib/link-targets";

/**
 * A searchable picker over one kind of core object. Built on a real <input> with a
 * filtered listbox rather than a <select>, because the useful thing to type is "acme",
 * not to scroll a list of every vendor on the event.
 *
 * Choosing an option submits immediately — the surrounding form owns the write, so the
 * picker never holds state the database doesn't have.
 */
export function LinkPicker({
  options,
  value,
  name = "value",
  label,
  onCommit,
}: {
  options: LinkOption[];
  value: string;
  name?: string;
  label: string;
  /** Called with the chosen id once the hidden input holds it. */
  onCommit?: () => void;
}) {
  const selected = options.find((o) => o.id === value) ?? null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState(value);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setCurrent(value), [value]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? options.filter(
          (o) =>
            o.label.toLowerCase().includes(q) || (o.sublabel ?? "").toLowerCase().includes(q),
        )
      : options;
    return pool.slice(0, 40);
  }, [options, query]);

  function choose(id: string) {
    setCurrent(id);
    setOpen(false);
    setQuery("");
    // Let the hidden input's value land before the form reads it.
    requestAnimationFrame(() => onCommit?.());
  }

  const selectedLabel = options.find((o) => o.id === current)?.label ?? selected?.label ?? "";

  return (
    <div ref={boxRef} className="relative">
      <input type="hidden" name={name} value={current} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className="flex h-11 w-full items-center justify-between gap-2 px-2 text-left text-[13px] text-ink hover:bg-panel-alt"
      >
        <span className={selectedLabel ? "" : "text-ink-muted"}>{selectedLabel || "—"}</span>
        <span aria-hidden="true" className="text-ink-muted">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-64 border border-rule bg-panel">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label={`Search ${label}`}
            className="w-full border-b border-rule bg-panel px-3 py-2 text-[13px] text-ink focus:outline-none"
          />
          <ul role="listbox" aria-label={label} className="max-h-64 overflow-y-auto">
            <li>
              <button
                type="button"
                onClick={() => choose("")}
                className="flex h-10 w-full items-center px-3 text-left text-[13px] text-ink-muted hover:bg-panel-alt"
              >
                Clear
              </button>
            </li>
            {matches.length === 0 ? (
              <li className="px-3 py-3 text-[13px] text-ink-muted">Nothing matches.</li>
            ) : (
              matches.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.id === current}
                    onClick={() => choose(option.id)}
                    className={`flex min-h-11 w-full flex-col justify-center px-3 py-1.5 text-left hover:bg-panel-alt ${
                      option.id === current ? "bg-panel-alt" : ""
                    }`}
                  >
                    <span className="text-[13px] text-ink">{option.label}</span>
                    {option.sublabel && (
                      <span className="text-meta text-ink-muted">{option.sublabel}</span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
