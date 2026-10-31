export interface RingProps {
  /** True ratio 0..1; the fill is the true ratio, never padded. */
  ratio: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

/**
 * Thin plan ring (3–5px stroke): the spent share filled in the one data hue,
 * the total in the centre. A zero has no stub — the track stays empty.
 */
export function Ring({ ratio, size = 96, strokeWidth = 5, label }: RingProps) {
  const clamped = Math.min(1, Math.max(0, ratio));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = clamped * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-rule)"
          strokeWidth={strokeWidth}
        />
        {clamped > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </svg>
      {label ? (
        <span className="absolute tnum text-sm font-semibold text-ink" aria-hidden="true">
          {label}
        </span>
      ) : null}
    </div>
  );
}
