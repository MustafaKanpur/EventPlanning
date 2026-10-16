/**
 * The ticket stub: month over a big day number, with a perforated edge on the right.
 * It's the one shape that says "event" across the app — dashboard rows and the event
 * header both lead with it. The perforation's notches are cut in the page colour, so
 * place it where the surrounding background is bg-ground.
 */
export function DateStub({
  date,
  size = "md",
  className = "",
}: {
  date: Date;
  size?: "md" | "lg";
  className?: string;
}) {
  const month = date.toLocaleString("en-GB", { month: "short" });
  const weekday = date.toLocaleString("en-GB", { weekday: "short" });
  const day = date.getDate();
  const lg = size === "lg";

  return (
    <time
      dateTime={date.toISOString().slice(0, 10)}
      className={`flex shrink-0 flex-col items-center justify-center text-center ${
        lg ? "w-[84px]" : "w-[72px]"
      } ${className}`}
    >
      <span className="text-meta font-semibold text-accent">{month}</span>
      <span className={`font-display leading-[0.95] text-ink ${lg ? "text-[46px]" : "text-[38px]"}`}>
        {day}
      </span>
      <span className="text-meta text-ink-muted">{weekday}</span>
    </time>
  );
}
