import Link from "next/link";

import { signUp } from "../signin/actions";
import { AuthForm } from "../signin/auth-form";

export default function SignUpPage() {
  return (
    <div className="w-full max-w-sm space-y-8 border border-rule bg-panel p-8">
      <div className="space-y-2 text-center">
        <h1 className="font-display text-[26px] font-normal leading-tight text-ink">Create an account</h1>
        <p className="text-[13px] text-ink-muted">We&apos;ll email you a link to confirm your address.</p>
      </div>

      <AuthForm action={signUp} submitLabel="Create account" withName />

      <p className="text-center text-[13px] text-ink-muted">
        Already have an account?{" "}
        <Link href="/signin" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
