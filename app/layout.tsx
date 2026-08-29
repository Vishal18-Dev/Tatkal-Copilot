import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { StoreProvider } from "@/lib/store";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tatkal Copilot — Stop Guessing. Start Winning Tatkal.",
  description:
    "Your AI travel agent prepares your complete Tatkal strategy before booking begins. Never automates booking. Just makes you dramatically better prepared.",
};

export const viewport: Viewport = {
  themeColor: "#f7f7f5",
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
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-full">
        <LanguageProvider>
          <StoreProvider>{children}</StoreProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
