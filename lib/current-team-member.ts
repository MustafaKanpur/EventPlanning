import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Every signed-in User maps to exactly one TeamMember (the app-facing profile that
 * Events/Tasks reference). The link is normally made by the `createUser` NextAuth
 * event; this falls back to creating/linking it so the mapping can never go missing.
 */
export async function getCurrentTeamMember() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) return null;

  const byUserId = await prisma.teamMember.findUnique({
    where: { userId: session.user.id },
  });
  if (byUserId) return byUserId;

  return prisma.teamMember.upsert({
    where: { email: session.user.email },
    update: { userId: session.user.id },
    create: {
      email: session.user.email,
      name: session.user.name ?? session.user.email,
      userId: session.user.id,
    },
  });
}
