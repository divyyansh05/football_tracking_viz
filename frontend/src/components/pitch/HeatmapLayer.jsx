import React from 'react'

export default function HeatmapLayer({ heatmapData, teamColor }) {
  if (!heatmapData || !heatmapData.heatmap) return null

  const { heatmap, x_grid, y_grid } = heatmapData

  const cellWidth = 105 / Math.max(1, x_grid.length - 1)
  const cellHeight = 68 / Math.max(1, y_grid.length - 1)

  const cells = []

  for (let y = 0; y < y_grid.length; y++) {
    for (let x = 0; x < x_grid.length; x++) {
      const z = heatmap[y][x]
      // Only render cells with meaningful density
      if (z > 0.02) {
        cells.push(
          <rect
            key={`${x}-${y}`}
            x={x_grid[x] - cellWidth / 2}
            y={y_grid[y] - cellHeight / 2}
            width={cellWidth}
            height={cellHeight}
            fill={teamColor || '#4f8ef7'}
            opacity={z * 0.85}
          />
        )
      }
    }
  }

  return <g className="heatmap-layer">{cells}</g>
}
