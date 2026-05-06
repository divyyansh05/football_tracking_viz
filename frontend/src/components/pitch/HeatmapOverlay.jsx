// Color interpolation helper
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 }
}

function lerpColor(color1, color2, t) {
  const c1 = hexToRgb(color1)
  const c2 = hexToRgb(color2)

  const r = Math.round(c1.r + (c2.r - c1.r) * t)
  const g = Math.round(c1.g + (c2.g - c1.g) * t)
  const b = Math.round(c1.b + (c2.b - c1.b) * t)

  return `rgb(${r},${g},${b})`
}

function getControlColor(value, homeColor, awayColor) {
  // value: 0.0 = full away, 0.5 = contested, 1.0 = full home

  if (Math.abs(value - 0.5) < 0.05) {
    // Contested zone: transparent
    return { color: 'rgba(255,255,255,0)', opacity: 0 }
  }

  if (value > 0.5) {
    // Home control
    const t = (value - 0.5) * 2 // Map 0.5-1.0 to 0-1
    const color = lerpColor('#ffffff', homeColor, t)
    return { color, opacity: 0.6 }
  } else {
    // Away control
    const t = (0.5 - value) * 2 // Map 0.5-0.0 to 0-1
    const color = lerpColor('#ffffff', awayColor, t)
    return { color, opacity: 0.6 }
  }
}

export default function HeatmapOverlay({ pitchControlData, homeColor, awayColor }) {
  if (!pitchControlData || !pitchControlData.home_pct) return null

  const { home_pct, x_coords, y_coords } = pitchControlData
  const cells = []

  for (let i = 0; i < home_pct.length; i++) {
    for (let j = 0; j < home_pct[i].length; j++) {
      const value = home_pct[i][j]
      const x = x_coords[j]
      const y = y_coords[i]

      const { color, opacity } = getControlColor(value, homeColor, awayColor)

      if (opacity === 0) continue // Skip contested cells

      cells.push(
        <rect
          key={`${i}-${j}`}
          x={x}
          y={y}
          width={1}
          height={1}
          fill={color}
          opacity={opacity}
        />
      )
    }
  }

  return <g className="heatmap-overlay">{cells}</g>
}
