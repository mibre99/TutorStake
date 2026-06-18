"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import Header from "@/components/Header";
import PlanCard from "@/components/PlanCard";
import { useWallet } from "@/lib/useWallet";
import { ARCSCAN, switchToArc } from "@/lib/arcNetwork";
import { pickProvider } from "@/lib/wallet";
import {
  CONTRACT_ADDRESS,
  TUTORSTAKE_ABI,
  hasContract,
  readContract,
  fetchStats,
  fetchPlansOf,
  fetchTeachingOf,
  fetchTutorEarned,
  fmtUsdc,
  shortAddr,
  EMPTY_STATS,
  type Plan,
  type Stats,
} from "@/lib/tutorstake";

export default function Home() {
  const { account, balance, chainOk, connecting, connect, disconnect, refreshBalance } = useWallet();

  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [learning, setLearning] = useState<Plan[]>([]);
  const [teaching, setTeaching] = useState<Plan[]>([]);
  const [earned, setEarned] = useState<bigint>(0n);
  const [tab, setTab] = useState<"learning" | "teaching">("learning");

  // open-plan form
  const [tutor, setTutor] = useState("");
  const [subject, setSubject] = useState("");
  const [price, setPrice] = useState("5");
  const [sessions, setSessions] = useState("8");
  const [openMsg, setOpenMsg] = useState("");

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  const loadEpoch = useRef(0);
  const accountRef = useRef(account);
  const inFlight = useRef(false);

  useEffect(() => {
    accountRef.current = account;
  }, [account]);

  const load = useCallback(async () => {
    if (!hasContract()) return;
    const epoch = ++loadEpoch.current;
    try {
      const c = readContract();
      const s = await fetchStats(c);
      if (epoch !== loadEpoch.current) return;
      setStats(s);
      if (account) {
        const [le, te, ea] = await Promise.all([fetchPlansOf(account, c), fetchTeachingOf(account, c), fetchTutorEarned(account, c)]);
        if (epoch !== loadEpoch.current) return;
        setLearning(le);
        setTeaching(te);
        setEarned(ea);
      } else {
        setLearning([]);
        setTeaching([]);
        setEarned(0n);
      }
    } catch {
      /* keep last good state */
    }
  }, [account]);

  useEffect(() => {
    load();
  }, [load]);

  async function writeContract() {
    const inj = pickProvider();
    if (!inj) throw new Error("No wallet found");
    await switchToArc(inj);
    const provider = new ethers.BrowserProvider(inj);
    const signer = await provider.getSigner(account);
    return new ethers.Contract(CONTRACT_ADDRESS, TUTORSTAKE_ABI, signer);
  }

  function reason(e: unknown): string {
    const err = e as { code?: string | number; reason?: string; shortMessage?: string; message?: string };
    if (err?.code === "ACTION_REJECTED" || err?.code === 4001) return "Cancelled";
    return (err?.reason || err?.shortMessage || err?.message || "Failed").slice(0, 80);
  }

  async function run(key: string, setMsg: (t: string) => void, fn: (c: ethers.Contract) => Promise<ethers.ContractTransactionResponse>, done: string): Promise<boolean> {
    if (!account) {
      if (!pickProvider()) { setMsg("✗ No wallet — install Rabby or MetaMask"); return false; }
      connect();
      return false;
    }
    if (inFlight.current) return false;
    inFlight.current = true;
    const captured = account;
    setActiveKey(key);
    setMsg("Confirm in your wallet…");
    let ok = false;
    try {
      const c = await writeContract();
      const tx = await fn(c);
      setMsg("Settling on ARC…");
      await tx.wait();
      if (accountRef.current !== captured) return false;
      setMsg(done);
      await load();
      await refreshBalance(captured);
      ok = true;
    } catch (e) {
      setMsg("✗ " + reason(e));
    } finally {
      inFlight.current = false;
      setActiveKey(null);
    }
    return ok;
  }

  function flash(key: string, text: string, hold = false) {
    setNote((n) => ({ ...n, [key]: text }));
    if (!hold) setTimeout(() => setNote((n) => { const m = { ...n }; delete m[key]; return m; }), 3500);
  }

  // ── actions ──
  async function openPlan() {
    const t = tutor.trim();
    const sub = subject.trim();
    const p = price.trim();
    const n = Number(sessions);
    if (!ethers.isAddress(t)) return setOpenMsg("✗ Enter the tutor's wallet address");
    if (account && t.toLowerCase() === account.toLowerCase()) return setOpenMsg("✗ The tutor can't be you");
    if (!sub || sub.length > 80) return setOpenMsg("✗ Add a subject, e.g. German B1");
    if (!/^\d+(\.\d{1,2})?$/.test(p) || Number(p) <= 0) return setOpenMsg("✗ Price per lesson — a positive amount, max 2 decimals");
    if (!Number.isInteger(n) || n < 1 || n > 1000) return setOpenMsg("✗ Lessons must be a whole number (1–1000)");
    const priceWei = ethers.parseEther(p);
    const total = priceWei * BigInt(n);
    const ok = await run("open", setOpenMsg, (c) => c.openPlan(t, sub, priceWei, n, { value: total }), "✓ Plan opened & escrowed");
    if (ok) { setTutor(""); setSubject(""); }
  }

  const planAct = (id: number, kind: string, fn: (c: ethers.Contract) => Promise<ethers.ContractTransactionResponse>, done: string) =>
    run("p" + id, (t) => flash("p" + id, t, t.startsWith("Confirm") || t.startsWith("Settling")), fn, done);

  const onMark = (id: number) => planAct(id, "mark", (c) => c.markDone(id), "✓ Marked — waiting on the student");
  const onConfirm = (id: number) => planAct(id, "confirm", (c) => c.confirm(id), "✓ Confirmed — tutor paid");
  const onReject = (id: number) => planAct(id, "reject", (c) => c.reject(id), "Lesson cleared");
  const onSettle = (id: number) => planAct(id, "settle", (c) => c.settle(id), "✓ Settled — you got paid");
  const onClose = (id: number) => planAct(id, "close", (c) => c.closePlan(id), "✓ Closed — refunded");

  const locked = stats.escrowed - stats.released - stats.refunded;
  const wrap: React.CSSProperties = { maxWidth: 1160, margin: "0 auto", padding: "0 24px" };
  const list = tab === "learning" ? learning : teaching;

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      <Header account={account} balance={balance} chainOk={chainOk} connecting={connecting} onConnect={connect} onDisconnect={disconnect} />

      {!hasContract() && (
        <div style={{ ...wrap, marginTop: 16 }}>
          <div className="panel" style={{ padding: "12px 16px", color: "var(--bad)", fontSize: 13.5 }}>
            Contract not wired in yet — deploy it from <a href="/deploy" style={{ color: "var(--amber-deep)", fontWeight: 700 }}>/deploy</a> and class is in session.
          </div>
        </div>
      )}

      {/* hero */}
      <section style={{ ...wrap, paddingTop: "clamp(36px, 5vw, 60px)" }}>
        <div className="grid-hero rise">
          <div>
            <span className="chip" style={{ marginBottom: 22 }}>
              <span className="dot live" style={{ background: "var(--amber)" }} /> LESSON ESCROW · ARC TESTNET
            </span>
            <h1 className="display" style={{ fontSize: "clamp(2.6rem, 6vw, 4.4rem)", lineHeight: 1.04 }}>
              Money on the table,<br />
              <span className="amber-ink">released</span>{" "}
              <span style={{ position: "relative", whiteSpace: "nowrap" }}>
                one lesson
                <span style={{ position: "absolute", left: 0, right: 0, bottom: -9, height: 8, borderBottom: "1.5px solid var(--cyan)" }}>
                  <span style={{ position: "absolute", left: 0, bottom: 0, width: 1.5, height: 7, background: "var(--cyan)" }} />
                  <span style={{ position: "absolute", right: 0, bottom: 0, width: 1.5, height: 7, background: "var(--cyan)" }} />
                </span>
              </span><br />
              at a time.
            </h1>
            <p style={{ fontSize: 17, color: "var(--ink-2)", maxWidth: 510, lineHeight: 1.55, marginTop: 26 }}>
              Escrow a course of tutoring in native USDC. Every lesson is a measured line — confirm it and
              exactly one lesson&apos;s USDC pays out, instantly. Go quiet and it auto-settles after 24h.
            </p>
            <div style={{ display: "flex", gap: 11, marginTop: 30, flexWrap: "wrap" }}>
              <a href="#open" className="btn btn--ink btn--lg">Open a plan</a>
              <a href="#how" className="btn btn--ghost btn--lg">How it works</a>
            </div>
          </div>

          {/* the escrow schematic — the signature drafting visual */}
          <div className="card" style={{ padding: "18px 18px 8px" }}>
            <svg viewBox="0 0 440 330" width="100%" style={{ display: "block" }} role="img" aria-label="Escrow schematic: 3 of 8 lessons released">
              <defs>
                <pattern id="dg" width="22" height="22" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="1" fill="#4fcedf" opacity="0.06" />
                </pattern>
              </defs>
              <rect x="0" y="0" width="440" height="330" fill="url(#dg)" />

              {/* top labels */}
              <text x="30" y="34" className="label" fill="var(--muted)" style={{ fontSize: 11, letterSpacing: "0.14em" }}>8 LESSONS</text>
              <text x="410" y="34" textAnchor="end" fill="var(--ink)" style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 13 }}>240.00 USDC</text>

              {/* released callout */}
              <line x1="151" y1="118" x2="151" y2="78" stroke="var(--line-2)" strokeWidth="1" />
              <line x1="151" y1="78" x2="120" y2="78" stroke="var(--line-2)" strokeWidth="1" />
              <text x="116" y="74" textAnchor="end" fill="var(--amber)" style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12.5 }}>+30.00 USDC</text>
              <text x="116" y="90" textAnchor="end" fill="var(--muted)" style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, letterSpacing: "0.08em" }}>RELEASED ×3</text>

              {/* the dimension line */}
              <line x1="40" y1="130" x2="400" y2="130" stroke="var(--line-2)" strokeWidth="1.4" />
              <line x1="40" y1="122" x2="40" y2="138" stroke="var(--line-2)" strokeWidth="1.4" />
              <line x1="400" y1="122" x2="400" y2="138" stroke="var(--line-2)" strokeWidth="1.4" />

              {/* 8 lesson ticks */}
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                const x = 60 + i * 45.7;
                if (i < 3) return (
                  <g key={i}>
                    <line x1={x} y1="119" x2={x} y2="141" stroke="var(--cyan)" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx={x} cy="130" r="6" fill="var(--amber)" opacity="0.18" />
                    <circle cx={x} cy="130" r="3" fill="var(--amber)" />
                  </g>
                );
                if (i === 3) return <line key={i} className="sch-pulse" x1={x} y1="117" x2={x} y2="143" stroke="var(--cyan)" strokeWidth="2.5" strokeLinecap="round" />;
                return <line key={i} x1={x} y1="124" x2={x} y2="136" stroke="var(--faint)" strokeWidth="1.5" strokeLinecap="round" />;
              })}

              {/* awaiting-confirm bracket on lesson 4 */}
              <line x1="196.9" y1="143" x2="196.9" y2="182" stroke="var(--line-2)" strokeWidth="1" />
              <path d="M150 182 H244 M150 182 V188 M244 182 V188" stroke="var(--line-2)" strokeWidth="1" fill="none" />
              <text x="197" y="202" textAnchor="middle" fill="var(--muted)" style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11 }}>{"{ 24h auto-settle window }"}</text>

              {/* protractor detail */}
              <path d="M34 300 A30 30 0 0 1 64 270" stroke="var(--line-2)" strokeWidth="1" fill="none" />
              <line x1="34" y1="300" x2="64" y2="300" stroke="var(--line-2)" strokeWidth="1" />
              <line x1="34" y1="300" x2="34" y2="270" stroke="var(--line-2)" strokeWidth="1" />
              <line x1="49" y1="300" x2="49" y2="295" stroke="var(--muted)" strokeWidth="1" />
              <line x1="55.6" y1="289.4" x2="52" y2="285.8" stroke="var(--muted)" strokeWidth="1" />

              {/* title block */}
              <rect x="300" y="276" width="112" height="36" fill="none" stroke="var(--line-2)" strokeWidth="1" />
              <line x1="300" y1="294" x2="412" y2="294" stroke="var(--line-2)" strokeWidth="1" />
              <text x="306" y="289" fill="var(--cyan)" style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11, letterSpacing: "0.1em" }}>DWG-01</text>
              <text x="306" y="307" fill="var(--muted)" style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 9, letterSpacing: "0.08em" }}>ESCROW SCHEMATIC</text>
            </svg>
          </div>
        </div>

        {/* the ledger — stats as a square 2×2, not a row of tiles */}
        <div className="ledger-wrap" style={{ marginTop: 34 }}>
          <div className="ledger">
            <div className="lhead">
              <span className="label">Escrow ledger · DWG-02</span>
              <span className="lpips" title="read straight off the contract">
                {[0, 1, 2, 3, 4].map((i) => <span key={i} className={i < 3 ? "lp lp--on" : "lp"} />)}
              </span>
            </div>
            <div className="lcell">
              <div className="display" style={{ fontSize: "clamp(30px, 5vw, 44px)" }}>{stats.plans}</div>
              <div className="label" style={{ marginTop: 6 }}>Plans opened</div>
            </div>
            <div className="lcell">
              <div className="display" style={{ fontSize: "clamp(30px, 5vw, 44px)" }}>{stats.sessions}</div>
              <div className="label" style={{ marginTop: 6 }}>Lessons settled</div>
            </div>
            <div className="lcell lcell--amber">
              <div className="mono amber-ink" style={{ fontSize: "clamp(26px, 4.4vw, 38px)", overflowWrap: "anywhere", lineHeight: 1.05 }}>${fmtUsdc(stats.released)}</div>
              <div className="label" style={{ marginTop: 8, color: "var(--amber-deep)" }}>Paid to tutors</div>
            </div>
            <div className="lcell">
              <div className="mono" style={{ fontSize: "clamp(26px, 4.4vw, 38px)", overflowWrap: "anywhere", lineHeight: 1.05, color: "var(--ink)" }}>${fmtUsdc(locked < 0n ? 0n : locked)}</div>
              <div className="label" style={{ marginTop: 8 }}>In escrow now</div>
            </div>
          </div>
          <aside>
            <div className="display" style={{ fontSize: "clamp(22px, 2.7vw, 33px)", lineHeight: 1.22 }}>
              Real money, held in the open —<br /><span className="amber-ink">released</span> a lesson at a time.
            </div>
            <p style={{ fontSize: 14.5, color: "var(--muted)", lineHeight: 1.55, marginTop: 14, maxWidth: 380 }}>
              Every figure is read straight off the contract. Nothing sits in a company account — the escrow is the bookkeeper.
            </p>
          </aside>
        </div>
      </section>

      {/* open a plan */}
      <section id="open" style={{ ...wrap, marginTop: 44 }}>
        <div className="panel" style={{ padding: "clamp(22px, 3vw, 32px)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            <div>
              <div className="label" style={{ marginBottom: 8, color: "var(--cyan)" }}>Form-01 · New plan</div>
              <h2 className="display" style={{ fontSize: "clamp(26px, 3.4vw, 38px)" }}>Open a plan</h2>
            </div>
            {account && <span className="mono" style={{ fontSize: 13, color: "var(--muted)" }}>Earned <span className="amber-ink">${fmtUsdc(earned)}</span> teaching</span>}
          </div>

          {!account ? (
            <div style={{ padding: "20px 0", textAlign: "center" }}>
              <p style={{ color: "var(--muted)", fontSize: 15, marginBottom: 16 }}>Connect your wallet to escrow a course of lessons.</p>
              <button onClick={connect} className="btn btn--ink">Connect wallet</button>
            </div>
          ) : (
            <>
              <Field label="Tutor's wallet address">
                <input value={tutor} onChange={(e) => setTutor(e.target.value)} className="input" placeholder="0x… your tutor's address" />
              </Field>
              <div className="form-row" style={{ marginTop: 12 }}>
                <Field label="Subject">
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={80} className="input" placeholder="German B1" />
                </Field>
                <div className="form-row" style={{ gap: 12 }}>
                  <Field label="Price / lesson (USDC)">
                    <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className="input" placeholder="5" />
                  </Field>
                  <Field label="Lessons">
                    <input value={sessions} onChange={(e) => setSessions(e.target.value)} inputMode="numeric" className="input" placeholder="8" />
                  </Field>
                </div>
              </div>
              <div className="dimline" style={{ marginTop: 22 }}>
                <span className="label" style={{ flex: "0 0 auto" }}>Escrow total</span>
                <span className="dimline__cap" />
                <span className="dimline__rule" />
                <span className="dimline__val">
                  ${fmtUsdc(escrowTotal(price, sessions))} <span style={{ color: "var(--muted)" }}>= ${price || "0"} × {sessions || "0"}</span>
                </span>
                <span className="dimline__rule" />
                <span className="dimline__cap" />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginTop: 18 }}>
                <button onClick={openPlan} disabled={activeKey === "open"} className="btn btn--amber btn--lg">
                  {activeKey === "open" ? "Opening…" : `Fund & open · $${fmtUsdc(escrowTotal(price, sessions))}`}
                </button>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Locked in escrow, released a lesson at a time.</span>
                {openMsg && <span className="mono" style={{ fontSize: 13, color: openMsg.startsWith("✓") ? "var(--good)" : openMsg.startsWith("✗") ? "var(--bad)" : "var(--muted)" }}>{openMsg}</span>}
              </div>
            </>
          )}
        </div>
      </section>

      {/* my plans */}
      <section style={{ ...wrap, marginTop: 44 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <h2 className="display" style={{ fontSize: "clamp(26px, 3.4vw, 38px)" }}>Your lessons</h2>
          <div className="segctl">
            <button data-on={tab === "learning"} onClick={() => setTab("learning")}>Learning {account ? (learning.length || "") : ""}</button>
            <button data-on={tab === "teaching"} onClick={() => setTab("teaching")}>Teaching {account ? (teaching.length || "") : ""}</button>
          </div>
        </div>

        {!account ? (
          <Empty>Connect your wallet to see your plans.</Empty>
        ) : list.length === 0 ? (
          <Empty>{tab === "learning" ? "No plans yet — open one above to start learning." : "No one is paying you to teach yet."}</Empty>
        ) : (
          <div className="grid-plans">
            {list.map((p) => (
              <PlanCard key={p.id} plan={p} role={tab} busy={activeKey === "p" + p.id} msg={note["p" + p.id]} onMark={onMark} onConfirm={onConfirm} onReject={onReject} onSettle={onSettle} onClose={onClose} />
            ))}
          </div>
        )}
      </section>

      {/* how it works — stepper */}
      <section id="how" style={{ ...wrap, marginTop: "clamp(56px, 7vw, 88px)" }}>
        <h2 className="display" style={{ fontSize: "clamp(26px, 3.6vw, 42px)", maxWidth: 640, marginBottom: 30 }}>
          Money that waits until the lesson&apos;s done
        </h2>
        <div className="steps">
          {[
            ["01", "Escrow the course", "Pick a tutor, a subject and a price per lesson. The full amount locks in the contract — visible to both of you, held by neither."],
            ["02", "Take the lesson", "Meet on your usual video call. Afterwards the tutor marks the lesson done with one tap."],
            ["03", "Confirm to pay", "You confirm it happened and exactly one lesson's USDC lands with the tutor, instantly. Didn't happen? Reject it."],
            ["04", "Or it settles itself", "Go quiet and, after the window, anyone — a keeper or an agent — can settle the marked lesson so your tutor isn't left unpaid."],
          ].map(([n, t, d]) => (
            <div key={n} className="step">
              <div className="mono cyan-ink" style={{ fontSize: 13, marginBottom: 14, letterSpacing: "0.1em" }}>{n}</div>
              <div className="display" style={{ fontSize: 20, marginBottom: 8 }}>{t}</div>
              <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--muted)" }}>{d}</div>
            </div>
          ))}
        </div>
        <div className="panel" style={{ padding: "20px 24px", marginTop: 26, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <span className="mono cyan-ink" style={{ fontSize: 14, flex: "0 0 auto" }}>{"{ why arc }"}</span>
          <span style={{ fontSize: 14.5, color: "var(--ink-2)", flex: 1, minWidth: 240 }}>
            USDC is the native gas, so a lesson can cost a few dollars and clear in under a second — and the
            settle step is an open call any agent can run. Real payments for real lessons, no platform in the middle.
          </span>
        </div>
      </section>

      {/* footer */}
      <footer style={{ ...wrap, marginTop: "clamp(48px, 6vw, 72px)" }}>
        <div className="dimline" style={{ marginBottom: 22 }}>
          <span className="dimline__cap" />
          <span className="dimline__rule" />
          <span className="label" style={{ flex: "0 0 auto" }}>ARC Testnet · Native USDC</span>
          <span className="dimline__rule" />
          <span className="dimline__cap" />
        </div>
        <div style={{ paddingBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <span className="display" style={{ fontSize: 20 }}>Tutor<span style={{ color: "var(--cyan)" }}>Stake</span></span>
          {hasContract() && (
            <a href={`${ARCSCAN}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="mono" style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none" }}>
              Contract {shortAddr(CONTRACT_ADDRESS, 8, 6)} ↗
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}

function escrowTotal(price: string, sessions: string): bigint {
  try {
    const p = price.trim();
    const n = Number(sessions);
    if (!/^\d+(\.\d{1,2})?$/.test(p) || !Number.isInteger(n) || n < 1) return 0n;
    return ethers.parseEther(p) * BigInt(n);
  } catch {
    return 0n;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 50, textAlign: "center" }}>
      <span style={{ color: "var(--muted)", fontSize: 15 }}>{children}</span>
    </div>
  );
}
