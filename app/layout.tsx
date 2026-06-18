import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TutorStake — pay your tutor, one lesson at a time",
  description:
    "Escrow a course of tutoring in native USDC. Confirm a lesson and exactly one lesson's pay is released to your tutor, instantly. Go quiet and it auto-settles after 24h.",
  keywords: "TutorStake, ARC, USDC, tutoring, escrow, payments, lessons, language, web3, agentic",
};

export const viewport: Viewport = {
  themeColor: "#110a03",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
