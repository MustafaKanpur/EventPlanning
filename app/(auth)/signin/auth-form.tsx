"use client";

import { useFormState, useFormStatus } from "react-dom";

import type { AuthState } from "./actions";

const input =
  "h-11 w-full border border-rule bg-panel px-3 text-[13px] text-ink focus:border-accent focus:outline-none";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 w-full bg-accent px-4 text-ui text-panel transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "One moment…" : label}
    </button>
  );
}

/** Email + password form shared by sign-in and sign-up; sign-up also asks for a name. */
export function AuthForm({
  action,
  submitLabel,
  withName = false,
}: {
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  submitLabel: string;
  withName?: boolean;
}) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form action={formAction} className="space-y-3">
      {withName && (
        <div className="space-y-1">
          <label htmlFor="auth-name" className="text-caption text-ink-muted">Name</label>
          <input id="auth-name" name="name" required autoComplete="name" className={input} />
        </div>
      )}
      <div className="space-y-1">
        <label htmlFor="auth-email" className="text-caption text-ink-muted">Email</label>
        <input id="auth-email" name="email" type="email" required autoComplete="email" className={input} />
      </div>
      <div className="space-y-1">
        <label htmlFor="auth-password" className="text-caption text-ink-muted">Password</label>
        <input
          id="auth-password"
          name="password"
          type="password"
          required
          minLength={withName ? 8 : undefined}
          autoComplete={withName ? "new-password" : "current-password"}
          className={input}
        />
      </div>
      <Submit label={submitLabel} />
      {state?.error && (
        <p className="border border-rule px-3 py-2 text-[13px] text-danger" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
