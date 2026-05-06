import { useState, useEffect } from 'react'
import { useMatchStore } from '../store/matchStore'
import { api } from '../api/client'
import PitchSVG from '../components/pitch/PitchSVG'
import PlayerDot from '../components/pitch/PlayerDot'
import HeatmapOverlay from '../components/pitch/HeatmapOverlay'
import FrameControls from '../components/controls/FrameControls'
import Spinner from '../components/ui/Spinner'

export default function PitchControlTab() {
  const { matchId, currentFrame, frameData, metadata, labelMode } = useMatchStore()
  const [pitchControlData, setPitchControlData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!matchId || !currentFrame) return

    // Debounce: wait 300ms after frame stops changing
    const timer = setTimeout(() => {
      const fetchPitchControl = async () => {
        setLoading(true)
        try {
          const data = await api.getPitchControl(matchId, currentFrame)
          setPitchControlData(data)
        } catch (err) {
          console.error('Failed to fetch pitch control:', err)
        } finally {
          setLoading(false)
        }
      }

      fetchPitchControl()
    }, 300)

    return () => clearTimeout(timer)
  }, [matchId, currentFrame])

  if (!metadata || !frameData) {
    return <div className="pitch-control-tab">Loading...</div>
  }

  const exportHeatmapCSV = () => {
    if (!pitchControlData) return
    const { home_pct, x_coords, y_coords } = pitchControlData
    const rows = [['X', 'Y', 'Home_Control_Pct']]
    for (let yIdx = 0; yIdx < y_coords.length; yIdx++) {
      for (let xIdx = 0; xIdx < x_coords.length; xIdx++) {
        rows.push([x_coords[xIdx].toFixed(1), y_coords[yIdx].toFixed(1), (home_pct[yIdx][xIdx] * 100).toFixed(1)])
      }
    }
    const csvString = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csvString], {type: 'text/csv'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pitch_control_${pitchControlData.frame}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="pitch-control-tab">
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px' }}>
        <button onClick={exportHeatmapCSV} disabled={!pitchControlData} style={{ padding: '8px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', opacity: pitchControlData ? 1 : 0.5 }}>
          📥 Export Heatmap Data CSV
        </button>
      </div>
      <div className="pitch-container">
        {loading && (
          <div className="pitch-loading-overlay">
            <Spinner />
            <p>Computing pitch control...</p>
          </div>
        )}

        <PitchSVG>
          {pitchControlData && (
            <HeatmapOverlay
              pitchControlData={pitchControlData}
              homeColor={metadata.home_team.jersey_color}
              awayColor={metadata.away_team.jersey_color}
            />
          )}

          {/* Player dots on top of heatmap */}
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

      <div className="control-summary">
        <p className="model-note">
          Pitch control model: Spearman (2017) simplified.
          Blue = home dominance. Red = away dominance.
        </p>

        {pitchControlData && pitchControlData.summary && (
          <div className="control-bars">
            <div
              className="home-bar"
              style={{
                background: metadata.home_team.jersey_color,
                width: `${pitchControlData.summary.home_control_pct || 50}%`
              }}
            >
              {metadata.home_team.short_name}: {pitchControlData.summary.home_control_pct?.toFixed(1) || 50}%
            </div>
            <div
              className="away-bar"
              style={{
                background: metadata.away_team.jersey_color,
                width: `${pitchControlData.summary.away_control_pct || 50}%`
              }}
            >
              {metadata.away_team.short_name}: {pitchControlData.summary.away_control_pct?.toFixed(1) || 50}%
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
