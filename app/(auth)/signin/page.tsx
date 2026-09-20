"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";

type State = { status: "idle" | "sending" | "sent" } | { status: "error"; message: string };

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  async function handleEmailSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "sending" });

    // The old version set "check your email" unconditionally, so a failed send looked
    // identical to a successful one — which is how a missing SMTP config hid itself.
    const result = await signIn("email", { email, redirect: false, callbackUrl: "/dashboard" });

    if (!result || result.error) {
      setState({
        status: "error",
        message:
          "We couldn't send the link. The mail server may not be configured — check the server logs.",
      });
      return;
    }
    setState({ status: "sent" });
  }

  return (
    <div className="w-full max-w-sm space-y-8 border border-rule bg-panel p-8">
      <div className="space-y-2 text-center">
        <h1 className="font-display text-[26px] font-normal leading-tight text-ink">
          Event Planning
        </h1>
        <p className="text-[13px] text-ink-muted">Sign in to your team workspace</p>
      </div>

      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        className="flex h-11 w-full items-center justify-center border border-rule bg-panel px-4 text-ui text-ink transition-colors hover:bg-panel-alt"
      >
        Continue with Google
      </button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-rule" />
        <span className="text-micro uppercase text-ink-muted">or</span>
        <div className="h-px flex-1 bg-rule" />
      </div>

      {state.status === "sent" ? (
        <p className="border border-rule bg-panel-alt px-4 py-3 text-[13px] text-ink">
          Check your email for a sign-in link.
        </p>
      ) : (
        <form onSubmit={handleEmailSignIn} className="space-y-3">
          <label className="sr-only" htmlFor="signin-email">
            Email address
          </label>
          <input
            id="signin-email"
            type="email"
            required
            placeholder="you@organization.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 w-full border border-rule bg-panel px-3 text-[13px] text-ink focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={state.status === "sending"}
            className="h-11 w-full bg-accent px-4 text-ui text-panel transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {state.status === "sending" ? "Sending…" : "Send magic link"}
          </button>
          {state.status === "error" && (
            <p className="border border-rule px-3 py-2 text-[13px] text-danger" role="alert">
              {state.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
