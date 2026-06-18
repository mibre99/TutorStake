"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import Header from "@/components/Header";
import PlanCard from "@/components/PlanCard";
import Honeycomb from "@/components/Honeycomb";
import HeroSeal from "@/components/HeroSeal";
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
  const wrap: React.CSSProperties = { maxWidth: 1180, margin: "0 auto", padding: "0 28px" };
  const list = tab === "learning" ? learning : teaching;

  const coin = (s: number, key: string) => (
    <svg key={key} width={s} height={s} viewBox="0 0 60 60" fill="none">
      <circle cx="30" cy="30" r="27" fill="#1a1207" stroke="#e6b54a" strokeWidth="2.5" />
      <circle cx="30" cy="30" r="21" fill="none" stroke="#a9781f" strokeWidth="1" />
      <path d="M30 18 L31.8 25 L39 25 L33.2 29.3 L35.4 36.2 L30 32 L24.6 36.2 L26.8 29.3 L21 25 L28.2 25 Z" fill="#e6b54a" />
    </svg>
  );

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 90 }}>
      <Header account={account} balance={balance} chainOk={chainOk} connecting={connecting} onConnect={connect} onDisconnect={disconnect} />

      {/* ── hero ── */}
      <section style={{ position: "relative", overflow: "hidden", paddingTop: "clamp(18px, 3vw, 34px)", paddingBottom: "clamp(28px, 4vw, 50px)" }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "78%", zIndex: 0, pointerEvents: "none" }}>
          <Honeycomb style={{ position: "absolute", inset: 0 }} />
        </div>
        <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", background: "radial-gradient(58% 62% at 50% 40%, rgba(17,10,3,0.94) 0%, rgba(17,10,3,0.7) 46%, rgba(17,10,3,0) 78%)" }} />

        <div style={{ ...wrap, position: "relative", zIndex: 1 }} className="rise">
          <div style={{ textAlign: "center" }}>
            <span className="chip"><span className="dot live" style={{ background: "var(--gold)" }} /> Agentic, USDC-native escrow · ARC testnet</span>
          </div>

          <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "clamp(2px, 1.5vw, 18px)", marginTop: "clamp(6px, 1.5vw, 14px)" }}>
            <div className="hc-l" style={{ textAlign: "right" }}>
              <span className="script" style={{ fontSize: "clamp(58px, 9vw, 132px)" }}>Pay&nbsp;per</span>
            </div>
            <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
              <div className="hc-coin floaty" style={{ position: "absolute", left: -30, bottom: 14, zIndex: 0, animationDelay: "0.8s" }}>{coin(74, "l")}</div>
              <div className="hc-coin floaty" style={{ position: "absolute", right: -26, bottom: 44, zIndex: 0, animationDelay: "1.6s" }}>{coin(58, "r")}</div>
              <div className="floaty" style={{ position: "relative", zIndex: 1, width: "clamp(196px, 31vw, 306px)" }}><HeroSeal /></div>
            </div>
            <div className="hc-r" style={{ textAlign: "left" }}>
              <span className="script" style={{ fontSize: "clamp(58px, 9vw, 132px)" }}>lesson.</span>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: "clamp(8px, 1.5vw, 16px)" }}>
            <p className="caps" style={{ color: "var(--muted)", fontSize: 12.5, letterSpacing: "0.2em", maxWidth: 580, margin: "0 auto", lineHeight: 2 }}>
              Escrow a course of lessons in native USDC — released, trusted, one lesson at a time
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 26, flexWrap: "wrap" }}>
              <a href="#open" className="btn btn--gold btn--lg">Open a plan</a>
              <a href="#how" className="btn btn--outline btn--lg">How it works</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── built on strip ── */}
      <section style={{ ...wrap, marginTop: "clamp(10px, 2vw, 26px)" }}>
        <div style={{ textAlign: "center" }}>
          <span className="label" style={{ color: "var(--faint)" }}>Settles on</span>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "clamp(22px, 4vw, 54px)", marginTop: 16, opacity: 0.92 }}>
            {["USDC", "ARC", "Circle", "On-chain", "Sub-second", "No platform"].map((m) => (
              <span key={m} className="caps" style={{ fontSize: 15, color: "var(--muted)", letterSpacing: "0.16em" }}>{m}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── the lesson ledger ── */}
      <section style={{ ...wrap, marginTop: "clamp(56px, 8vw, 96px)" }}>
        <h2 className="caps" style={{ textAlign: "center", fontSize: "clamp(30px, 5vw, 56px)", fontWeight: 600, color: "var(--cream)", letterSpacing: "0.04em", marginBottom: "clamp(28px, 4vw, 44px)" }}>
          The Lesson <span className="gold-text">Ledger</span>
        </h2>

        <div className="ledger-wrap">
          <div className="ledger">
            <div className="lhead">
              <span className="label" style={{ color: "var(--gold-light)" }}>Read straight off the contract</span>
              <span className="lpips">{[0, 1, 2, 3, 4].map((i) => <span key={i} className={i < 3 ? "lp lp--on" : "lp"} />)}</span>
            </div>
            <div className="lcell">
              <div className="num" style={{ fontSize: "clamp(34px, 5vw, 50px)", color: "var(--cream)" }}>{stats.plans}</div>
              <div className="label" style={{ marginTop: 7 }}>Plans opened</div>
            </div>
            <div className="lcell">
              <div className="num" style={{ fontSize: "clamp(34px, 5vw, 50px)", color: "var(--cream)" }}>{stats.sessions}</div>
              <div className="label" style={{ marginTop: 7 }}>Lessons settled</div>
            </div>
            <div className="lcell lcell--gold">
              <div className="num gold-text" style={{ fontSize: "clamp(30px, 4.6vw, 44px)", overflowWrap: "anywhere", lineHeight: 1.06 }}>${fmtUsdc(stats.released)}</div>
              <div className="label" style={{ marginTop: 8, color: "var(--gold-deep)" }}>Paid to tutors</div>
            </div>
            <div className="lcell">
              <div className="num" style={{ fontSize: "clamp(30px, 4.6vw, 44px)", overflowWrap: "anywhere", lineHeight: 1.06, color: "var(--cream)" }}>${fmtUsdc(locked < 0n ? 0n : locked)}</div>
              <div className="label" style={{ marginTop: 8 }}>In escrow now</div>
            </div>
          </div>
          <aside>
            <div className="serif" style={{ fontSize: "clamp(26px, 3vw, 40px)", lineHeight: 1.18, color: "var(--cream)" }}>
              Real money, held in the open — <span className="gold-text" style={{ fontStyle: "italic" }}>released</span> a lesson at a time.
            </div>
            <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.65, marginTop: 16, maxWidth: 380 }}>
              Nothing sits in a company account. The escrow itself is the bookkeeper, and every figure here is
              read live from the chain.
            </p>
          </aside>
        </div>
      </section>

      {/* ── open a plan ── */}
      <section id="open" style={{ ...wrap, marginTop: "clamp(48px, 6vw, 72px)" }}>
        <div className="panel gild" style={{ padding: "clamp(24px, 3vw, 38px)" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
            <div>
              <div className="label" style={{ marginBottom: 9, color: "var(--gold)" }}>✦ &nbsp;New plan</div>
              <h2 className="serif" style={{ fontSize: "clamp(30px, 4vw, 46px)", color: "var(--cream)" }}>Open a plan</h2>
            </div>
            {account && <span className="num" style={{ fontSize: 13.5, color: "var(--muted)" }}>Earned <span className="gold-text">${fmtUsdc(earned)}</span> teaching</span>}
          </div>

          {!account ? (
            <div style={{ padding: "22px 0 8px", textAlign: "center" }}>
              <p style={{ color: "var(--muted)", fontSize: 15.5, marginBottom: 18 }}>Connect your wallet to escrow a course of lessons.</p>
              <button onClick={connect} className="btn btn--gold">Connect wallet</button>
            </div>
          ) : (
            <>
              <Field label="Tutor's wallet address">
                <input value={tutor} onChange={(e) => setTutor(e.target.value)} className="input" placeholder="0x… your tutor's address" />
              </Field>
              <div className="form-row" style={{ marginTop: 14 }}>
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 22, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>Escrow total</div>
                  <div className="num gold-text" style={{ fontSize: 28 }}>${fmtUsdc(escrowTotal(price, sessions))} <span style={{ fontSize: 14, color: "var(--muted)" }}>= ${price || "0"} × {sessions || "0"}</span></div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  {openMsg && <span className="num" style={{ fontSize: 13, color: openMsg.startsWith("✓") ? "var(--good)" : openMsg.startsWith("✗") ? "var(--bad)" : "var(--muted)" }}>{openMsg}</span>}
                  <button onClick={openPlan} disabled={activeKey === "open"} className="btn btn--gold btn--lg">
                    {activeKey === "open" ? "Opening…" : "Fund & open the plan"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── your lessons ── */}
      <section style={{ ...wrap, marginTop: "clamp(48px, 6vw, 72px)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 22 }}>
          <h2 className="serif" style={{ fontSize: "clamp(30px, 4vw, 46px)", color: "var(--cream)" }}>Your lessons</h2>
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

      {/* ── how it works ── */}
      <section id="how" style={{ ...wrap, marginTop: "clamp(60px, 8vw, 96px)" }}>
        <h2 className="serif" style={{ fontSize: "clamp(30px, 4.4vw, 50px)", maxWidth: 680, marginBottom: 32, color: "var(--cream)" }}>
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
              <div className="num gold-text" style={{ fontSize: 22, marginBottom: 14 }}>{n}</div>
              <div className="serif" style={{ fontSize: 22, marginBottom: 9, color: "var(--cream)" }}>{t}</div>
              <div style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--muted)" }}>{d}</div>
            </div>
          ))}
        </div>
        <div id="why" className="panel gild" style={{ padding: "22px 26px", marginTop: 30, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <span className="caps gold-text" style={{ fontSize: 13, flex: "0 0 auto" }}>✦ &nbsp;Why ARC</span>
          <span style={{ fontSize: 15, color: "var(--ink)", flex: 1, minWidth: 240, lineHeight: 1.6 }}>
            On ARC, USDC is the native gas — a lesson clears in under a second for cents. And settling a finished
            lesson is a permissionless on-chain call, so a <b className="gold-text" style={{ fontWeight: 500 }}>software agent can run the payout
            autonomously</b> — no platform, no human in the loop. Agentic, stablecoin-native payments for real lessons.
          </span>
        </div>
      </section>

      {/* ── footer ── */}
      <footer style={{ ...wrap, marginTop: "clamp(54px, 7vw, 84px)" }}>
        <div className="rule" style={{ background: "var(--line-2)" }} />
        <div style={{ paddingTop: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span className="serif" style={{ fontSize: 22, color: "var(--cream)" }}>Tutor<span className="gold-text" style={{ fontStyle: "italic" }}>Stake</span></span>
            <span className="label" style={{ color: "var(--faint)" }}>· Native USDC on ARC</span>
          </div>
          {hasContract() && (
            <a href={`${ARCSCAN}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="num" style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none", letterSpacing: "0.03em" }}>
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
      <div className="label" style={{ marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 54, textAlign: "center" }}>
      <span style={{ color: "var(--muted)", fontSize: 15 }}>{children}</span>
    </div>
  );
}
