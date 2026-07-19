// MediSync brand mark — medical cross formed by two interlocking
// ribbon rings (navy→blue vertical, sky→teal horizontal), matching
// the clinic wall logo. Used on every page (sidebar, login, favicon).
const Logo = ({ size = 32, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="MediSync"
  >
    <defs>
      <linearGradient id="mslgV" x1="32" y1="8" x2="32" y2="56" gradientUnits="userSpaceOnUse">
        <stop stopColor="#1E3A8A" />
        <stop offset="1" stopColor="#3B82F6" />
      </linearGradient>
      <linearGradient id="mslgH" x1="8" y1="32" x2="56" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#38BDF8" />
        <stop offset="1" stopColor="#2DD4BF" />
      </linearGradient>
    </defs>
    {/* vertical ribbon ring */}
    <rect x="23" y="9" width="18" height="46" rx="9" stroke="url(#mslgV)" strokeWidth="7.5" />
    {/* horizontal ribbon ring, slightly translucent so the overlap reads as interlocked ribbon */}
    <rect x="9" y="23" width="46" height="18" rx="9" stroke="url(#mslgH)" strokeWidth="7.5" strokeOpacity="0.9" />
  </svg>
);

export default Logo;
