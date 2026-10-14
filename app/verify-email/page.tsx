import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { authOptions } from "@/lib/auth";
import { ResendButton } from "./resend-button";

/** Where a signed-in but unverified account waits. Nothing else in the app is open to it. */
export default async function VerifyEmailPage({ searchParams }: { searchParams: { expired?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect(searchParams.expired ? "/signin?expired=1" : "/signin");
  if (session.user.emailVerified) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-ground px-4">
      <div className="w-full max-w-sm space-y-6 border border-rule bg-panel p-8">
        <div className="space-y-2 text-center">
          <h1 className="font-display text-[26px] font-normal leading-tight text-ink">Check your email</h1>
          <p className="text-[13px] text-ink-muted">
            We sent a link to <span className="text-ink">{session.user.email}</span>. Click it to finish setting
            up your account.
          </p>
          {searchParams.expired && (
            <p className="text-meta text-danger">That link was invalid or has expired. Send a new one below.</p>
          )}
        </div>
        <ResendButton />
        <div className="flex justify-center">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
