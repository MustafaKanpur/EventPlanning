import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { AppChrome } from "@/components/app-chrome";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin");

  return (
    <div className="min-h-screen bg-ground">
      <AppChrome user={{ name: session.user.name, email: session.user.email }} />
      <main className="mx-auto max-w-6xl px-6 py-9">{children}</main>
    </div>
  );
}
