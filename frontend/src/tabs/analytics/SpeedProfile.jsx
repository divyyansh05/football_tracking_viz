import React, { useState, useEffect } from 'react'
import { useMatchStore } from '../../store/matchStore'
import { api } from '../../api/client'
import Spinner from '../../components/ui/Spinner'

export default function SpeedProfile() {
  const { matchId, metadata } = useMatchStore()
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!matchId || !selectedPlayer) return
    
    const fetchSpeed = async () => {
      setLoading(true)
      try {
        const result = await api.getPlayerSpeedProfile(matchId, selectedPlayer.id)
        setData(result)
      } catch (err) {
        console.error("Failed to fetch speed profile", err)
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    
    fetchSpeed()
  }, [matchId, selectedPlayer])

  useEffect(() => {
    if (data && !loading && window.Plotly) {
      renderTimelineChart()
      renderDonutChart()
    }
  }, [data, loading])

  const renderTimelineChart = () => {
    const teamColor = data.team === 'home' ? metadata.home_team.jersey_color : metadata.away_team.jersey_color
    
    const trace = {
      x: data.timeline.map(t => t.minute),
      y: data.timeline.map(t => t.speed_kmh),
      mode: 'lines',
      name: 'Speed',
      line: { color: teamColor, width: 1.5 },
      text: data.timeline.map(t => t.zone),
      hovertemplate: 'Minute %{x}<br>%{y:.1f} km/h — %{text}<extra></extra>'
    }

    const layout = {
      title: `Speed Profile — ${data.player_name}`,
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: '#ccc' },
      xaxis: { title: 'Match Minute', gridcolor: '#333', zerolinecolor: '#333' },
      yaxis: { title: 'Speed (km/h)', gridcolor: '#333', zerolinecolor: '#333', range: [0, 35] },
      margin: { l: 50, r: 20, t: 50, b: 50 },
      showlegend: false,
      shapes: [
        { type: 'line', x0: 45, y0: 0, x1: 45, y1: 35, line: { color: '#888', width: 2, dash: 'dash' } },
        { type: 'rect', x0: 0, x1: 1, xref: 'paper', y0: 0, y1: 7.2, fillcolor: 'grey', opacity: 0.15, line: { width: 0 } },
        { type: 'rect', x0: 0, x1: 1, xref: 'paper', y0: 7.2, y1: 14.4, fillcolor: 'green', opacity: 0.15, line: { width: 0 } },
        { type: 'rect', x0: 0, x1: 1, xref: 'paper', y0: 14.4, y1: 19.8, fillcolor: 'yellow', opacity: 0.15, line: { width: 0 } },
        { type: 'rect', x0: 0, x1: 1, xref: 'paper', y0: 19.8, y1: 25.2, fillcolor: 'orange', opacity: 0.15, line: { width: 0 } },
        { type: 'rect', x0: 0, x1: 1, xref: 'paper', y0: 25.2, y1: 40, fillcolor: 'red', opacity: 0.15, line: { width: 0 } }
      ]
    }

    window.Plotly.newPlot('speed-timeline-chart', [trace], layout, { responsive: true, displayModeBar: false })
  }

  const renderDonutChart = () => {
    const zones = data.zones
    const labels = ['Walking', 'Jogging', 'Running', 'High Speed', 'Sprint']
    const values = [zones.walking.pct, zones.jogging.pct, zones.running.pct, zones.high_speed.pct, zones.sprint.pct]
    const colors = ['#888888', '#4caf50', '#ffeb3b', '#ff9800', '#f44336']

    const trace = {
      labels,
      values,
      type: 'pie',
      hole: 0.5,
      marker: { colors },
      textinfo: 'none',
      hovertemplate: '%{label}<br>%{value:.1f}%<extra></extra>'
    }

    const layout = {
      paper_bgcolor: 'transparent',
      font: { color: '#ccc' },
      margin: { l: 20, r: 20, t: 20, b: 20 },
      showlegend: true,
      legend: { orientation: 'v', x: 1, y: 0.5 },
      annotations: [
        {
          font: { size: 14, color: '#fff' },
          showarrow: false,
          text: data.player_name.split(' ')[0]
        }
      ]
    }

    window.Plotly.newPlot('speed-donut-chart', [trace], layout, { responsive: true, displayModeBar: false })
  }

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

  const formatMinSec = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60)
    const s = Math.floor(totalSeconds % 60)
    return `${m}m ${s}s`
  }

  return (
    <div className="speed-profile-tab" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
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

      {!selectedPlayer && (
        <div style={{ textAlign: 'center', padding: '48px', color: '#999', background: '#1a1d2e', borderRadius: '12px' }}>
          <p>Select a player above to view their speed profile</p>
        </div>
      )}

      {selectedPlayer && (
        <div className="profile-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Section 1: Timeline */}
          <div className="section-timeline" style={{ background: '#1a1d2e', padding: '16px', borderRadius: '12px', position: 'relative' }}>
            {loading && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(26,29,46,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10, borderRadius: '12px' }}>
                <Spinner />
              </div>
            )}
            <div id="speed-timeline-chart" style={{ width: '100%', height: '300px' }}></div>
          </div>

          {!loading && data && (
            <>
              {/* Section 2: Zone Breakdown */}
              <div className="section-zones" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '300px', background: '#1a1d2e', padding: '16px', borderRadius: '12px' }}>
                  <h3 style={{ marginBottom: '16px', color: '#fff' }}>Zone Breakdown</h3>
                  <div id="speed-donut-chart" style={{ width: '100%', height: '250px' }}></div>
                </div>
                
                <div style={{ flex: 1, minWidth: '300px', background: '#1a1d2e', padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '16px' }}>
                  {[
                    { label: 'Sprint', key: 'sprint', color: '#f44336' },
                    { label: 'High Speed', key: 'high_speed', color: '#ff9800' },
                    { label: 'Running', key: 'running', color: '#ffeb3b' },
                    { label: 'Jogging', key: 'jogging', color: '#4caf50' },
                    { label: 'Walking', key: 'walking', color: '#888888' }
                  ].map(z => {
                    const zData = data.zones[z.key]
                    return (
                      <div key={z.key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#ccc', marginBottom: '4px' }}>
                          <span>{z.label}: {zData.pct}% ({formatMinSec(zData.seconds)})</span>
                        </div>
                        <div style={{ width: '100%', background: '#333', height: '12px', borderRadius: '6px' }}>
                          <div style={{ width: `${zData.pct}%`, background: z.color, height: '100%', borderRadius: '6px' }}></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Section 3: Sprints & Peak Stats */}
              <div className="section-sprints" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '300px', background: '#1a1d2e', padding: '20px', borderRadius: '12px' }}>
                  <h3 style={{ color: '#fff', marginBottom: '16px' }}>Sprint Events ({data.sprints.length} total)</h3>
                  {data.sprints.length === 0 ? (
                    <p style={{ color: '#888' }}>No sprint events detected for this player</p>
                  ) : (
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#1a1d2e' }}>
                          <tr style={{ color: '#888', borderBottom: '1px solid #333' }}>
                            <th style={{ padding: '8px' }}>#</th>
                            <th style={{ padding: '8px' }}>Minute</th>
                            <th style={{ padding: '8px' }}>Duration</th>
                            <th style={{ padding: '8px' }}>Max Speed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.sprints.map((s, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #2a2d3e', cursor: 'pointer' }}>
                              <td style={{ padding: '8px', color: '#888' }}>{i + 1}</td>
                              <td style={{ padding: '8px', color: 'white' }}>{s.start_minute}'</td>
                              <td style={{ padding: '8px', color: '#ccc' }}>{s.duration_seconds}s</td>
                              <td style={{ padding: '8px', fontWeight: 'bold', color: s.max_speed_kmh > 30 ? '#f44336' : 'white' }}>
                                {s.max_speed_kmh} km/h
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: '300px', background: '#1a1d2e', padding: '20px', borderRadius: '12px' }}>
                  <h3 style={{ color: '#fff', marginBottom: '16px' }}>Peak Physical Stats</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ background: '#2a2d3e', padding: '16px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>🏃 Top Speed</div>
                      <div style={{ fontSize: '20px', color: 'white' }}>{data.peak.max_speed_kmh} <span style={{fontSize:'14px', color:'#aaa'}}>km/h</span></div>
                      <div style={{ fontSize: '12px', color: '#888' }}>at min {data.peak.max_speed_minute}</div>
                    </div>
                    
                    <div style={{ background: '#2a2d3e', padding: '16px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>⚡ Sprints</div>
                      <div style={{ fontSize: '20px', color: 'white' }}>{data.peak.sprint_count}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>total events</div>
                    </div>
                    
                    <div style={{ background: '#2a2d3e', padding: '16px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>🔥 Sprint Distance</div>
                      <div style={{ fontSize: '20px', color: 'white' }}>{data.peak.total_sprint_distance_m} <span style={{fontSize:'14px', color:'#aaa'}}>m</span></div>
                      <div style={{ fontSize: '12px', color: '#888' }}>&gt; 25.2 km/h</div>
                    </div>
                    
                    <div style={{ background: '#2a2d3e', padding: '16px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>💪 High Intensity</div>
                      <div style={{ fontSize: '20px', color: 'white' }}>{data.peak.high_intensity_distance_m} <span style={{fontSize:'14px', color:'#aaa'}}>m</span></div>
                      <div style={{ fontSize: '12px', color: '#888' }}>&gt; 19.8 km/h</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
