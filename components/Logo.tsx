export default function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {/* lesson-progress ring */}
      <circle cx="16" cy="16" r="12" stroke="var(--line-2)" strokeWidth="3.4" />
      <circle cx="16" cy="16" r="12" stroke="var(--amber)" strokeWidth="3.4" strokeLinecap="round" strokeDasharray="47 28.4" transform="rotate(-90 16 16)" />
      <circle cx="16" cy="16" r="4.2" fill="var(--ink)" />
    </svg>
  );
}
