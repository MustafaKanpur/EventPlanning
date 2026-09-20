import type { Metadata } from "next";
import { Archivo, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/components/providers/auth-provider";

// UI / body.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

// Display: page titles and big figures. Instrument Serif ships a single weight —
// the design calls for 400 throughout, never bold.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
  display: "swap",
});

// Everything that sits in a column: times, money, counts, ids.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
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
        className={`${archivo.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} bg-ground font-sans text-ink antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
