import React, { useState, useEffect } from 'react'
import { useMatchStore } from '../../store/matchStore'
import { api } from '../../api/client'
import PitchSVG from '../../components/pitch/PitchSVG'
import HeatmapLayer from '../../components/pitch/HeatmapLayer'
import Spinner from '../../components/ui/Spinner'

export default function PlayerHeatmap() {
  const { matchId, metadata } = useMatchStore()
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [period, setPeriod] = useState(0) // 0=full, 1=p1, 2=p2
  const [heatmapData, setHeatmapData] = useState(null)
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    if (!matchId || !selectedPlayer) return
    
    const fetchHeatmap = async () => {
      setLoading(true)
      try {
        const data = await api.getPlayerHeatmap(matchId, selectedPlayer.id, period)
        setHeatmapData(data)
      } catch (err) {
        console.error("Failed to fetch heatmap", err)
        setHeatmapData(null)
      } finally {
        setLoading(false)
      }
    }
    
    fetchHeatmap()
  }, [matchId, selectedPlayer, period])

  if (!metadata) return <div className="loading">Loading metadata...</div>

  const homePlayers = metadata.players.filter(p => p.team_id === metadata.home_team.id)
  const awayPlayers = metadata.players.filter(p => p.team_id === metadata.away_team.id)

  const renderPlayerGrid = (players, teamColor) => (
    <div className="player-grid">
      {players.map(p => {
        const isSelected = selectedPlayer?.id === p.id
        return (
          <button
            key={p.id}
            className={`player-chip ${isSelected ? 'selected' : ''}`}
            style={{ 
              backgroundColor: isSelected ? teamColor : '#2a2d3e',
              border: `1px solid ${isSelected ? teamColor : '#333'}`,
              color: isSelected ? '#fff' : '#ccc'
            }}
            onClick={() => setSelectedPlayer(p)}
          >
            <span className="player-num">#{p.number}</span>
            <span className="player-name">{p.name} {p.last_name}</span>
            <span className="player-pos">{p.position}</span>
          </button>
        )
      })}
    </div>
  )

  const selectedTeamColor = selectedPlayer?.team_id === metadata.home_team.id 
    ? metadata.home_team.jersey_color 
    : metadata.away_team.jersey_color

  return (
    <div className="player-heatmap-tab">
      <div className="player-selector-section">
        <div className="team-column">
          <h3 style={{ color: metadata.home_team.jersey_color }}>{metadata.home_team.name}</h3>
          {renderPlayerGrid(homePlayers, metadata.home_team.jersey_color)}
        </div>
        <div className="team-column">
          <h3 style={{ color: metadata.away_team.jersey_color }}>{metadata.away_team.name}</h3>
          {renderPlayerGrid(awayPlayers, metadata.away_team.jersey_color)}
        </div>
      </div>

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

      {!selectedPlayer ? (
        <div className="prompt-message" style={{ textAlign: 'center', padding: '48px', color: '#999', background: '#1a1d2e', borderRadius: '12px' }}>
          <p>Select a player above to view their heatmap</p>
        </div>
      ) : (
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
      )}
    </div>
  )
}
