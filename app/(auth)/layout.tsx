import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";

// A sample evening, shown beside the sign-in form so the first screen is the product's
// core object — a run of show — rather than a slogan.
const SAMPLE = [
  { time: "17:00", title: "Doors & welcome drinks", where: "Main foyer" },
  { time: "18:00", title: "Dinner service", where: "Ballroom" },
  { time: "19:30", title: "Speeches & live auction", where: "Ballroom stage" },
  { time: "20:45", title: "Paddle raise", where: "Ballroom stage" },
  { time: "21:30", title: "Last call & farewells", where: "Main foyer" },
];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <div className="grid min-h-screen bg-ground lg:grid-cols-[1.05fr_1fr]">
      <aside className="hidden flex-col justify-between bg-ink px-12 py-10 text-panel lg:flex">
        <p className="font-display text-[22px] leading-none">Event Planning</p>

        <div className="max-w-md">
          <h2 className="font-display text-[56px] leading-[0.95]">Run the whole night from one sheet.</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-panel/70">
            Run of show, budget, registration and volunteers for nonprofit event teams, linked
            so a change in one shows up everywhere.
          </p>

          <div className="relative mt-10 rounded-lg border border-panel/15" aria-hidden="true">
            <ol className="divide-y divide-panel/10">
              {SAMPLE.map((block) => (
                <li key={block.time} className="flex items-baseline gap-5 px-5 py-3.5">
                  <span className="w-12 shrink-0 text-[13px] tabular-nums text-panel/60">
                    {block.time}
                  </span>
                  <span className="min-w-0 flex-1 text-[14px]">{block.title}</span>
                  <span className="text-meta text-panel/50">{block.where}</span>
                </li>
              ))}
            </ol>
            <div className="now-line pointer-events-none absolute inset-x-0 top-1/3 flex items-center">
              <span className="h-px flex-1 bg-highlight" />
              <span className="-mr-px rounded-l-sm bg-highlight px-1.5 py-0.5 text-[10px] font-semibold text-ink">
                Now
              </span>
            </div>
          </div>
        </div>

        <p className="text-meta text-panel/50">Built for small teams running galas, festivals and fundraisers.</p>
      </aside>

      <div className="flex items-center justify-center px-4 py-10">{children}</div>
    </div>
  );
}
