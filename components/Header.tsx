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
        background: "rgba(246, 241, 230, 0.82)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none" }}>
          <Logo size={29} />
          <span className="display" style={{ fontSize: 23, fontWeight: 600 }}>
            Tutor<span style={{ color: "var(--amber-deep)" }}>Stake</span>
          </span>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 24 }} className="hdr-nav">
          <a href="#how" style={{ textDecoration: "none", color: "var(--ink-2)", fontWeight: 500, fontSize: 15 }}>How it works</a>
          <a href="#open" style={{ textDecoration: "none", color: "var(--ink-2)", fontWeight: 500, fontSize: 15 }}>Open a plan</a>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
          {account ? (
            <div style={{ position: "relative" }}>
              <button onClick={() => setOpen((o) => !o)} className="btn btn--ghost btn--sm">
                <span className="dot" style={{ background: chainOk ? "var(--good)" : "var(--bad)" }} />
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{account.slice(0, 5)}…{account.slice(-4)}</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease", opacity: 0.6 }}>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {open && (
                <>
                  <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
                  <div className="card" style={{ position: "absolute", top: "calc(100% + 9px)", right: 0, zIndex: 61, minWidth: 246, overflow: "hidden", padding: 0 }}>
                    <div style={{ padding: "14px 15px" }}>
                      <div className="label" style={{ marginBottom: 5 }}>Wallet</div>
                      <div className="num" style={{ fontSize: 14 }}>{account.slice(0, 13)}…{account.slice(-6)}</div>
                      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6 }}>{balance || "0"} USDC</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 15px", borderTop: "1px solid var(--line)", fontSize: 13 }}>
                      <span style={{ color: "var(--muted)" }}>Network</span>
                      {chainOk ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                          <span className="dot" style={{ background: "var(--good)" }} /> ARC Testnet
                        </span>
                      ) : (
                        <button onClick={() => switchToArc().catch(() => {})} style={{ background: "none", border: "none", color: "var(--bad)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                          Wrong — switch ↗
                        </button>
                      )}
                    </div>
                    <button className="menu-item" onClick={copy}>{copied ? "Copied ✓" : "Copy address"}</button>
                    <a className="menu-item" href={`${ARCSCAN}/address/${account}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>View on ArcScan ↗</a>
                    <button className="menu-item danger" onClick={() => { setOpen(false); onDisconnect(); }}>Disconnect</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button onClick={onConnect} disabled={connecting} className="btn btn--ink btn--sm">
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
