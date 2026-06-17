"use client";

import { Plan, fmtUsdc, shortAddr, timeAgo, canSettle, settleIn, ACTIVE, CLOSED } from "@/lib/tutorstake";
import { ARCSCAN } from "@/lib/arcNetwork";

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
  const total = price * BigInt(sessions);
  const released = price * BigInt(paid);
  const remaining = price * BigInt(sessions - paid);
  const complete = paid >= sessions;
  const settleable = canSettle(plan);
  const into = settleIn(plan);
  const other = role === "learning" ? plan.tutor : plan.student;

  const statusChip = status === CLOSED
    ? complete ? <span className="chip chip--good">Completed</span> : <span className="chip">Closed</span>
    : pending === 1 ? <span className="chip chip--amber">Lesson {paid + 1} pending</span>
    : <span className="chip"><span className="dot" style={{ background: "var(--good)" }} /> Active</span>;

  const WINDOW = 40;
  const pipStart = sessions <= WINDOW ? 0 : Math.max(0, Math.min(sessions - WINDOW, paid - 6));
  const pipEnd = Math.min(sessions, pipStart + WINDOW);

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div className="display" style={{ fontSize: 21 }}>{plan.subject}</div>
          <a href={`${ARCSCAN}/address/${other}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none", fontWeight: 500 }}>
            {role === "learning" ? "with tutor " : "student "}{shortAddr(other)} · {timeAgo(plan.createdAt)}
          </a>
        </div>
        {statusChip}
      </div>

      {/* session pips */}
      <div className="pips">
        {pipStart > 0 && <span style={{ alignSelf: "center", fontSize: 12, color: "var(--muted)" }}>+{pipStart}</span>}
        {Array.from({ length: pipEnd - pipStart }).map((_, k) => {
          const i = pipStart + k;
          const cls = i < paid ? "pip pip--paid" : i === paid && pending === 1 ? "pip pip--pending" : "pip";
          return <span key={i} className={cls}>{i < paid ? "✓" : i + 1}</span>;
        })}
        {pipEnd < sessions && <span style={{ alignSelf: "center", fontSize: 12, color: "var(--muted)" }}>+{sessions - pipEnd}</span>}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: 12 }}>
        <span><b className="num" style={{ color: "var(--ink)" }}>{paid}/{sessions}</b> lessons</span>
        <span>${fmtUsdc(price)} / lesson</span>
        <span><b className="num" style={{ color: "var(--ink)" }}>${fmtUsdc(released)}</b> released</span>
      </div>

      {/* actions */}
      {status === ACTIVE && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {role === "learning" ? (
            pending === 1 ? (
              <>
                <div style={{ fontSize: 13, color: "var(--ink-2)" }}>The tutor marked lesson {paid + 1} done. Confirm to release ${fmtUsdc(price)} — or cancel it for a refund.</div>
                <div style={{ display: "flex", gap: 9 }}>
                  <button onClick={() => onConfirm(plan.id)} disabled={busy} className="btn btn--amber btn--sm" style={{ flex: 1 }}>{busy ? "…" : `Confirm · pay $${fmtUsdc(price)}`}</button>
                  <button onClick={() => onReject(plan.id)} disabled={busy} className="btn btn--ghost btn--sm" title="Cancel this lesson and refund it">Didn&apos;t happen</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>Waiting for the tutor to mark the next lesson. ${fmtUsdc(remaining)} still escrowed.</div>
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
        <div className="num" style={{ fontSize: 12.5, color: msg.startsWith("✓") ? "var(--good)" : msg.startsWith("✗") ? "var(--bad)" : "var(--muted)" }}>{msg}</div>
      )}
    </div>
  );
}
