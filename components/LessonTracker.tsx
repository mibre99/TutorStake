// The motif: a honeycomb of lessons. Paid = filled gold cell, awaiting-confirm =
// glowing cell, still-escrowed = empty comb cell.
export default function LessonTracker({
  sessions,
  paid,
  pending,
}: {
  sessions: number;
  paid: number;
  pending: number;
}) {
  const WINDOW = 36;
  const start = sessions <= WINDOW ? 0 : Math.max(0, Math.min(sessions - WINDOW, paid - 6));
  const end = Math.min(sessions, start + WINDOW);

  return (
    <div className="combrow">
      {start > 0 && <span className="cell-more">+{start}</span>}
      {Array.from({ length: end - start }).map((_, k) => {
        const i = start + k;
        const cls = i < paid ? "cell cell--on" : i === paid && pending === 1 ? "cell cell--pending" : "cell";
        return <span key={i} className={cls}><span>{i < paid ? "✦" : i + 1}</span></span>;
      })}
      {end < sessions && <span className="cell-more">+{sessions - end}</span>}
    </div>
  );
}
