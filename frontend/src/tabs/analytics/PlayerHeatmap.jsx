import React, { useState, useEffect } from 'react'
import { useMatchStore } from '../../store/matchStore'
import { api } from '../../api/client'
import PitchSVG from '../../components/pitch/PitchSVG'
import HeatmapLayer from '../../components/pitch/HeatmapLayer'
import Spinner from '../../components/ui/Spinner'
import PlayerSelector from '../../components/ui/PlayerSelector'

export default function PlayerHeatmap() {
  const { matchId, metadata } = useMatchStore()
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [period, setPeriod] = useState(0) // 0=full, 1=p1, 2=p2
  const [heatmapData, setHeatmapData] = useState(null)
  const [loading, setLoading] = useState(false)
  
  // Default player selection on mount
  useEffect(() => {
    if (!metadata || selectedPlayerId !== null) return

    // Find first outfield player from home team
    const homePlayers = metadata.players.filter(p => p.team === 'home')
    const defaultPlayer = homePlayers.find(p => p.position !== 'GK') || homePlayers[0]

    if (defaultPlayer) {
      setSelectedPlayerId(defaultPlayer.player_id)
    }
  }, [metadata, selectedPlayerId])

  useEffect(() => {
    if (!matchId || !selectedPlayerId) return

    const fetchHeatmap = async () => {
      setLoading(true)
      try {
        const data = await api.getPlayerHeatmap(matchId, selectedPlayerId, period)
        setHeatmapData(data)
      } catch (err) {
        console.error("Failed to fetch heatmap", err)
        setHeatmapData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchHeatmap()
  }, [matchId, selectedPlayerId, period])

  if (!metadata) return <div className="loading">Loading metadata...</div>

  const selectedPlayer = metadata.players.find(p => p.player_id === selectedPlayerId)
  const selectedTeamColor = selectedPlayer?.team === 'home'
    ? metadata.home_team.jersey_color
    : metadata.away_team.jersey_color

  return (
    <div className="player-heatmap-tab">
      <PlayerSelector
        players={metadata.players}
        selectedPlayerId={selectedPlayerId}
        onSelect={setSelectedPlayerId}
        defaultTeam="home"
        homeTeamName={metadata.home_team.short_name}
        awayTeamName={metadata.away_team.short_name}
        homeTeamColor={metadata.home_team.jersey_color}
        awayTeamColor={metadata.away_team.jersey_color}
      />

      <div className="period-filter" style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '24px 0' }}>
        {[
          { label: 'Full Match', val: 0 },
          { label: 'Period 1', val: 1 },
          { label: 'Period 2', val: 2 }
        ].map(pt => (
          <button
            key={pt.val}
            onClick={() => setPeriod(pt.val)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: period === pt.val ? '#4f8ef7' : '#2a2d3e',
              color: period === pt.val ? 'white' : '#ccc',
              cursor: 'pointer'
            }}
          >
            {pt.label}
          </button>
        ))}
      </div>

      <div className="heatmap-display">
          <div className="pitch-container" style={{ position: 'relative' }}>
            {loading && (
              <div className="pitch-loading-overlay">
                <Spinner />
                <p>Computing KDE Heatmap...</p>
              </div>
            )}
            
            <PitchSVG>
              {heatmapData && !loading && (
                <>
                  <HeatmapLayer heatmapData={heatmapData} teamColor={selectedTeamColor} />
                  {/* Average position marker */}
                  <g transform={`translate(${heatmapData.stats.avg_x}, ${heatmapData.stats.avg_y})`}>
                    <line x1="-1" y1="0" x2="1" y2="0" stroke="white" strokeWidth="0.3" />
                    <line x1="0" y1="-1" x2="0" y2="1" stroke="white" strokeWidth="0.3" />
                    <circle cx="0" cy="0" r="0.2" fill="white" />
                  </g>
                </>
              )}
            </PitchSVG>
          </div>

          {heatmapData && !loading && (
            <div className="control-summary stats-card" style={{ marginTop: '24px' }}>
              <h3 style={{ marginBottom: '8px' }}>Player Overview</h3>
              <p style={{ fontSize: '16px', color: 'white', marginBottom: '16px' }}>
                <strong>{selectedPlayer.name} {selectedPlayer.last_name}</strong> spent most time in the <strong>{heatmapData.stats.most_common_zone}</strong>.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', color: '#ccc' }}>
                <div>
                  <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#888' }}>Minutes Tracked</div>
                  <div style={{ fontSize: '20px', color: 'white' }}>{heatmapData.stats.minutes_tracked} min</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#888' }}>Average Position</div>
                  <div style={{ fontSize: '20px', color: 'white' }}>({heatmapData.stats.avg_x}, {heatmapData.stats.avg_y})</div>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  )
}
