import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pool-Bet",
  description: "Pari-mutuel betting amongst friends — chips only, never against the house.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
