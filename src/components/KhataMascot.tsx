export function KhataMascot({
  worried = false,
  small = false,
}: {
  worried?: boolean;
  small?: boolean;
}) {
  return (
    <svg
      role="img"
      aria-label={worried ? "Khata is worried about dues" : "Happy khata book"}
      viewBox="0 0 100 110"
      className={small ? "h-16 w-16" : "mx-auto mb-4 h-24 w-24"}
    >
      <rect
        x="19"
        y="10"
        width="65"
        height="85"
        rx="13"
        fill="var(--primary)"
        transform="rotate(-7 50 50)"
      />
      <path
        d="M28 13v78M38 27h28"
        stroke="var(--primary-foreground)"
        strokeWidth="4"
        strokeLinecap="round"
        opacity=".5"
      />
      <circle cx="45" cy="48" r="3" fill="var(--primary-foreground)" />
      <circle cx="66" cy="46" r="3" fill="var(--primary-foreground)" />
      <path
        d={worried ? "M46 67q9-12 20-2" : "M45 60q12 16 23-3"}
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M21 61L9 67m73-12 11 8M39 93l-5 10m33-12 7 8"
        stroke="var(--primary)"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}
