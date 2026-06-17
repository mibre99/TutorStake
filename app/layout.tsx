import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TutorStake — pay your tutor per lesson, on ARC",
  description:
    "Escrow a course of lessons in USDC. Each session releases the moment you both confirm — and a missed confirmation settles itself. Pay your tutor safely, on ARC.",
  keywords: "TutorStake, ARC, USDC, tutoring, escrow, payments, lessons, language, web3, agentic",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
