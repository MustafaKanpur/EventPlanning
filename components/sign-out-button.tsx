"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/signin" })}
      className="flex h-11 items-center text-ui text-ink-muted transition-colors hover:text-ink"
    >
      Sign out
    </button>
  );
}
