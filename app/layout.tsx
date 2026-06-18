import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TutorStake — money on the table, released one lesson at a time",
  description:
    "Escrow a course of tutoring in native USDC. Every lesson is a measured line — confirm it and exactly one lesson's USDC pays out, instantly. Go quiet and it auto-settles after 24h.",
  keywords: "TutorStake, ARC, USDC, tutoring, escrow, payments, lessons, language, web3, agentic",
};

export const viewport: Viewport = {
  themeColor: "#0f1a22",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
