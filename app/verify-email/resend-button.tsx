"use client";

import { useFormState, useFormStatus } from "react-dom";

import { resendVerification } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 w-full border border-rule bg-panel px-4 text-ui text-ink transition-colors hover:bg-panel-alt disabled:opacity-50"
    >
      {pending ? "Sending…" : "Send the link again"}
    </button>
  );
}

export function ResendButton() {
  const [state, action] = useFormState(resendVerification, null);
  return (
    <form action={action} className="space-y-2">
      <Submit />
      {state?.sent && <p className="text-center text-meta text-ink-muted">Sent. Check your inbox.</p>}
    </form>
  );
}
