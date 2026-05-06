import React, { useState, useEffect, useMemo } from 'react'
import { useMatchStore } from '../../store/matchStore'
import { api } from '../../api/client'
import Spinner from '../../components/ui/Spinner'

export default function DistanceTimeline() {
  const { matchId, metadata } = useMatchStore()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [view, setView] = useState('chart') // 'chart' or 'table'
  const [teamFilter, setTeamFilter] = useState('both') // 'both', 'home', 'away'
  const [selectedPlayers, setSelectedPlayers] = useState(new Set())

  useEffect(() => {
    if (!matchId) return
    const fetchData = async () => {
      setLoading(true)
      try {
        const result = await api.getDistanceTimeline(matchId)
        setData(result)
        // Default to showing all home players for better UX
        const homePlayerIds = result.players
          .filter(p => p.team === 'home')
          .map(p => p.player_id)
        setSelectedPlayers(new Set(homePlayerIds))
        setTeamFilter('home')
      } catch (err) {
        console.error("Failed to fetch distance", err)
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [matchId])

  const filteredPlayers = useMemo(() => {
    if (!data) return []
    let p = data.players
    if (teamFilter === 'home') p = p.filter(x => x.team === 'home')
    if (teamFilter === 'away') p = p.filter(x => x.team === 'away')
    return p
  }, [data, teamFilter])

  useEffect(() => {
    if (view === 'chart' && data && !loading && window.Plotly) {
      renderChart()
    }
  }, [view, data, loading, selectedPlayers, filteredPlayers])

  const renderChart = () => {
    const traces = []
    
    filteredPlayers.forEach(p => {
      if (selectedPlayers.size > 0 && !selectedPlayers.has(p.player_id)) return
      
      const teamColor = p.team === 'home' ? metadata.home_team.jersey_color : metadata.away_team.jersey_color
      
      traces.push({
        x: p.timeline.map(t => t.minute),
        y: p.timeline.map(t => t.cumulative_km),
        mode: 'lines',
        name: `${p.last_name || p.name} (${p.total_distance_km} km)`,
        line: { color: teamColor, width: 2 },
        opacity: 0.8,
        hovertemplate: `<b>${p.last_name || p.name}</b><br>Minute %{x}<br>Distance: %{y:.2f} km<extra></extra>`
      })
    })

    const layout = {
      title: `Distance Covered — ${metadata.home_team.name} vs ${metadata.away_team.name}`,
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: '#ccc' },
      xaxis: { 
        title: 'Match Minute', 
        gridcolor: '#333', 
        zerolinecolor: '#333'
      },
      yaxis: { 
        title: 'Cumulative Distance (km)', 
        gridcolor: '#333', 
        zerolinecolor: '#333' 
      },
      margin: { l: 50, r: 20, t: 50, b: 50 },
      showlegend: true,
      legend: { orientation: 'h', y: -0.2 },
      shapes: [
        {
          type: 'line',
          x0: 45, y0: 0, x1: 45, y1: 1, yref: 'paper',
          line: { color: '#888', width: 2, dash: 'dash' }
        }
      ],
      annotations: [
        { x: 45, y: 1, yref: 'paper', text: 'HT', showarrow: false, yanchor: 'bottom', font: { color: '#888' } }
      ]
    }

    const config = { responsive: true, displayModeBar: false }
    window.Plotly.newPlot('plotly-distance-chart', traces, layout, config)
  }

  const togglePlayer = (id) => {
    const next = new Set(selectedPlayers)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedPlayers(next)
  }

  const selectTeamPlayers = (team) => {
    setTeamFilter(team)
    if (team === 'both') {
      setSelectedPlayers(new Set(data.players.map(p => p.player_id)))
    } else {
      setSelectedPlayers(new Set(data.players.filter(p => p.team === team).map(p => p.player_id)))
    }
  }

  const insights = useMemo(() => {
    if (!data || !data.players.length) return null
    const sorted = [...data.players].sort((a, b) => b.total_distance_km - a.total_distance_km)
    const top = sorted[0]
    const lowest = sorted[sorted.length - 1]
    return `🏃 ${top.name} ${top.last_name} covered the most ground at ${top.total_distance_km} km. 📉 ${lowest.name} ${lowest.last_name} covered ${lowest.total_distance_km} km — typical for their position.`
  }, [data])

  if (!metadata) return <div className="loading">Loading metadata...</div>
  
  if (loading) {
    return (
      <div className="distance-tab" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <Spinner />
      </div>
    )
  }
  
  if (!data || data.players.length === 0) {
    return (
      <div className="distance-tab" style={{ textAlign: 'center', padding: '100px', color: '#999' }}>
        Distance data not available for this match
      </div>
    )
  }

  const maxDist = Math.max(...data.players.map(p => p.total_distance_km))

  const renderTeamTable = (teamObj, playersList, teamColor) => (
    <div className="team-card" style={{ background: '#1a1d2e', padding: '20px', borderRadius: '12px', flex: 1, minWidth: '300px' }}>
      <h3 style={{ color: teamColor, marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '12px' }}>
        {teamObj.name} — {teamObj.total_km} km
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginTop: '16px' }}>
        <thead>
          <tr style={{ color: '#888', borderBottom: '1px solid #333', textAlign: 'left' }}>
            <th style={{ padding: '8px' }}>Rank</th>
            <th style={{ padding: '8px' }}>Name</th>
            <th style={{ padding: '8px' }}>Pos</th>
            <th style={{ padding: '8px' }}>P1 (km)</th>
            <th style={{ padding: '8px' }}>P2 (km)</th>
            <th style={{ padding: '8px' }}>Total (km)</th>
            <th style={{ padding: '8px', width: '100px' }}>Bar</th>
          </tr>
        </thead>
        <tbody>
          {playersList.map((p, idx) => (
            <tr key={p.player_id} style={{ borderBottom: '1px solid #2a2d3e' }}>
              <td style={{ padding: '8px', color: '#888' }}>{idx + 1}</td>
              <td style={{ padding: '8px', color: 'white' }}>{p.last_name || p.name}</td>
              <td style={{ padding: '8px', color: '#aaa' }}>{p.position}</td>
              <td style={{ padding: '8px' }}>{p.period_1_km}</td>
              <td style={{ padding: '8px' }}>{p.period_2_km}</td>
              <td style={{ padding: '8px', fontWeight: 'bold' }}>{p.total_distance_km}</td>
              <td style={{ padding: '8px' }}>
                <div style={{ width: '100%', background: '#333', height: '6px', borderRadius: '3px' }}>
                  <div style={{ width: `${(p.total_distance_km / maxDist) * 100}%`, background: teamColor, height: '100%', borderRadius: '3px' }}></div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: '16px', color: '#aaa', fontSize: '13px', textAlign: 'right' }}>
        Team average: {teamObj.avg_km_per_player} km per player
      </div>
    </div>
  )

  return (
    <div className="distance-tab" style={{ padding: '16px' }}>
      <div className="view-toggle" style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
        <button 
          onClick={() => setView('chart')}
          style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', background: view === 'chart' ? '#4f8ef7' : '#2a2d3e', color: view === 'chart' ? 'white' : '#ccc', cursor: 'pointer' }}>
          📈 Timeline Chart
        </button>
        <button 
          onClick={() => setView('table')}
          style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', background: view === 'table' ? '#4f8ef7' : '#2a2d3e', color: view === 'table' ? 'white' : '#ccc', cursor: 'pointer' }}>
          📊 Summary Table
        </button>
      </div>

      {view === 'chart' && (
        <div className="chart-view">
          <div className="chart-controls" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px', background: '#1a1d2e', padding: '16px', borderRadius: '12px' }}>
            <div className="team-filter" style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => selectTeamPlayers('both')} style={{ padding: '6px 12px', background: teamFilter === 'both' ? '#333' : 'transparent', border: '1px solid #444', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>Both Teams</button>
              <button onClick={() => selectTeamPlayers('home')} style={{ padding: '6px 12px', background: teamFilter === 'home' ? metadata.home_team.jersey_color : 'transparent', border: `1px solid ${metadata.home_team.jersey_color}`, color: 'white', borderRadius: '4px', cursor: 'pointer' }}>Home Only</button>
              <button onClick={() => selectTeamPlayers('away')} style={{ padding: '6px 12px', background: teamFilter === 'away' ? metadata.away_team.jersey_color : 'transparent', border: `1px solid ${metadata.away_team.jersey_color}`, color: 'white', borderRadius: '4px', cursor: 'pointer' }}>Away Only</button>
            </div>
            
            <div className="player-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {filteredPlayers.map(p => {
                const isActive = selectedPlayers.has(p.player_id)
                const teamColor = p.team === 'home' ? metadata.home_team.jersey_color : metadata.away_team.jersey_color
                return (
                  <button
                    key={p.player_id}
                    onClick={() => togglePlayer(p.player_id)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      borderRadius: '12px',
                      border: `1px solid ${isActive ? teamColor : '#444'}`,
                      background: isActive ? teamColor : 'transparent',
                      color: isActive ? 'white' : '#aaa',
                      cursor: 'pointer'
                    }}
                  >
                    {p.last_name || p.name}
                  </button>
                )
              })}
            </div>
          </div>
          
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <div id="plotly-distance-chart" style={{ width: '100%', minWidth: '700px', height: '500px', background: '#12151f', borderRadius: '12px' }}></div>
          </div>
        </div>
      )}

      {view === 'table' && (
        <div className="table-view">
          <div className="table-cards" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {renderTeamTable(
              data.team_summary.home, 
              data.players.filter(p => p.team === 'home'), 
              metadata.home_team.jersey_color
            )}
            {renderTeamTable(
              data.team_summary.away, 
              data.players.filter(p => p.team === 'away'), 
              metadata.away_team.jersey_color
            )}
          </div>
          
          {insights && (
            <div className="insights-box" style={{ marginTop: '24px', padding: '16px', background: '#1e2235', borderLeft: '4px solid #4f8ef7', borderRadius: '4px', color: '#ccc', fontSize: '15px' }}>
              <strong>Quick Insights:</strong><br/>
              {insights}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
