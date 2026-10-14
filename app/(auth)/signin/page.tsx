import Link from "next/link";

import { signInWithPassword } from "./actions";
import { AuthForm } from "./auth-form";
import { enterWithoutSigningIn } from "./guest-actions";

// Google and magic-link sign-in are still configured in lib/auth.ts, just not offered
// here while native accounts come first.
export default function SignInPage({ searchParams }: { searchParams: { verified?: string; expired?: string } }) {
  return (
    <div className="w-full max-w-sm space-y-8 border border-rule bg-panel p-8">
      <div className="space-y-2 text-center">
        <h1 className="font-display text-[26px] font-normal leading-tight text-ink">Event Planning</h1>
        <p className="text-[13px] text-ink-muted">Sign in to your team workspace</p>
      </div>

      {searchParams.verified && (
        <p className="border border-rule bg-panel-alt px-4 py-3 text-[13px] text-ink">
          Email confirmed. Sign in to continue.
        </p>
      )}
      {searchParams.expired && (
        <p className="border border-rule px-4 py-3 text-[13px] text-danger">
          That link was invalid or has expired. Sign in to get a new one.
        </p>
      )}

      <AuthForm action={signInWithPassword} submitLabel="Sign in" />

      <p className="text-center text-[13px] text-ink-muted">
        New here?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Create an account
        </Link>
      </p>

      {/* Temporary: stays until the recruiter demo entrance replaces it. */}
      <div className="border-t border-rule pt-5">
        <form action={enterWithoutSigningIn}>
          <button
            type="submit"
            className="h-11 w-full border border-rule bg-panel px-4 text-ui text-ink transition-colors hover:bg-panel-alt"
          >
            Continue without signing in →
          </button>
        </form>
        <p className="mt-2 text-center text-meta text-ink-muted">
          Temporary access while sign-in is being finished. Anyone with this link gets in.
        </p>
      </div>
    </div>
  );
}
