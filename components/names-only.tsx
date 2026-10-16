/** What read-only accounts get in place of a list of people: names, nothing else. */
export function NamesOnly({ heading, names }: { heading: string; names: string[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-micro text-ink-muted">{heading}</h2>
      {names.length === 0 ? (
        <p className="text-[13px] text-ink-muted">Nobody yet.</p>
      ) : (
        <ul className="divide-y divide-rule-soft border border-rule bg-panel">
          {names.map((name, i) => (
            <li key={i} className="px-4 py-2 text-[13px] text-ink">
              {name}
            </li>
          ))}
        </ul>
      )}
      <p className="text-meta text-ink-muted">Contact and personal details are hidden for read-only accounts.</p>
    </section>
  );
}
