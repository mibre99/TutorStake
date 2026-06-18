// Decorative honeycomb field — a tessellation of gold hex outlines that fades
// upward, echoing the warm "golden honey" ground.
export default function Honeycomb({ style }: { style?: React.CSSProperties }) {
  const s = 27;
  const dx = Math.sqrt(3) * s;
  const dy = 1.5 * s;
  const W = 1260;
  const H = 470;
  const rows = Math.ceil(H / dy) + 1;
  const cols = Math.ceil(W / dx) + 1;

  const hex = (cx: number, cy: number) => {
    const pts = [];
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 180) * (60 * k - 90);
      pts.push(`${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)}`);
    }
    return pts.join(" ");
  };

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = c * dx + (r % 2 ? dx / 2 : 0);
      const cy = r * dy;
      const op = Math.max(0, Math.min(0.42, (cy / H) * 0.5 + 0.02)).toFixed(3);
      cells.push(<polygon key={`${r}-${c}`} points={hex(cx, cy)} fill="none" stroke="#caa04a" strokeWidth="1" opacity={op} />);
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMax slice" style={style} aria-hidden="true">
      {cells}
    </svg>
  );
}
