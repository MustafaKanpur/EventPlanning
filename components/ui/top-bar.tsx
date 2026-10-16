import Link from "next/link";

import { formatShortDate, initialsFrom } from "@/lib/format";
import { IconGitHub } from "./icon";

export type NavItem = { label: string; href: string };

/**
 * Nav for the dark chrome bar. The yellow marker under the active section is the one
 * loud element in the system; nothing else uses `highlight`.
 *
 * NOTE: the brief lists Events · Vendors · People · Templates. Vendors still has no
 * route (they live inside a budget line), and Templates arrives with step 7. Both are
 * omitted rather than shipped as 404s.
 */
export const DEFAULT_NAV: NavItem[] = [
  { label: "Events", href: "/dashboard" },
  { label: "People", href: "/team" },
  { label: "Volunteers", href: "/volunteers" },
  { label: "Templates", href: "/templates" },
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
    <header className="h-bar bg-ink text-panel">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4 sm:gap-6 sm:px-6">
        <div className="flex min-w-0 items-center gap-4 sm:gap-8">
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/dashboard" className="whitespace-nowrap font-display text-[22px] leading-none tracking-[0.01em] text-panel">
              Event Planning
            </Link>
            <a
              href="https://github.com/MustafaKanpur/EventPlanning"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Source code on GitHub"
              title="Source on GitHub"
              className="hidden h-11 w-9 items-center justify-center text-panel/60 sm:flex transition-colors hover:text-panel"
            >
              <IconGitHub size={16} />
            </a>
          </div>
          <nav aria-label="Primary" className="min-w-0 overflow-x-auto">
            <ul className="flex items-center gap-5 sm:gap-6">
              {nav.map((item) => {
                const active = activeHref === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex h-bar items-center whitespace-nowrap border-b-[3px] pt-[3px] text-ui transition-colors hover:text-panel ${
                        active ? "border-highlight text-panel" : "border-transparent text-panel/65"
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

        <div className="flex shrink-0 items-center gap-4">
          <time
            dateTime={today.toISOString().slice(0, 10)}
            className="hidden font-mono text-caption tabular-nums text-panel/65 sm:block"
          >
            {formatShortDate(today)}
          </time>
          {actions}
          <span
            // The bar used to print the raw gmail address; initials keep it quiet,
            // with the full identity still available to assistive tech.
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-panel/15 text-[11px] font-semibold text-panel"
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
