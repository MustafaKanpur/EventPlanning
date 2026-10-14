import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** Unverified accounts are signed in but not yet tied to the team roster. */
      emailVerified: boolean;
    } & DefaultSession["user"];
  }
}
