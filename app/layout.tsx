import type { Metadata, Viewport } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { StoreProvider } from "@/lib/store";

// V2 design system — Manrope carries all product copy; JetBrains Mono is
// reserved for railway data (PNR, train numbers, countdowns, coach/berth).
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tatkal Copilot — Stop Guessing. Start Winning Tatkal.",
  description:
    "Your AI travel agent prepares your complete Tatkal strategy before booking begins. Never automates booking. Just makes you dramatically better prepared.",
};

export const viewport: Viewport = {
  themeColor: "#f5f6fa",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <body className="min-h-full">
        <LanguageProvider>
          <StoreProvider>{children}</StoreProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
