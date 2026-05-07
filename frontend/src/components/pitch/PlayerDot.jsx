import { fmt, getPlayerDotStyle } from '../../utils/format'

export default function PlayerDot({ player, labelMode, homeColor, awayColor, pitchLength = 105, pitchWidth = 68 }) {
  const jerseyColor = player.team === 'home' ? homeColor : awayColor
  const opacity = player.is_detected ? 1.0 : 0.5
  const dotStyle = getPlayerDotStyle(jerseyColor)

  // Safety clamps - allow 10m margin beyond pitch for realistic out-of-bounds play
  const margin = 10
  const safeX = Math.max(-margin, Math.min(pitchLength + margin, player.x_m))
  const safeY = Math.max(-margin, Math.min(pitchWidth + margin, player.y_m))

  // Log warning if player is significantly out of bounds
  if (player.x_m !== safeX || player.y_m !== safeY) {
    console.warn(
      `Player ${player.name} ${player.last_name} out of bounds: ` +
      `(${player.x_m.toFixed(2)}, ${player.y_m.toFixed(2)}) ` +
      `clamped to (${safeX.toFixed(2)}, ${safeY.toFixed(2)})`
    )
  }

  return (
    <g key={player.player_id}>
      <title>
        {player.name} {player.last_name} | {player.team} | {fmt.speed(player.speed * 3.6)} | {fmt.accel(player.accel)} | {player.position}
      </title>
      <circle
        cx={safeX}
        cy={safeY}
        r={0.9}
        fill={dotStyle.fill}
        stroke={dotStyle.stroke}
        strokeWidth={dotStyle.strokeWidth}
        opacity={opacity}
      />
      {labelMode === 'name' && (
        <text
          x={safeX}
          y={safeY - 1.2}
          textAnchor="middle"
          fontSize={1.2}
          fill={dotStyle.textColor}
          stroke={dotStyle.luminance > 0.5 ? '#333' : '#000'}
          strokeWidth={0.15}
          paintOrder="stroke"
        >
          {player.last_name}
        </text>
      )}

      {labelMode === 'speed' && (
        <text
          x={safeX}
          y={safeY - 1.2}
          textAnchor="middle"
          fontSize={1.0}
          fill={dotStyle.textColor}
          stroke={dotStyle.luminance > 0.5 ? '#333' : '#000'}
          strokeWidth={0.15}
          paintOrder="stroke"
        >
          {fmt.n(player.speed * 3.6, 1)} km/h
        </text>
      )}
    </g>
  )
}
