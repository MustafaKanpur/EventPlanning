export type Column = {
  key: string;
  label: string;
  align?: "left" | "right";
  width?: string;
  /** Header text exists for screen readers but isn't painted (e.g. an actions column). */
  srOnly?: boolean;
};

/**
 * Ruled rows in one bordered container — the replacement for stacks of floating cards.
 *
 * `empty` is a prop rather than something the caller renders itself: that's how the
 * dashed-box empty state gets designed out of the app. An empty table still shows its
 * header and container, with a sentence where the rows would be.
 */
export function DataTable({
  columns,
  children,
  empty,
  footer,
  caption,
  className = "",
}: {
  columns: Column[];
  children?: React.ReactNode;
  empty?: React.ReactNode;
  footer?: React.ReactNode;
  caption?: string;
  className?: string;
}) {
  const hasRows = Boolean(children);
  return (
    <div className={`overflow-x-auto border border-rule bg-panel ${className}`}>
      <table className="w-full border-collapse text-left">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="h-head border-b border-rule bg-panel-alt">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={col.width ? { width: col.width } : undefined}
                className={`px-4 text-micro font-medium uppercase text-ink-muted ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {col.srOnly ? <span className="sr-only">{col.label}</span> : col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-rule-soft">
          {hasRows ? (
            children
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-[13px] text-ink-muted">
                {empty ?? "Nothing here yet."}
              </td>
            </tr>
          )}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="border-t border-rule">
              <td colSpan={columns.length} className="px-4 py-3 text-[13px]">
                {footer}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function Row({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <tr className={`h-row align-middle ${className}`}>{children}</tr>;
}

export function Cell({
  children,
  align = "left",
  className = "",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 ${align === "right" ? "text-right" : ""} ${className}`}>
      {children}
    </td>
  );
}
