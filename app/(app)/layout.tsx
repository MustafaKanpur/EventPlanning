import { redirect } from "next/navigation";

import { getSession } from "@/lib/current-team-member";
import { AppChrome } from "@/components/app-chrome";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/signin");
  if (!session.user.emailVerified) redirect("/verify-email");

  return (
    <div className="min-h-screen bg-ground">
      <AppChrome user={{ name: session.user.name, email: session.user.email }} />
      <main className="mx-auto max-w-6xl px-6 py-9">{children}</main>
    </div>
  );
}
