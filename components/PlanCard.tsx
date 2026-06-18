"use client";

import { Plan, fmtUsdc, shortAddr, timeAgo, canSettle, settleIn, ACTIVE, CLOSED } from "@/lib/tutorstake";
import { ARCSCAN } from "@/lib/arcNetwork";
import LessonTracker from "./LessonTracker";

interface Props {
  plan: Plan;
  role: "learning" | "teaching";
  busy: boolean;
  msg?: string;
  onMark: (id: number) => void;
  onConfirm: (id: number) => void;
  onReject: (id: number) => void;
  onSettle: (id: number) => void;
  onClose: (id: number) => void;
}

export default function PlanCard({ plan, role, busy, msg, onMark, onConfirm, onReject, onSettle, onClose }: Props) {
  const { sessions, paid, pending, price, status } = plan;
  const released = price * BigInt(paid);
  const remaining = price * BigInt(sessions - paid);
  const complete = paid >= sessions;
  const settleable = canSettle(plan);
  const into = settleIn(plan);
  const other = role === "learning" ? plan.tutor : plan.student;

  const statusChip = status === CLOSED
    ? complete ? <span className="chip">Completed</span> : <span className="chip chip--plain">Closed</span>
    : pending === 1 ? <span className="chip">Lesson {paid + 1} pending</span>
    : <span className="chip chip--green"><span className="dot" style={{ background: "var(--good)" }} /> Active</span>;

  return (
    <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 15 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="serif" style={{ fontSize: 25, color: "var(--cream)", lineHeight: 1.1 }}>{plan.subject}</div>
          <a href={`${ARCSCAN}/address/${other}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none" }}>
            {role === "learning" ? "tutor " : "student "}{shortAddr(other)} · {timeAgo(plan.createdAt)}
          </a>
        </div>
        {statusChip}
      </div>

      {/* honeycomb tracker */}
      <LessonTracker sessions={sessions} paid={paid} pending={pending} />

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: 13 }}>
        <span><b className="num gold-text" style={{ fontSize: 15 }}>{paid}/{sessions}</b> lessons</span>
        <span className="num" style={{ color: "var(--ink)" }}>${fmtUsdc(price)} <span style={{ color: "var(--muted)", fontFamily: "Outfit" }}>/ lesson</span></span>
        <span><b className="num gold-text" style={{ fontSize: 15 }}>${fmtUsdc(released)}</b> released</span>
      </div>

      {status === ACTIVE && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {role === "learning" ? (
            pending === 1 ? (
              <>
                <div style={{ fontSize: 13.5, color: "var(--ink)" }}>The tutor marked lesson {paid + 1} done. Confirm to release <b className="gold-text num">${fmtUsdc(price)}</b> — or cancel it for a refund.</div>
                <div style={{ display: "flex", gap: 9 }}>
                  <button onClick={() => onConfirm(plan.id)} disabled={busy} className="btn btn--gold btn--sm" style={{ flex: 1 }}>{busy ? "…" : `Confirm · $${fmtUsdc(price)}`}</button>
                  <button onClick={() => onReject(plan.id)} disabled={busy} className="btn btn--ghost btn--sm" title="Cancel this lesson and refund it">Didn&apos;t happen</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13.5, color: "var(--muted)" }}>Waiting for the tutor to mark the next lesson. <b className="num" style={{ color: "var(--cream)" }}>${fmtUsdc(remaining)}</b> still escrowed.</div>
                <button onClick={() => onClose(plan.id)} disabled={busy} className="btn btn--outline btn--sm">{busy ? "…" : `Close & refund $${fmtUsdc(remaining)}`}</button>
              </>
            )
          ) : pending === 1 ? (
            <>
              <div style={{ fontSize: 13.5, color: "var(--muted)" }}>Lesson {paid + 1} is awaiting the student&apos;s confirmation{into ? ` · settles in ${into}` : settleable ? "" : " · any moment now"}.</div>
              {settleable && <button onClick={() => onSettle(plan.id)} disabled={busy} className="btn btn--gold btn--sm">{busy ? "…" : `Settle now · claim $${fmtUsdc(price)}`}</button>}
            </>
          ) : (
            <button onClick={() => onMark(plan.id)} disabled={busy} className="btn btn--outline btn--sm">{busy ? "…" : `Mark lesson ${paid + 1} done`}</button>
          )}
        </div>
      )}

      {msg && (
        <div className="num" style={{ fontSize: 12.5, letterSpacing: "0.02em", color: msg.startsWith("✓") ? "var(--good)" : msg.startsWith("✗") ? "var(--bad)" : "var(--muted)" }}>{msg}</div>
      )}
    </div>
  );
}
