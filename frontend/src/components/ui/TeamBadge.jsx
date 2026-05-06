export default function TeamBadge({ team }) {
  return (
    <span
      className="team-badge"
      style={{ backgroundColor: team.jersey_color }}
    >
      {team.short_name}
    </span>
  )
}
