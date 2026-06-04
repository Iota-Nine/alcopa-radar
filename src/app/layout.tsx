import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navigation } from "@/components/Navigation";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alcopa Radar — Bonnes affaires auto",
  description:
    "Détection automatique de tout le catalogue Alcopa Auction. Top affaires, marge et analyse expert sans URL.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 antialiased">
        <Navigation />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-800/80 py-5 text-center text-xs text-slate-500">
          Alcopa Radar — Outil interne équipe · Analyse Alcopa Auction · Données locales
        </footer>
      </body>
    </html>
  );
}
