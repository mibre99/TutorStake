// The hero centerpiece — a grand gilded medallion: a rising coin-sun over an
// open book, ringed with beading and a banner. Original artwork, the brand's crest.
export default function HeroSeal() {
  const f = (n: number) => n.toFixed(2);
  const beads = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return <circle key={i} cx={f(150 + 132 * Math.cos(a))} cy={f(150 + 132 * Math.sin(a))} r="1.5" fill="#e6b54a" opacity="0.85" />;
  });
  const rays = Array.from({ length: 13 }, (_, i) => {
    const a = (Math.PI / 180) * (-150 + i * 25);
    return <line key={i} x1={f(150 + 40 * Math.cos(a))} y1={f(112 + 40 * Math.sin(a))} x2={f(150 + 54 * Math.cos(a))} y2={f(112 + 54 * Math.sin(a))} stroke="#e6b54a" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />;
  });

  return (
    <svg width="100%" viewBox="0 0 300 300" fill="none" style={{ display: "block" }} aria-label="TutorStake crest" role="img">
      <defs>
        <linearGradient id="hs-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbf2d6" />
          <stop offset="0.5" stopColor="#e6b54a" />
          <stop offset="1" stopColor="#a9781f" />
        </linearGradient>
        <radialGradient id="hs-glow" cx="50%" cy="42%" r="60%">
          <stop offset="0" stopColor="#e6b54a" stopOpacity="0.22" />
          <stop offset="1" stopColor="#e6b54a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="150" cy="150" r="150" fill="url(#hs-glow)" />
      <circle cx="150" cy="150" r="140" fill="#150e06" stroke="url(#hs-g)" strokeWidth="3" />
      <circle cx="150" cy="150" r="124" fill="none" stroke="#a9781f" strokeWidth="1" opacity="0.65" />
      {beads}
      {rays}

      {/* rising coin-sun */}
      <circle cx="150" cy="112" r="31" fill="#1a1207" stroke="url(#hs-g)" strokeWidth="3" />
      <circle cx="150" cy="112" r="24" fill="none" stroke="#a9781f" strokeWidth="1" />
      <path d="M150 96 L153.8 107.5 L166 107.5 L156.1 114.6 L159.9 126 L150 119 L140.1 126 L143.9 114.6 L134 107.5 L146.2 107.5 Z" fill="url(#hs-g)" />

      {/* open book */}
      <path d="M150 168 L96 178 L96 212 L150 204 Z" fill="#1a1207" stroke="url(#hs-g)" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M150 168 L204 178 L204 212 L150 204 Z" fill="#1a1207" stroke="url(#hs-g)" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M150 168 V204" stroke="url(#hs-g)" strokeWidth="2.4" />
      <path d="M108 186 L140 181 M108 194 L140 189 M108 202 L140 197 M160 181 L192 186 M160 189 L192 194 M160 197 L192 202" stroke="#a9781f" strokeWidth="1" />

      {/* banner */}
      <path d="M86 224 L214 224 L206 240 L214 256 L86 256 L94 240 Z" fill="#1d1409" stroke="url(#hs-g)" strokeWidth="1.6" strokeLinejoin="round" />
      <text x="150" y="245" textAnchor="middle" fill="#f3e8cf" style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, letterSpacing: "0.28em", fontWeight: 500 }}>USDC · ON ARC</text>
    </svg>
  );
}
