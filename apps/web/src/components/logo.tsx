export function BrainMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M12 5.5C9.2 5.5 7 7.6 7 10.2c0 .5.1 1 .2 1.5C5.9 12.5 5 13.9 5 15.5c0 1.3.6 2.5 1.6 3.3-.2.5-.3 1-.3 1.6 0 2.4 2 4.3 4.6 4.3.7 0 1.4-.2 2-.5.5 1.1 1.7 1.8 3.1 1.8V5.9c-1-.3-2.6-.4-4-.4Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M20 5.5c2.8 0 5 2.1 5 4.7 0 .5-.1 1-.2 1.5 1.3.8 2.2 2.2 2.2 3.8 0 1.3-.6 2.5-1.6 3.3.2.5.3 1 .3 1.6 0 2.4-2 4.3-4.6 4.3-.7 0-1.4-.2-2-.5-.5 1.1-1.7 1.8-3.1 1.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M16 6v20M11.5 11.5c1.2.6 2.8.6 4.5.6M20.5 15c-1.4.5-3 .5-4.5.2M12.5 19.5c1.3-.5 2.4-.5 3.5-.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="text-ink">company</span>
      <span className="text-[var(--color-primary)]">brain</span>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <BrainMark size={22} className="text-[var(--color-primary)]" />
      <Wordmark className="font-mono text-[15px] font-semibold tracking-tight" />
    </div>
  );
}
