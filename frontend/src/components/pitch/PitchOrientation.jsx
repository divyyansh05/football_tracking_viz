// Renders inside PitchSVG as SVG elements
// Shows attacking direction arrows at each end

export default function PitchOrientation({
  homeTeamName, awayTeamName,
  homeColor, awayColor,
  pitchLength = 105, pitchWidth = 68
}) {
  const shortHome = homeTeamName?.split(' ').pop() || 'Home'
  const shortAway = awayTeamName?.split(' ').pop() || 'Away'

  return (
    <g className="pitch-orientation">
      {/* Home team attacks RIGHT (positive x direction) */}
      {/* Label at left end (home defending) */}
      <g transform={`translate(1, ${pitchWidth/2})`}>
        <rect x="-0.5" y="-3.5" width={shortHome.length * 1.2 + 1}
              height="7" rx="0.5"
              fill={homeColor} opacity="0.85" />
        <text x="0.5" y="1.2" fontSize="2.2" fill="white"
              fontWeight="bold" fontFamily="system-ui">
          {shortHome}
        </text>
        {/* Arrow pointing right (attacking direction) */}
        <text x={shortHome.length * 1.2 + 1.5} y="1.2"
              fontSize="2.5" fill={homeColor}>→</text>
      </g>

      {/* Away team attacks LEFT (negative x direction) */}
      {/* Label at right end (away defending) */}
      <g transform={`translate(${pitchLength - 1}, ${pitchWidth/2})`}>
        <rect x={-(shortAway.length * 1.2 + 1)}
              y="-3.5" width={shortAway.length * 1.2 + 1}
              height="7" rx="0.5"
              fill={awayColor} opacity="0.85" />
        <text x={-(shortAway.length * 1.2 + 0.5)}
              y="1.2" fontSize="2.2" fill="white"
              fontWeight="bold" fontFamily="system-ui">
          {shortAway}
        </text>
        {/* Arrow pointing left (attacking direction) */}
        <text x={-(shortAway.length * 1.2 + 2.5)}
              y="1.2" fontSize="2.5" fill={awayColor}>←</text>
      </g>
    </g>
  )
}
