import { NextResponse, type NextRequest } from "next/server";

import { confirmEmail } from "@/lib/email-verification";

/** The link in the verification email lands here. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const ok = token ? await confirmEmail(token) : false;
  // Signed in already? /signin forwards to the dashboard.
  return NextResponse.redirect(new URL(ok ? "/signin?verified=1" : "/verify-email?expired=1", request.url));
}
