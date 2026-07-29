export type RingSegment = { value: number; colorVar: string };

function polarRotation(startFraction: number) {
  return -90 + startFraction * 360;
}

export function Ring({
  segments,
  size,
  strokeWidth,
  total,
  progress = 1,
  className,
  strokeLinecap = "round",
}: {
  segments: RingSegment[];
  size: number;
  strokeWidth: number;
  total?: number;
  progress?: number;
  className?: string;
  strokeLinecap?: "round" | "butt";
}) {
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const effectiveTotal = total ?? (segments.reduce((sum, s) => sum + s.value, 0) || 1);

  let accum = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-line)"
        strokeWidth={strokeWidth}
      />
      {segments.map((seg, i) => {
        const startFraction = accum / effectiveTotal;
        const segFraction = (seg.value / effectiveTotal) * progress;
        accum += seg.value;
        return (
          <circle
            key={i}
            data-ring-segment
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.colorVar}
            strokeWidth={strokeWidth}
            strokeLinecap={strokeLinecap}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - segFraction)}
            transform={`rotate(${polarRotation(startFraction)} ${size / 2} ${size / 2})`}
          />
        );
      })}
    </svg>
  );
}
