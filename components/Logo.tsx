export default function Logo({ size = 30 }: { size?: number }) {
  // A monogram "S" plotted from drafting geometry: two compass arcs whose
  // negative space implies the letterform, a connecting spine, construction
  // ticks, and one amber "release point". No tile, no rounded rect — just linework.
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {/* construction marks */}
      <path d="M21.5 25 H26.5 M24 22.5 V27.5" stroke="var(--muted)" strokeWidth="1" />
      <path d="M14 16 V20 M34 30 V34" stroke="var(--muted)" strokeWidth="1" />
      {/* upper + lower compass arcs */}
      <path d="M14 18 A10 10 0 0 1 34 18" stroke="var(--cyan)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M34 32 A10 10 0 0 1 14 32" stroke="var(--cyan)" strokeWidth="2.4" strokeLinecap="round" />
      {/* spine that resolves the S */}
      <path d="M30 18 L18 32" stroke="var(--cyan)" strokeWidth="1.6" strokeLinecap="round" />
      {/* release point */}
      <circle cx="34" cy="32" r="4.2" fill="var(--amber)" opacity="0.18" />
      <circle cx="34" cy="32" r="1.9" fill="var(--amber)" />
    </svg>
  );
}
