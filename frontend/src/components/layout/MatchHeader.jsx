import { useMatchStore } from '../../store/matchStore'

export default function MatchHeader() {
  const { metadata } = useMatchStore()

  if (!metadata) {
    return (
      <div className="match-header">
        <div className="header-content">Loading match...</div>
      </div>
    )
  }

  const { home_team, away_team, home_score, away_score, date, stadium, competition } = metadata

  return (
    <div className="match-header">
      <div className="header-content">
        <div className="teams">
          <div className="team home">
            <span
              className="team-chip"
              style={{ backgroundColor: home_team.jersey_color }}
            >
              {home_team.short_name}
            </span>
          </div>

          <div className="score">
            {home_score} - {away_score}
          </div>

          <div className="team away">
            <span
              className="team-chip"
              style={{ backgroundColor: away_team.jersey_color }}
            >
              {away_team.short_name}
            </span>
          </div>
        </div>

        <div className="match-info">
          {competition} | {new Date(date).toLocaleDateString()} | {stadium.name}
        </div>
      </div>
    </div>
  )
}
