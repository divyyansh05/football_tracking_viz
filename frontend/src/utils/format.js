// Universal number formatting for football analytics

export const fmt = {
  // Speed in km/h — 1 decimal
  speed: (kmh) => kmh == null ? '—' : `${kmh.toFixed(1)} km/h`,

  // Speed in m/s — 2 decimals
  speedMs: (ms) => ms == null ? '—' : `${ms.toFixed(2)} m/s`,

  // Distance in km — 2 decimals
  distanceKm: (km) => km == null ? '—' : `${km.toFixed(2)} km`,

  // Distance in meters — 0 decimals
  distanceM: (m) => m == null ? '—' : `${Math.round(m)} m`,

  // Percentage — 1 decimal
  pct: (p) => p == null ? '—' : `${p.toFixed(1)}%`,

  // Area in m² — 0 decimals
  area: (a) => a == null ? '—' : `${Math.round(a)} m²`,

  // Acceleration — 2 decimals
  accel: (a) => a == null ? '—' : `${a.toFixed(2)} m/s²`,

  // Coordinate — 1 decimal
  coord: (c) => c == null ? '—' : c.toFixed(1),

  // Minutes — 1 decimal
  minutes: (m) => m == null ? '—' : `${m.toFixed(1)} min`,

  // Generic number with N decimals
  n: (val, decimals = 2) => val == null ? '—' : val.toFixed(decimals),

  // Match time display: "10:15.2"
  matchTime: (minutes, seconds, deciseconds) =>
    `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${deciseconds}`,
}

// Check if a hex color is too light for green pitch background
export function getPlayerDotStyle(jerseyColor) {
  // Convert hex to RGB
  const hex = jerseyColor?.replace('#', '') || 'cccccc'
  const r = parseInt(hex.slice(0,2), 16)
  const g = parseInt(hex.slice(2,4), 16)
  const b = parseInt(hex.slice(4,6), 16)

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  if (luminance > 0.75) {
    // Very light jersey — use slightly off-white with dark border
    return {
      fill: '#F0F0F0',
      stroke: '#1a1a1a',
      strokeWidth: 0.35,
      textColor: '#111111',
      luminance
    }
  } else if (luminance > 0.5) {
    // Medium light jersey
    return {
      fill: jerseyColor,
      stroke: '#555555',
      strokeWidth: 0.25,
      textColor: '#ffffff',
      luminance
    }
  } else {
    // Dark jersey — standard white border
    return {
      fill: jerseyColor,
      stroke: '#ffffff',
      strokeWidth: 0.2,
      textColor: '#ffffff',
      luminance
    }
  }
}
