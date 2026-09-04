export default function ProgressRing({ pct, size = 126 }: { pct: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const strokeW = 11;
  const r = size / 2 - strokeW;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--track)" strokeWidth={strokeW} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#F2B84B"
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset .6s ease" }}
      />
    </svg>
  );
}
