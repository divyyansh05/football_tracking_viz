export default function VoronoiOverlay({ voronoiData, homeColor, awayColor, showLines }) {
  if (!voronoiData || !voronoiData.regions) return null

  return (
    <g className="voronoi-overlay">
      {voronoiData.regions.map((region) => {
        // Convert polygon array to SVG path string
        if (!region.polygon || region.polygon.length === 0) return null

        const pathData = region.polygon
          .map((point, idx) => {
            const [x, y] = point
            return idx === 0 ? `M ${x},${y}` : `L ${x},${y}`
          })
          .join(' ') + ' Z'

        const fillColor = region.team === 'home' ? homeColor : awayColor
        const fillOpacity = 0.35

        return (
          <path
            key={region.player_id}
            d={pathData}
            fill={fillColor}
            fillOpacity={fillOpacity}
            stroke={showLines ? 'rgba(255,255,255,0.3)' : 'none'}
            strokeWidth={0.2}
          />
        )
      })}
    </g>
  )
}
