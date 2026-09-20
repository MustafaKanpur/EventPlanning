import type { Tone } from "./status-dot";

const FIGURE_TONE: Record<Tone, string> = {
  neutral: "text-ink",
  accent: "text-accent",
  warn: "text-warn",
  danger: "text-danger",
  success: "text-ink", // success fails 4.5:1 as text — keep figures readable
};

export type StatItem = {
  figure: React.ReactNode;
  caption: React.ReactNode;
  tone?: Tone;
  href?: string;
};

/**
 * One bordered strip with internal dividers, replacing every KPI card grid. Each cell
 * is a big mono figure over a short sentence — the sentence says what to do about it,
 * which a bare "Total planned" label never did.
 */
export function StatStrip({
  label,
  items,
  className = "",
}: {
  label?: string;
  items: StatItem[];
  className?: string;
}) {
  return (
    <section className={className} aria-label={label}>
      {label && (
        <h2 className="mb-2 text-micro uppercase text-ink-muted">{label}</h2>
      )}
      <div className="grid grid-cols-1 divide-y divide-rule border border-rule bg-panel sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map((item, i) => {
          const body = (
            <>
              <span
                className={`font-mono text-[26px] leading-none tabular-nums ${
                  FIGURE_TONE[item.tone ?? "neutral"]
                }`}
              >
                {item.figure}
              </span>
              <span className="mt-2 block text-caption text-ink-muted">{item.caption}</span>
            </>
          );
          return item.href ? (
            <a
              key={i}
              href={item.href}
              className="block px-5 py-4 transition-colors hover:bg-panel-alt"
            >
              {body}
            </a>
          ) : (
            <div key={i} className="px-5 py-4">
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
