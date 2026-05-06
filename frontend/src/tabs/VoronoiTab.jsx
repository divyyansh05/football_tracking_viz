import { useState, useEffect } from 'react'
import { useMatchStore } from '../store/matchStore'
import { api } from '../api/client'
import PitchSVG from '../components/pitch/PitchSVG'
import PlayerDot from '../components/pitch/PlayerDot'
import VoronoiOverlay from '../components/pitch/VoronoiOverlay'
import FrameControls from '../components/controls/FrameControls'
import LabelToggle from '../components/controls/LabelToggle'
import Spinner from '../components/ui/Spinner'

export default function VoronoiTab() {
  const { matchId, currentFrame, frameData, metadata, labelMode } = useMatchStore()
  const [voronoiData, setVoronoiData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showLines, setShowLines] = useState(true)

  useEffect(() => {
    if (!matchId || !currentFrame) return

    const fetchVoronoi = async () => {
      setLoading(true)
      try {
        const data = await api.getVoronoi(matchId, currentFrame)
        setVoronoiData(data)
      } catch (err) {
        console.error('Failed to fetch Voronoi:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchVoronoi()
  }, [matchId, currentFrame])

  if (!metadata || !frameData) {
    return <div className="voronoi-tab">Loading...</div>
  }

  return (
    <div className="voronoi-tab">
      <div className="tab-options">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showLines}
            onChange={() => setShowLines(!showLines)}
          />
          Show region borders
        </label>
        <LabelToggle />
      </div>

      <div className="pitch-container">
        {loading && (
          <div className="pitch-loading-overlay">
            <Spinner />
          </div>
        )}

        <PitchSVG>
          {voronoiData && (
            <VoronoiOverlay
              voronoiData={voronoiData}
              homeColor={metadata.home_team.jersey_color}
              awayColor={metadata.away_team.jersey_color}
              showLines={showLines}
            />
          )}

          {/* Player dots on top */}
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

          {/* Ball */}
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

      {voronoiData && (
        <div className="control-summary">
          <h3>Territory Control</h3>
          <div className="team-control-bar">
            <div
              className="control-segment home"
              style={{
                width: `${voronoiData.summary.home_pct}%`,
                backgroundColor: metadata.home_team.jersey_color
              }}
            >
              <span className="control-label">
                {metadata.home_team.short_name}: {voronoiData.summary.home_pct.toFixed(1)}%
              </span>
            </div>
            <div
              className="control-segment away"
              style={{
                width: `${voronoiData.summary.away_pct}%`,
                backgroundColor: metadata.away_team.jersey_color
              }}
            >
              <span className="control-label">
                {metadata.away_team.short_name}: {voronoiData.summary.away_pct.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
