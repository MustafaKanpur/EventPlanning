import type { Metadata } from "next";
import { Big_Shoulders_Display, Public_Sans } from "next/font/google";
import "./globals.css";

import { PendingBar } from "@/components/pending-bar";
import { AuthProvider } from "@/components/providers/auth-provider";

// UI, body and every figure (set tabular in globals.css).
const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

// Display: page titles and big figures. Loaded at 700 only, so the `font-normal`
// left on display headings still resolves to the one bold cut — signage, not a serif.
const bigShoulders = Big_Shoulders_Display({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-big-shoulders",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Event Planning",
  description: "One connected workspace for planning nonprofit events.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${publicSans.variable} ${bigShoulders.variable} bg-ground font-sans text-ink antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
        <PendingBar />
      </body>
    </html>
  );
}
