export default function Logo({ size = 40 }: { size?: number }) {
  // A gilded crest: an open book with a coin rising over the spine, inside a
  // beaded ring — "learn, and earn a lesson at a time." Original artwork.
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="lg-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7e7b2" />
          <stop offset="0.5" stopColor="#e6b54a" />
          <stop offset="1" stopColor="#b07e22" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="none" stroke="url(#lg-gold)" strokeWidth="2" />
      <circle cx="24" cy="24" r="18.6" fill="none" stroke="#b07e22" strokeWidth="0.8" opacity="0.7" />
      {[45, 135, 225, 315].map((a) => {
        const r = 20.4, x = 24 + r * Math.cos((a * Math.PI) / 180), y = 24 + r * Math.sin((a * Math.PI) / 180);
        return <circle key={a} cx={x} cy={y} r="0.9" fill="#e6b54a" />;
      })}
      {/* rising coin */}
      <circle cx="24" cy="17.5" r="5.3" fill="none" stroke="url(#lg-gold)" strokeWidth="1.5" />
      <path d="M24 14.7 L24.8 16.6 L26.8 16.8 L25.3 18.2 L25.8 20.2 L24 19.1 L22.2 20.2 L22.7 18.2 L21.2 16.8 L23.2 16.6 Z" fill="#e6b54a" />
      {/* open book */}
      <path d="M24 25.4 L11.5 27.4 L11.5 33.6 L24 32 Z" fill="#1c1308" stroke="url(#lg-gold)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M24 25.4 L36.5 27.4 L36.5 33.6 L24 32 Z" fill="#1c1308" stroke="url(#lg-gold)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M24 25.4 V32" stroke="url(#lg-gold)" strokeWidth="1.4" />
      <path d="M14.5 29 L21 28.2 M14.5 31 L21 30.4 M27 28.2 L33.5 29 M27 30.4 L33.5 31" stroke="#b07e22" strokeWidth="0.7" />
    </svg>
  );
}
