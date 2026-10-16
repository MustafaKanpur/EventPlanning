/**
 * Page title block. Big Shoulders is a narrow signage face, so it runs large — 44px
 * reads like a venue sign while staying no wider than the old 36px serif.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  className = "",
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h1 className="font-display text-[44px] leading-none tracking-[0.005em] text-ink">
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-[13px] text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-4">{actions}</div>}
    </div>
  );
}
