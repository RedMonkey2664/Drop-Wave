/**
 * MonogramLogo — the editorial brand mark for the "Structured" restyle: a circled "D"
 * monogram, thin monoline stroke, no fill or decoration (mirrors the system's circled-
 * "S" logo). Inherits `currentColor`, so it sits in ink on light sections and paper on
 * dark ones.
 */

export function MonogramLogo({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="DropWave logo"
    >
      <circle cx="16" cy="16" r="15" stroke="currentColor" strokeWidth="1.4" />
      {/* serif-ish capital D */}
      <path
        d="M12 9.5h4.4c3.4 0 5.6 2.6 5.6 6.5s-2.2 6.5-5.6 6.5H12V9.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M12 9.5v13" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
