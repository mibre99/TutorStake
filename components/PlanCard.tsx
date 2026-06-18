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
  const partNo = String(plan.id).padStart(2, "0");

  const statusChip = status === CLOSED
    ? complete ? <span className="chip chip--amber">Completed</span> : <span className="chip">Closed</span>
    : pending === 1 ? <span className="chip chip--cyan">Lesson {paid + 1} pending</span>
    : <span className="chip"><span className="dot" style={{ background: "var(--good)" }} /> Active</span>;

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="label" style={{ marginBottom: 5 }}>PLAN-{partNo} · {role === "learning" ? "LEARNING" : "TEACHING"}</div>
          <div className="display" style={{ fontSize: 21 }}>{plan.subject}</div>
          <a href={`${ARCSCAN}/address/${other}`} target="_blank" rel="noopener noreferrer" className="mono" style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none" }}>
            {role === "learning" ? "tutor " : "student "}{shortAddr(other)} · {timeAgo(plan.createdAt)}
          </a>
        </div>
        {statusChip}
      </div>

      {/* the dimension-line lesson tracker */}
      <LessonTracker sessions={sessions} paid={paid} pending={pending} />

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: 12 }}>
        <span><b className="mono cyan-ink">{paid}/{sessions}</b> lessons</span>
        <span className="mono">${fmtUsdc(price)} / lesson</span>
        <span><b className="mono amber-ink">${fmtUsdc(released)}</b> released</span>
      </div>

      {/* actions */}
      {status === ACTIVE && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {role === "learning" ? (
            pending === 1 ? (
              <>
                <div style={{ fontSize: 13, color: "var(--ink-2)" }}>The tutor marked lesson {paid + 1} done. Confirm to release <span className="mono amber-ink">${fmtUsdc(price)}</span> — or cancel it for a refund.</div>
                <div style={{ display: "flex", gap: 9 }}>
                  <button onClick={() => onConfirm(plan.id)} disabled={busy} className="btn btn--amber btn--sm" style={{ flex: 1 }}>{busy ? "…" : `Confirm · pay $${fmtUsdc(price)}`}</button>
                  <button onClick={() => onReject(plan.id)} disabled={busy} className="btn btn--ghost btn--sm" title="Cancel this lesson and refund it">Didn&apos;t happen</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>Waiting for the tutor to mark the next lesson. <span className="mono">${fmtUsdc(remaining)}</span> still escrowed.</div>
                <button onClick={() => onClose(plan.id)} disabled={busy} className="btn btn--ghost btn--sm">{busy ? "…" : `Close & refund $${fmtUsdc(remaining)}`}</button>
              </>
            )
          ) : pending === 1 ? (
            <>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Lesson {paid + 1} is awaiting the student&apos;s confirmation{into ? ` · settles in ${into}` : settleable ? "" : " · any moment now"}.</div>
              {settleable && <button onClick={() => onSettle(plan.id)} disabled={busy} className="btn btn--amber btn--sm">{busy ? "…" : `Settle now · claim $${fmtUsdc(price)}`}</button>}
            </>
          ) : (
            <button onClick={() => onMark(plan.id)} disabled={busy} className="btn btn--ink btn--sm">{busy ? "…" : `Mark lesson ${paid + 1} done`}</button>
          )}
        </div>
      )}

      {msg && (
        <div className="mono" style={{ fontSize: 12.5, color: msg.startsWith("✓") ? "var(--good)" : msg.startsWith("✗") ? "var(--bad)" : "var(--muted)" }}>{msg}</div>
      )}
    </div>
  );
}
