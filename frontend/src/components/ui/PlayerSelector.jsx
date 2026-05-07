import { useState } from 'react'

export default function PlayerSelector({
  players,
  selectedPlayerId,
  onSelect,
  defaultTeam = 'home',
  homeTeamName,
  awayTeamName,
  homeTeamColor,
  awayTeamColor
}) {
  const [activeTeam, setActiveTeam] = useState(defaultTeam)

  const homePlayers = players.filter(p => p.team === 'home')
  const awayPlayers = players.filter(p => p.team === 'away')
  const filteredPlayers = activeTeam === 'home' ? homePlayers : awayPlayers
  const teamColor = activeTeam === 'home' ? homeTeamColor : awayTeamColor

  return (
    <div className="player-selector">
      {/* Team tabs */}
      <div className="team-tabs">
        <button
          className={`team-tab ${activeTeam === 'home' ? 'active' : ''}`}
          style={activeTeam === 'home'
            ? { borderBottomColor: homeTeamColor, color: 'white' }
            : {}}
          onClick={() => setActiveTeam('home')}>
          {homeTeamName}
        </button>
        <button
          className={`team-tab ${activeTeam === 'away' ? 'active' : ''}`}
          style={activeTeam === 'away'
            ? { borderBottomColor: awayTeamColor, color: 'white' }
            : {}}
          onClick={() => setActiveTeam('away')}>
          {awayTeamName}
        </button>
      </div>

      {/* Player grid */}
      <div className="player-grid">
        {filteredPlayers.map(player => {
          const isSelected = selectedPlayerId === player.player_id
          return (
            <button
              key={player.player_id}
              className={`player-chip ${isSelected ? 'selected' : ''}`}
              style={isSelected
                ? {
                    borderColor: teamColor,
                    backgroundColor: teamColor + '33'
                  }
                : {}}
              onClick={() => onSelect(player.player_id)}>
              <span className="player-number">#{player.number}</span>
              <span className="player-name">{player.last_name}</span>
              <span className="player-position">{player.position}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
