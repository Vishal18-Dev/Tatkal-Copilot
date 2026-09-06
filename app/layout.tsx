import type { Metadata, Viewport } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { StoreProvider } from "@/lib/store";
import { ThemeProvider, ThemeScript } from "@/lib/theme";
import { InteractionModeProvider, InteractionModeScript } from "@/lib/interaction-mode";
import { VoiceLangProvider } from "@/lib/voice/voice-lang";

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
  title: "Tatkal Copilot — An IRCTC Demo Product",
  description:
    "Your AI travel agent prepares your complete Tatkal strategy before booking begins. Never automates booking. Just makes you dramatically better prepared.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e15" },
  ],
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
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
        <InteractionModeScript />
      </head>
      <body className="min-h-full">
        <ThemeProvider>
          <InteractionModeProvider>
            <LanguageProvider>
              <VoiceLangProvider>
                <StoreProvider>{children}</StoreProvider>
              </VoiceLangProvider>
            </LanguageProvider>
          </InteractionModeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
