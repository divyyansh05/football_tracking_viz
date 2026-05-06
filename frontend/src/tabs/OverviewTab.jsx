import { useMatchStore } from '../store/matchStore'

export default function OverviewTab() {
  const { metadata } = useMatchStore()

  if (!metadata) {
    return <div className="overview-tab">Loading match data...</div>
  }

  const homePlayers = metadata.players.filter(p => p.team === 'home').sort((a, b) => (a.number || 99) - (b.number || 99))
  const awayPlayers = metadata.players.filter(p => p.team === 'away').sort((a, b) => (a.number || 99) - (b.number || 99))

  return (
    <div className="overview-tab">
      <div className="overview-grid">
        {/* Left column: Match info */}
        <div className="overview-section">
          <div className="match-info-card">
            <div className="scoreline">
              <div className="team-name home">{metadata.home_team.name}</div>
              <div className="score-display">
                {metadata.home_score} — {metadata.away_score}
              </div>
              <div className="team-name away">{metadata.away_team.name}</div>
            </div>

            <div className="match-details">
              <div className="detail-row">
                <span className="label">Date:</span>
                <span className="value">{new Date(metadata.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</span>
              </div>
              <div className="detail-row">
                <span className="label">Stadium:</span>
                <span className="value">{metadata.stadium.name}, {metadata.stadium.city}</span>
              </div>
              <div className="detail-row">
                <span className="label">Competition:</span>
                <span className="value">{metadata.competition}</span>
              </div>
              <div className="detail-row">
                <span className="label">Season:</span>
                <span className="value">{metadata.season}</span>
              </div>
              <div className="detail-row">
                <span className="label">Round:</span>
                <span className="value">{metadata.round}</span>
              </div>
            </div>
          </div>

          {/* Periods table */}
          <div className="periods-card">
            <h3>Match Periods</h3>
            <table className="periods-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Start Frame</th>
                  <th>End Frame</th>
                  <th>Duration (min)</th>
                </tr>
              </thead>
              <tbody>
                {metadata.match_periods.map(period => (
                  <tr key={period.period}>
                    <td>P{period.period}</td>
                    <td>{period.start_frame}</td>
                    <td>{period.end_frame}</td>
                    <td>{period.duration_minutes?.toFixed(1) || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column: Lineups */}
        <div className="overview-section">
          <div className="lineups-container">
            {/* Home lineup */}
            <div className="lineup-card">
              <h3
                className="lineup-header home"
                style={{ backgroundColor: metadata.home_team.jersey_color }}
              >
                {metadata.home_team.name}
              </h3>
              <table className="lineup-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Position</th>
                  </tr>
                </thead>
                <tbody>
                  {homePlayers.map(player => (
                    <tr key={player.id}>
                      <td>{player.number || '—'}</td>
                      <td>{player.name} {player.last_name}</td>
                      <td>{player.position}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Away lineup */}
            <div className="lineup-card">
              <h3
                className="lineup-header away"
                style={{ backgroundColor: metadata.away_team.jersey_color }}
              >
                {metadata.away_team.name}
              </h3>
              <table className="lineup-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Position</th>
                  </tr>
                </thead>
                <tbody>
                  {awayPlayers.map(player => (
                    <tr key={player.id}>
                      <td>{player.number || '—'}</td>
                      <td>{player.name} {player.last_name}</td>
                      <td>{player.position}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
