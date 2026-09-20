"use client";

import { usePathname } from "next/navigation";

import { TopBar, DEFAULT_NAV } from "@/components/ui";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * Thin client wrapper so the chrome can mark the current section active. TopBar itself
 * stays presentational; only the pathname lookup needs the client.
 */
export function AppChrome({ user }: { user: { name?: string | null; email?: string | null } }) {
  const pathname = usePathname() ?? "";
  const active = DEFAULT_NAV.find((item) => {
    const path = item.href.split("?")[0];
    return pathname === path || pathname.startsWith(`${path}/`);
  });

  return (
    <TopBar
      user={user}
      activeHref={active?.href}
      actions={<SignOutButton />}
    />
  );
}
