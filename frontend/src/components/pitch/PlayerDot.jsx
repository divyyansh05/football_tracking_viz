function ensureVisibleColor(jerseyColor) {
  const color = (jerseyColor || '').toUpperCase()
  if (color === '#FFFFFF' || color === '#FFF' || color === 'WHITE') {
    return { fill: '#EEEEEE', stroke: '#333333', strokeWidth: 0.25 }
  }
  return { fill: jerseyColor, stroke: 'white', strokeWidth: 0.15 }
}

export default function PlayerDot({ player, labelMode, homeColor, awayColor }) {
  const color = player.team === 'home' ? homeColor : awayColor
  const opacity = player.is_detected ? 1.0 : 0.5
  const { fill, stroke, strokeWidth } = ensureVisibleColor(color)

  return (
    <g key={player.player_id}>
      <title>
        {player.name} {player.last_name} | {player.team} | {(player.speed * 3.6).toFixed(1)} km/h | Accel: {player.accel?.toFixed(2)} m/s² | {player.position}
      </title>
      <circle
        cx={player.x_m}
        cy={player.y_m}
        r={0.9}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
      />      {labelMode === 'name' && (
        <text
          x={player.x_m}
          y={player.y_m - 1.2}
          textAnchor="middle"
          fontSize={1.2}
          fill="white"
          stroke="black"
          strokeWidth={0.15}
          paintOrder="stroke"
        >
          {player.last_name}
        </text>
      )}

      {labelMode === 'speed' && (
        <text
          x={player.x_m}
          y={player.y_m - 1.2}
          textAnchor="middle"
          fontSize={1.0}
          fill="white"
          stroke="black"
          strokeWidth={0.15}
          paintOrder="stroke"
        >
          {(player.speed * 3.6).toFixed(1)} km/h
        </text>
      )}
    </g>
  )
}
