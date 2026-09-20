import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";

import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/signin",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
      // No SMTP configured yet (see .env.example) — print the magic link instead of emailing it.
      sendVerificationRequest: process.env.EMAIL_SERVER_HOST
        ? undefined
        : async ({ identifier, url }) => {
            console.log(`\n[dev] Magic sign-in link for ${identifier}:\n${url}\n`);
          },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  events: {
    // Link every new NextAuth User to a TeamMember profile (creating one if none exists yet).
    async createUser({ user }) {
      if (!user.email) return;
      await prisma.teamMember.upsert({
        where: { email: user.email },
        update: { userId: user.id },
        create: {
          email: user.email,
          name: user.name ?? user.email,
          userId: user.id,
        },
      });
    },
  },
};
