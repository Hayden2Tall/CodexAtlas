interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 32, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="14" fill="#1a365d" />
      {/* Open book */}
      <path
        d="M14 18 C14 18 20 16 32 16 C44 16 50 18 50 18 L50 48 C50 48 44 46 32 46 C20 46 14 48 14 48 Z"
        stroke="#c8a44e"
        strokeWidth="1.8"
        fill="none"
      />
      <line x1="32" y1="16" x2="32" y2="46" stroke="#c8a44e" strokeWidth="1.2" />
      {/* Compass rose */}
      <circle cx="32" cy="31" r="8" stroke="#c8a44e" strokeWidth="1.2" fill="none" />
      {/* N-S line */}
      <line x1="32" y1="22" x2="32" y2="40" stroke="#c8a44e" strokeWidth="1" />
      {/* E-W line */}
      <line x1="23" y1="31" x2="41" y2="31" stroke="#c8a44e" strokeWidth="1" />
      {/* Star points */}
      <polygon
        points="32,23.5 33.5,29 32,25.5 30.5,29"
        fill="#c8a44e"
      />
      <polygon
        points="32,38.5 33.5,33 32,36.5 30.5,33"
        fill="#c8a44e"
      />
      <polygon
        points="24.5,31 30,32.5 26.5,31 30,29.5"
        fill="#c8a44e"
      />
      <polygon
        points="39.5,31 34,32.5 37.5,31 34,29.5"
        fill="#c8a44e"
      />
    </svg>
  );
}

export function LogoMark({ size = 24, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Compass rose only — no background, uses currentColor */}
      <circle cx="32" cy="32" r="16" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="32" y1="14" x2="32" y2="50" stroke="currentColor" strokeWidth="1.5" />
      <line x1="14" y1="32" x2="50" y2="32" stroke="currentColor" strokeWidth="1.5" />
      <polygon points="32,16 34,28 32,20 30,28" fill="currentColor" />
      <polygon points="32,48 34,36 32,44 30,36" fill="currentColor" />
      <polygon points="16,32 28,34 20,32 28,30" fill="currentColor" />
      <polygon points="48,32 36,34 44,32 36,30" fill="currentColor" />
    </svg>
  );
}
