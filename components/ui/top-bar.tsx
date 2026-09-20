import Link from "next/link";

import { formatShortDate, initialsFrom } from "@/lib/format";
import { IconGitHub } from "./icon";

export type NavItem = { label: string; href: string };

/**
 * Nav for the light chrome bar.
 *
 * NOTE: the brief lists Events · Vendors · People · Templates. Vendors still has no
 * route (they live inside a budget line), and Templates arrives with step 7. Both are
 * omitted rather than shipped as 404s.
 */
export const DEFAULT_NAV: NavItem[] = [
  { label: "Events", href: "/dashboard" },
  { label: "People", href: "/team" },
  // Templates land in step 7; screens are built per event from the "+ New screen" tab.
];

export function TopBar({
  nav = DEFAULT_NAV,
  user,
  date,
  actions,
  activeHref,
}: {
  nav?: NavItem[];
  user?: { name?: string | null; email?: string | null };
  /** Defaults to the server clock at render — day granularity, so that's fine. */
  date?: Date;
  /** Sign out, settings — anything that belongs at the right edge. */
  actions?: React.ReactNode;
  activeHref?: string;
}) {
  const today = date ?? new Date();
  const initials = initialsFrom(user?.name, user?.email);

  return (
    <header className="h-bar border-b border-rule bg-panel">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-6 px-6">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="font-display text-[19px] leading-none text-ink">
              Event Planning
            </Link>
            <a
              href="https://github.com/MustafaKanpur/EventPlanning"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Source code on GitHub"
              title="Source on GitHub"
              className="flex h-11 w-9 items-center justify-center text-ink-muted transition-colors hover:text-ink"
            >
              <IconGitHub size={16} />
            </a>
          </div>
          <nav aria-label="Primary">
            <ul className="flex items-center gap-6">
              {nav.map((item) => {
                const active = activeHref === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`text-ui transition-colors hover:text-ink ${
                        active ? "text-ink" : "text-ink-muted"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <time
            dateTime={today.toISOString().slice(0, 10)}
            className="hidden font-mono text-caption tabular-nums text-ink-muted sm:block"
          >
            {formatShortDate(today)}
          </time>
          {actions}
          <span
            // The bar used to print the raw gmail address; initials keep it quiet,
            // with the full identity still available to assistive tech.
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-rule bg-panel-alt text-[11px] font-medium text-ink"
            title={user?.name ?? user?.email ?? undefined}
          >
            <span aria-hidden="true">{initials}</span>
            <span className="sr-only">{user?.name ?? user?.email ?? "Account"}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
