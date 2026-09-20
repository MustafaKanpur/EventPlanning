"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  async function handleEmailSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await signIn("email", { email, redirect: false, callbackUrl: "/dashboard" });
    setEmailSent(true);
  }

  return (
    <div className="w-full max-w-sm space-y-8 rounded-2xl border border-white/10 bg-panel p-8 ">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-accent text-lg text-warn">
          ✦
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Event Planning</h1>
        <p className="text-sm text-ink-muted">Sign in to your team workspace</p>
      </div>

      <button
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        className="flex w-full items-center justify-center gap-2 rounded-[3px] border border-rule bg-panel px-4 py-2 text-sm font-medium text-ink transition hover:border-rule hover:bg-panel-alt"
      >
        Continue with Google
      </button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs uppercase tracking-wide text-ink-muted">or</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {emailSent ? (
        <p className="rounded-[3px] bg-green-50 px-4 py-3 text-sm text-green-700">
          Check your email for a sign-in link.
        </p>
      ) : (
        <form onSubmit={handleEmailSignIn} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@organization.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-[3px] border border-rule px-3 py-2 text-sm focus:border-accent focus:outline-none "
          />
          <button
            type="submit"
            className="w-full rounded-[3px] bg-accent px-4 py-2 text-sm font-medium text-panel transition hover:opacity-90"
          >
            Send magic link
          </button>
        </form>
      )}
    </div>
  );
}
