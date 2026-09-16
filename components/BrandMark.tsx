export function BrandMark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* beam */}
      <line x1="3.5" y1="5.5" x2="20.5" y2="5.5" />
      {/* hangers */}
      <line x1="5.5" y1="5.5" x2="5.5" y2="11" />
      <line x1="18.5" y1="5.5" x2="18.5" y2="11" />
      {/* pans */}
      <circle cx="5.5" cy="14" r="2.4" />
      <circle cx="18.5" cy="14" r="2.4" />
      {/* stem + base */}
      <line x1="12" y1="5.5" x2="12" y2="17" />
      <line x1="8.5" y1="19.5" x2="15.5" y2="19.5" />
    </svg>
  );
}
