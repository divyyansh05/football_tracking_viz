export default function PitchSVG({ children, pitchLength = 105, pitchWidth = 68 }) {
  // Add 5m margins on all sides to show out-of-bounds play
  const margin = 5
  const viewBoxX = -margin
  const viewBoxY = -margin
  const viewBoxWidth = pitchLength + 2 * margin
  const viewBoxHeight = pitchWidth + 2 * margin

  // Calculate aspect ratio for container
  const aspectRatio = ((pitchWidth + 2 * margin) / (pitchLength + 2 * margin)) * 100

  return (
    <div style={{
      width: '100%',
      paddingBottom: `${aspectRatio}%`,
      position: 'relative'
    }}>
      <svg
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
      >
        <defs>
          {/* Alternating stripe pattern for grass effect */}
          <pattern id="grassStripes" x="0" y="0"
                   width="10" height={pitchWidth}
                   patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="5" height={pitchWidth}
                  fill="#2d6a2d" />
            <rect x="5" y="0" width="5" height={pitchWidth}
                  fill="#265e26" />
          </pattern>
        </defs>

        {/* Grass background with stripes */}
        <rect x="0" y="0"
              width={pitchLength} height={pitchWidth}
              fill="url(#grassStripes)" />

        {/* Outer boundary */}
        <rect x="0" y="0"
              width={pitchLength} height={pitchWidth}
              fill="none" stroke="#ffffff" strokeWidth="0.4" />

        {/* Halfway line */}
        <line x1={pitchLength / 2} y1="0"
              x2={pitchLength / 2} y2={pitchWidth}
              stroke="#ffffff" strokeWidth="0.4" />

        {/* Center circle */}
        <circle cx={pitchLength / 2} cy={pitchWidth / 2}
                r="9.15" fill="none"
                stroke="#ffffff" strokeWidth="0.4" />

        {/* Center spot */}
        <circle cx={pitchLength / 2} cy={pitchWidth / 2}
                r="0.4" fill="#ffffff" />

        {/* Left penalty area: 16.5m deep, 40.32m wide */}
        <rect x="0" y={(pitchWidth - 40.32) / 2}
              width="16.5" height="40.32"
              fill="none" stroke="#ffffff" strokeWidth="0.4" />

        {/* Right penalty area */}
        <rect x={pitchLength - 16.5}
              y={(pitchWidth - 40.32) / 2}
              width="16.5" height="40.32"
              fill="none" stroke="#ffffff" strokeWidth="0.4" />

        {/* Left goal area: 5.5m deep, 18.32m wide */}
        <rect x="0" y={(pitchWidth - 18.32) / 2}
              width="5.5" height="18.32"
              fill="none" stroke="#ffffff" strokeWidth="0.4" />

        {/* Right goal area */}
        <rect x={pitchLength - 5.5}
              y={(pitchWidth - 18.32) / 2}
              width="5.5" height="18.32"
              fill="none" stroke="#ffffff" strokeWidth="0.4" />

        {/* Left penalty spot */}
        <circle cx="11" cy={pitchWidth / 2}
                r="0.35" fill="#ffffff" />

        {/* Right penalty spot */}
        <circle cx={pitchLength - 11} cy={pitchWidth / 2}
                r="0.35" fill="#ffffff" />

        {/* Left penalty arc (D) */}
        <path d={`M 11 ${pitchWidth / 2 - 9.15} A 9.15 9.15 0 0 1 11 ${pitchWidth / 2 + 9.15}`}
              fill="none" stroke="#ffffff" strokeWidth="0.4" />

        {/* Right penalty arc (D) */}
        <path d={`M ${pitchLength - 11} ${pitchWidth / 2 + 9.15} A 9.15 9.15 0 0 1 ${pitchLength - 11} ${pitchWidth / 2 - 9.15}`}
              fill="none" stroke="#ffffff" strokeWidth="0.4" />

        {/* Left goal (behind goal line) */}
        <rect x="-2" y={(pitchWidth - 7.32) / 2}
              width="2" height="7.32"
              fill="rgba(255,255,255,0.15)"
              stroke="#ffffff" strokeWidth="0.4" />

        {/* Right goal */}
        <rect x={pitchLength} y={(pitchWidth - 7.32) / 2}
              width="2" height="7.32"
              fill="rgba(255,255,255,0.15)"
              stroke="#ffffff" strokeWidth="0.4" />

        {/* Corner arcs (r=1) */}
        {/* Top-left */}
        <path d="M 0 1 A 1 1 0 0 0 1 0"
              fill="none" stroke="#ffffff" strokeWidth="0.4" />

        {/* Top-right */}
        <path d={`M ${pitchLength - 1} 0 A 1 1 0 0 0 ${pitchLength} 1`}
              fill="none" stroke="#ffffff" strokeWidth="0.4" />

        {/* Bottom-left */}
        <path d={`M 0 ${pitchWidth - 1} A 1 1 0 0 1 1 ${pitchWidth}`}
              fill="none" stroke="#ffffff" strokeWidth="0.4" />

        {/* Bottom-right */}
        <path d={`M ${pitchLength - 1} ${pitchWidth} A 1 1 0 0 1 ${pitchLength} ${pitchWidth - 1}`}
              fill="none" stroke="#ffffff" strokeWidth="0.4" />

        {/* Children (players, ball, overlays) rendered on top */}
        {children}
      </svg>
    </div>
  )
}
