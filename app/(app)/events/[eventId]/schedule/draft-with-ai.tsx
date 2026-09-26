"use client";

import { useState, useTransition } from "react";

import { draftScheduleItems, type DraftState } from "./actions";

const field =
  "w-full border border-rule bg-panel px-3 py-2 text-[13px] text-ink focus:border-accent focus:outline-none";

/**
 * Proposes blocks into "Not yet placed". react-dom 18 has no useFormStatus, so the
 * pending state comes from the transition, as in DeleteEvent.
 */
export function DraftWithAi({ eventId }: { eventId: string }) {
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState<DraftState>({});
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await draftScheduleItems(eventId, prompt);
      setState(result);
      if (result.created) setPrompt("");
    });
  }

  return (
    <section>
      <h2 className="mb-2 text-micro uppercase text-ink-muted">Draft with AI</h2>
      <form onSubmit={submit} className="space-y-2 border border-rule bg-panel p-3">
        <label htmlFor="ai-draft-prompt" className="block text-caption text-ink-muted">
          Describe the programme. Drafted blocks land below for you to place.
        </label>
        <textarea
          id="ai-draft-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          required
          maxLength={2000}
          rows={3}
          placeholder="3-hour evening: doors at 6, speaker, dinner, Q&A, Isha at 8:15"
          className={field}
        />
        <button
          type="submit"
          disabled={isPending || !prompt.trim()}
          className="h-11 w-full bg-accent text-ui text-panel transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Drafting…" : "Draft blocks"}
        </button>
        <div aria-live="polite">
          {state.error && (
            <p role="alert" className="text-meta text-danger">
              {state.error}
            </p>
          )}
          {state.created ? (
            <p className="text-meta text-ink-muted">
              {state.created} block{state.created === 1 ? "" : "s"} added below.
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
