// The signature motif: a draughtsman's segmented dimension line.
// Each lesson is a tick on the line — released = cyan tick + amber release-dot,
// awaiting-confirm = pulsing cyan tick, still-escrowed = faint hollow tick.
export default function LessonTracker({
  sessions,
  paid,
  pending,
  justReleased = -1,
}: {
  sessions: number;
  paid: number;
  pending: number;
  /** index that should play the one-shot "stamp" landing animation */
  justReleased?: number;
}) {
  const WINDOW = 40;
  const start = sessions <= WINDOW ? 0 : Math.max(0, Math.min(sessions - WINDOW, paid - 6));
  const end = Math.min(sessions, start + WINDOW);

  return (
    <div className="track">
      {start > 0 && <span className="seg-spacer">+{start}</span>}
      {Array.from({ length: end - start }).map((_, k) => {
        const i = start + k;
        const released = i < paid;
        const awaiting = i === paid && pending === 1;
        return (
          <span key={i} className="seg">
            <span className={awaiting ? "tk tk--pulse" : released ? "tk tk--on" : "tk"} />
            {released && (
              <span className={i === justReleased ? "release-dot release-dot--stamp" : "release-dot"} />
            )}
          </span>
        );
      })}
      {end < sessions && <span className="seg-spacer">+{sessions - end}</span>}
    </div>
  );
}
