"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import { ARCSCAN, switchToArc } from "@/lib/arcNetwork";

interface HeaderProps {
  account: string;
  balance: string;
  chainOk: boolean;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export default function Header({ account, balance, chainOk, connecting, onConnect, onDisconnect }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Truncated forms of the connected address, kept here so the markup stays lean.
  const shortAddr = account ? `${account.slice(0, 5)}…${account.slice(-4)}` : "";
  const longAddr = account ? `${account.slice(0, 13)}…${account.slice(-6)}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(17, 10, 3, 0.72)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "15px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <Logo size={40} />
          <span className="serif" style={{ fontSize: 27, fontWeight: 600, color: "var(--cream)", letterSpacing: "0.01em" }}>
            Tutor<span className="gold-text" style={{ fontStyle: "italic" }}>Stake</span>
          </span>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 30 }} className="hdr-nav">
          <a href="#how" className="caps" style={{ textDecoration: "none", color: "var(--muted)", fontSize: 12.5 }}>How it works</a>
          <a href="#why" className="caps" style={{ textDecoration: "none", color: "var(--muted)", fontSize: 12.5 }}>Why ARC</a>
          <a href="#open" className="caps" style={{ textDecoration: "none", color: "var(--muted)", fontSize: 12.5 }}>Open a plan</a>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
          {account ? (
            <div style={{ position: "relative" }}>
              <button onClick={() => setOpen((o) => !o)} className="btn btn--outline btn--sm">
                <span className="dot" style={{ background: chainOk ? "var(--good)" : "var(--bad)" }} />
                <span className="num" style={{ letterSpacing: "0.04em" }}>{shortAddr}</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease", opacity: 0.7 }}>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {open && (
                <>
                  <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
                  <div className="card gild" style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, zIndex: 61, minWidth: 252, overflow: "hidden", padding: 0 }}>
                    <div style={{ padding: "15px 16px" }}>
                      <div className="label" style={{ marginBottom: 6 }}>Wallet</div>
                      <div className="num" style={{ fontSize: 14.5, color: "var(--cream)" }}>{longAddr}</div>
                      <div className="num" style={{ fontSize: 12.5, color: "var(--gold)", marginTop: 6 }}>{balance || "0"} USDC</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderTop: "1px solid var(--line)", fontSize: 13 }}>
                      <span style={{ color: "var(--muted)" }}>Network</span>
                      {chainOk ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 500, color: "var(--cream)" }}>
                          <span className="dot" style={{ background: "var(--good)" }} /> ARC Testnet
                        </span>
                      ) : (
                        <button onClick={() => switchToArc().catch(() => {})} style={{ background: "none", border: "none", color: "var(--bad)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                          Wrong — switch ↗
                        </button>
                      )}
                    </div>
                    <button className="honey-item" onClick={copy}>{copied ? "Copied ✓" : "Copy address"}</button>
                    <a className="honey-item" href={`${ARCSCAN}/address/${account}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>View on ArcScan ↗</a>
                    <button className="honey-item danger" onClick={() => { setOpen(false); onDisconnect(); }}>Disconnect</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button onClick={onConnect} disabled={connecting} className="btn btn--gold btn--sm">
              {connecting ? "Opening…" : "Enrol wallet"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
