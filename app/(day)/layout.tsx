import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";

/**
 * The day-of view gets its own shell: no top chrome, no tabs, no breadcrumb. On the day
 * the phone is held one-handed in a loud room, and every row of navigation is a row not
 * showing what happens next. The URL is unchanged — this is a route group, not a path.
 */
export default async function DayLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin");

  return <div className="min-h-screen bg-ground px-4 py-5">{children}</div>;
}
