export default function PitchSVG({ children }) {
  return (
    <div style={{
      width: '100%',
      paddingBottom: '64.76%',
      position: 'relative'
    }}>
      <svg
        viewBox="0 0 105 68"
        preserveAspectRatio="xMidYMid meet"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
      >
        {/* Background */}
        <rect x="0" y="0" width="105" height="68" fill="#3a7d2c" />

        {/* Outer boundary */}
        <rect x="0" y="0" width="105" height="68"
          fill="none" stroke="#888888" strokeWidth="0.3" />

        {/* Halfway line */}
        <line x1="52.5" y1="0" x2="52.5" y2="68"
          stroke="#888888" strokeWidth="0.3" />

        {/* Center circle */}
        <circle cx="52.5" cy="34" r="9.15"
          fill="none" stroke="#888888" strokeWidth="0.3" />

        {/* Center spot */}
        <circle cx="52.5" cy="34" r="0.3" fill="#888888" />

        {/* Left penalty area */}
        <rect x="0" y="13.84" width="16.5" height="40.32"
          fill="none" stroke="#888888" strokeWidth="0.3" />

        {/* Right penalty area */}
        <rect x="88.5" y="13.84" width="16.5" height="40.32"
          fill="none" stroke="#888888" strokeWidth="0.3" />

        {/* Left goal area */}
        <rect x="0" y="24.84" width="5.5" height="18.32"
          fill="none" stroke="#888888" strokeWidth="0.3" />

        {/* Right goal area */}
        <rect x="99.5" y="24.84" width="5.5" height="18.32"
          fill="none" stroke="#888888" strokeWidth="0.3" />

        {/* Left penalty spot */}
        <circle cx="11" cy="34" r="0.3" fill="#888888" />

        {/* Right penalty spot */}
        <circle cx="94" cy="34" r="0.3" fill="#888888" />

        {/* Left goal */}
        <rect x="-2" y="30.34" width="2" height="7.32"
          stroke="#ffffff" strokeWidth="0.2" fill="rgba(255,255,255,0.1)" />

        {/* Right goal */}
        <rect x="105" y="30.34" width="2" height="7.32"
          stroke="#ffffff" strokeWidth="0.2" fill="rgba(255,255,255,0.1)" />

        {/* Left penalty arc */}
        <path
          d="M 11 24.85 A 9.15 9.15 0 0 1 11 43.15"
          fill="none" stroke="#888888" strokeWidth="0.3" />

        {/* Right penalty arc */}
        <path
          d="M 94 43.15 A 9.15 9.15 0 0 1 94 24.85"
          fill="none" stroke="#888888" strokeWidth="0.3" />

        {/* Corner arcs */}
        {/* Top-left */}
        <path d="M 0 1 A 1 1 0 0 1 1 0"
          fill="none" stroke="#888888" strokeWidth="0.3" />

        {/* Top-right */}
        <path d="M 104 0 A 1 1 0 0 1 105 1"
          fill="none" stroke="#888888" strokeWidth="0.3" />

        {/* Bottom-left */}
        <path d="M 1 68 A 1 1 0 0 1 0 67"
          fill="none" stroke="#888888" strokeWidth="0.3" />

        {/* Bottom-right */}
        <path d="M 105 67 A 1 1 0 0 1 104 68"
          fill="none" stroke="#888888" strokeWidth="0.3" />

        {/* Children (players, ball, overlays) */}
        {children}
      </svg>
    </div>
  )
}
