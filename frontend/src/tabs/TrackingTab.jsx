import { useMatchStore } from '../store/matchStore'
import PitchSVG from '../components/pitch/PitchSVG'
import PlayerDot from '../components/pitch/PlayerDot'
import FrameControls from '../components/controls/FrameControls'
import LabelToggle from '../components/controls/LabelToggle'

function StatsTable({ players, metadata }) {
  if (!players || !metadata) return null

  // Filter out ball, sort by speed
  const sortedPlayers = players
    .filter(p => p.player_id !== -1)
    .sort((a, b) => b.speed - a.speed)
    .slice(0, 11)

  return (
    <table className="stats-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Name</th>
          <th>Team</th>
          <th>Speed (km/h)</th>
          <th>Accel (m/s²)</th>
        </tr>
      </thead>
      <tbody>
        {sortedPlayers.map((player, idx) => (
          <tr
            key={player.player_id}
            className={player.team}
          >
            <td>{idx + 1}</td>
            <td>{player.name} {player.last_name}</td>
            <td>{player.team === 'home' ? metadata.home_team.short_name : metadata.away_team.short_name}</td>
            <td>{(player.speed * 3.6).toFixed(1)}</td>
            <td>{player.accel.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function TrackingTab() {
  const { frameData, metadata, labelMode } = useMatchStore()

  if (!frameData || !metadata) {
    return <div className="tracking-tab">Loading...</div>
  }

  const exportFrameCSV = () => {
    const rows = [['Name', 'Team', 'X_m', 'Y_m', 'Speed_kmh', 'Accel']]
    frameData.players.forEach(p => {
      if (p.player_id !== -1) {
        const teamName = p.team === 'home' ? metadata.home_team.short_name : metadata.away_team.short_name
        rows.push([`${p.name} ${p.last_name}`, teamName, p.x_m.toFixed(2), p.y_m.toFixed(2), (p.speed * 3.6).toFixed(2), (p.accel || 0).toFixed(2)])
      }
    })
    const csvString = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csvString], {type: 'text/csv'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `frame_${frameData.frame}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="tracking-tab">
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px' }}>
        <button onClick={exportFrameCSV} style={{ padding: '8px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}>
          📥 Export Frame CSV
        </button>
      </div>
      <div className="tracking-layout">
        <div className="main-col">
          <div className="pitch-container">
            <div className="pitch-header">
              <LabelToggle />
            </div>

            <PitchSVG>
              {frameData.players
                .filter(p => p.player_id !== -1)
                .map(p => (
                  <PlayerDot
                    key={p.player_id}
                    player={p}
                    labelMode={labelMode}
                    homeColor={metadata.home_team.jersey_color}
                    awayColor={metadata.away_team.jersey_color}
                  />
                ))}

              {frameData.ball && (
                <circle
                  cx={frameData.ball.x_m}
                  cy={frameData.ball.y_m}
                  r={0.6}
                  fill="#FFD700"
                  stroke="#333"
                  strokeWidth={0.1}
                />
              )}
            </PitchSVG>
          </div>

          <FrameControls />
        </div>

        <div className="stats-section">
          <h3>Top Players by Speed</h3>
          <StatsTable players={frameData.players} metadata={metadata} />
        </div>
      </div>
    </div>
  )
}
