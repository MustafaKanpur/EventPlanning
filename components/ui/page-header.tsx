/**
 * Page title block. The display face is set at 400 deliberately — Instrument Serif at
 * 36px carries the hierarchy on its own, and bolding it makes it look like a heading
 * in a template.
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
        <h1 className="font-display text-[36px] font-normal leading-[1.1] tracking-[-0.01em] text-ink">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-[13px] text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-4">{actions}</div>}
    </div>
  );
}
