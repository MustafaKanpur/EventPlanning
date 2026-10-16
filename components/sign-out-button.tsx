"use client";

import { signOut } from "next-auth/react";

/** `onDark` is for the top bar; elsewhere it sits on a light page. */
export function SignOutButton({ onDark = false }: { onDark?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/signin" })}
      className={`flex h-11 items-center whitespace-nowrap text-ui transition-colors ${
        onDark ? "text-panel/65 hover:text-panel" : "text-ink-muted hover:text-ink"
      }`}
    >
      Sign out
    </button>
  );
}
