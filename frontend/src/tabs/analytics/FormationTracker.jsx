import React, { useState, useEffect, useMemo } from 'react'
import { useMatchStore } from '../../store/matchStore'
import { api } from '../../api/client'
import Spinner from '../../components/ui/Spinner'
import PitchSVG from '../../components/pitch/PitchSVG'

export default function FormationTracker() {
  const { matchId, metadata, pitchDimensions } = useMatchStore()
  
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  
  const [windowMinutes, setWindowMinutes] = useState(5)
  const [period, setPeriod] = useState(0)
  const [teamFilter, setTeamFilter] = useState('both') // 'both', 'home', 'away'
  
  const [compareMode, setCompareMode] = useState(false)
  const [selectedWindowA, setSelectedWindowA] = useState(0)
  const [selectedWindowB, setSelectedWindowB] = useState(1)

  useEffect(() => {
    if (!matchId) return
    const fetchFormation = async () => {
      setLoading(true)
      try {
        const result = await api.getFormation(matchId, windowMinutes, period)
        setData(result)
        setSelectedWindowA(0)
        setSelectedWindowB(Math.min(1, result.windows.length - 1))
      } catch (err) {
        console.error("Failed to fetch formation data", err)
      } finally {
        setLoading(false)
      }
    }
    fetchFormation()
  }, [matchId, windowMinutes, period])

  useEffect(() => {
    if (data && !loading && window.Plotly) {
      renderEvolutionCharts()
    }
  }, [data, loading])

  const renderEvolutionCharts = () => {
    if (!data || data.windows.length === 0 || !window.Plotly) return

    const labels = data.windows.map(w => w.label)
    
    // Compute avg X per window
    const homeAvgX = data.windows.map(w => {
      if (w.home_players.length === 0) return null
      return w.home_players.reduce((sum, p) => sum + p.avg_x, 0) / w.home_players.length
    })

    const awayAvgX = data.windows.map(w => {
      if (w.away_players.length === 0) return null
      return w.away_players.reduce((sum, p) => sum + p.avg_x, 0) / w.away_players.length
    })

    const layout = {
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: '#ccc' },
      xaxis: { title: 'Match Window', gridcolor: '#333' },
      yaxis: { title: 'Average Depth (x_m)', gridcolor: '#333', range: [0, pitchDimensions.length] },
      margin: { l: 50, r: 20, t: 40, b: 50 },
      showlegend: false
    }

    const homeTrace = {
      x: labels,
      y: homeAvgX,
      mode: 'lines+markers',
      name: metadata.home_team.name,
      line: { color: metadata.home_team.jersey_color, width: 3 },
      marker: { size: 8 }
    }

    const awayTrace = {
      x: labels,
      y: awayAvgX,
      mode: 'lines+markers',
      name: metadata.away_team.name,
      line: { color: metadata.away_team.jersey_color, width: 3 },
      marker: { size: 8 }
    }

    const chartHomeEl = document.getElementById('formation-home-chart')
    if (chartHomeEl) {
      window.Plotly.newPlot(chartHomeEl, [homeTrace], { ...layout, title: `${metadata.home_team.name} Attacking Line Height` }, { responsive: true, displayModeBar: false })
    }
    
    const chartAwayEl = document.getElementById('formation-away-chart')
    if (chartAwayEl) {
      window.Plotly.newPlot(chartAwayEl, [awayTrace], { ...layout, title: `${metadata.away_team.name} Attacking Line Height` }, { responsive: true, displayModeBar: false })
    }
  }

  const renderPlayerNodes = (players, teamColor) => {
    // Render lines between all players for shape
    const lines = []
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        lines.push(
          <line 
            key={`${players[i].player_id}-${players[j].player_id}`}
            x1={players[i].avg_x} y1={players[i].avg_y}
            x2={players[j].avg_x} y2={players[j].avg_y}
            stroke={teamColor}
            strokeOpacity={0.15}
            strokeWidth={0.2}
            strokeDasharray="0.5 0.5"
          />
        )
      }
    }

    const nodes = players.map(p => (
      <g key={p.player_id}>
        <circle cx={p.avg_x} cy={p.avg_y} r={1.5} fill={teamColor} stroke="white" strokeWidth={0.2} opacity={0.9} />
        {/* Jersey number inside dot */}
        <text x={p.avg_x} y={p.avg_y + 0.5} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={1.2} fontWeight="bold">
          {p.number || ''}
        </text>
        {/* Position acronym below dot */}
        <text
          x={p.avg_x} y={p.avg_y + 3.2}
          textAnchor="middle" fontSize={1.4}
          fill={teamColor}
          stroke="black" strokeWidth={0.15}
          paintOrder="stroke">
          {p.position}
        </text>
        {/* Last name below position */}
        <text
          x={p.avg_x} y={p.avg_y + 5.0}
          textAnchor="middle" fontSize={1.0}
          fill="white" opacity={0.7}>
          {p.last_name || p.name}
        </text>
      </g>
    ))

    return (
      <g>
        {lines}
        {nodes}
      </g>
    )
  }

  const renderPitchForWindow = (windowIndex) => {
    if (!data || !data.windows[windowIndex]) return null
    const w = data.windows[windowIndex]
    const homeFormation = w.home_formation || null
    const awayFormation = w.away_formation || null

    return (
      <div style={{ position: 'relative' }}>
        {/* Formation badges */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          {(teamFilter === 'both' || teamFilter === 'home') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: metadata.home_team.jersey_color, fontWeight: 'bold', fontSize: 13 }}>
                {metadata.home_team.short_name}
              </span>
              <span className="formation-badge">
                {homeFormation && homeFormation !== 'N/A' ? homeFormation : 'Detecting...'}
              </span>
            </div>
          )}
          {(teamFilter === 'both' || teamFilter === 'away') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: metadata.away_team.jersey_color, fontWeight: 'bold', fontSize: 13 }}>
                {metadata.away_team.short_name}
              </span>
              <span className="formation-badge">
                {awayFormation && awayFormation !== 'N/A' ? awayFormation : 'Detecting...'}
              </span>
            </div>
          )}
        </div>

        {loading && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(26,29,46,0.7)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Spinner />
          </div>
        )}
        <PitchSVG>
          {(teamFilter === 'both' || teamFilter === 'home') && renderPlayerNodes(w.home_players, metadata.home_team.jersey_color)}
          {(teamFilter === 'both' || teamFilter === 'away') && renderPlayerNodes(w.away_players, metadata.away_team.jersey_color)}
        </PitchSVG>

        {/* Formation explanation collapsible */}
        <details className="formation-explanation" style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer', color: '#94a3b8', fontSize: 12 }}>What does this mean?</summary>
          <p style={{ color: '#94a3b8', fontSize: 12, margin: '8px 0 0', lineHeight: 1.6 }}>
            Formation shows the average shape of each team during this {windowMinutes}-minute window.
            Numbers represent lines: <strong style={{ color: 'white' }}>Defenders — Midfielders — Forwards</strong>.
            Note: automatic detection may vary for unusual or fluid formations.
          </p>
        </details>
      </div>
    )
  }

  const renderWindowTimeline = (selectedIndex, setIndex) => {
    if (!data) return null
    
    return (
      <div className="window-timeline" style={{ display: 'flex', overflowX: 'auto', gap: '8px', paddingBottom: '8px' }}>
        {data.windows.map((w, idx) => {
          const isSelected = selectedIndex === idx
          // rudimentary HT gap check: if current start_minute is >= 45 and prev end_minute was <= 45
          let isAfterHT = false
          if (idx > 0) {
            const prev = data.windows[idx - 1]
            if (prev.end_minute <= 45 && w.start_minute >= 45) {
              isAfterHT = true
            }
          }

          return (
            <React.Fragment key={w.window_id}>
              {isAfterHT && (
                <div style={{ width: '2px', background: '#888', margin: '0 8px' }}></div>
              )}
              <button
                onClick={() => setIndex(idx)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: isSelected ? '#4f8ef7' : '#2a2d3e',
                  color: isSelected ? 'white' : '#ccc',
                  border: isSelected ? '1px solid #7b8cde' : '1px solid #333',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontSize: '13px'
                }}
              >
                {w.label}
              </button>
            </React.Fragment>
          )
        })}
      </div>
    )
  }

  if (!metadata) return <div className="loading">Loading metadata...</div>

  return (
    <div className="formation-tab" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* CONTROLS (Top Bar) */}
      <div className="controls-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: '#1a1d2e', padding: '16px', borderRadius: '12px' }}>
        
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Time Window</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[2, 5, 10, 15].map(v => (
                <button
                  key={v}
                  onClick={() => setWindowMinutes(v)}
                  style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #333', background: windowMinutes === v ? '#4f8ef7' : 'transparent', color: windowMinutes === v ? 'white' : '#ccc', cursor: 'pointer' }}
                >
                  {v} min
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Period</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[{l: 'Full Match', v: 0}, {l: 'Period 1', v: 1}, {l: 'Period 2', v: 2}].map(p => (
                <button
                  key={p.v}
                  onClick={() => setPeriod(p.v)}
                  style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #333', background: period === p.v ? '#4f8ef7' : 'transparent', color: period === p.v ? 'white' : '#ccc', cursor: 'pointer' }}
                >
                  {p.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Team</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => setTeamFilter('both')} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #333', background: teamFilter === 'both' ? '#333' : 'transparent', color: 'white', cursor: 'pointer' }}>Both</button>
            <button onClick={() => setTeamFilter('home')} style={{ padding: '6px 10px', borderRadius: '4px', border: `1px solid ${metadata.home_team.jersey_color}`, background: teamFilter === 'home' ? metadata.home_team.jersey_color : 'transparent', color: 'white', cursor: 'pointer' }}>Home</button>
            <button onClick={() => setTeamFilter('away')} style={{ padding: '6px 10px', borderRadius: '4px', border: `1px solid ${metadata.away_team.jersey_color}`, background: teamFilter === 'away' ? metadata.away_team.jersey_color : 'transparent', color: 'white', cursor: 'pointer' }}>Away</button>
          </div>
        </div>

      </div>

      {/* MAIN VIEW */}
      <div className="main-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', background: '#1a1d2e', borderRadius: '6px', overflow: 'hidden' }}>
            <button 
              onClick={() => setCompareMode(false)}
              style={{ padding: '8px 16px', border: 'none', background: !compareMode ? '#4f8ef7' : 'transparent', color: !compareMode ? 'white' : '#ccc', cursor: 'pointer' }}>
              Single Window
            </button>
            <button 
              onClick={() => setCompareMode(true)}
              style={{ padding: '8px 16px', border: 'none', background: compareMode ? '#4f8ef7' : 'transparent', color: compareMode ? 'white' : '#ccc', cursor: 'pointer' }}>
              Compare Two Windows
            </button>
          </div>
        </div>

        {!compareMode ? (
          <div style={{ background: '#1a1d2e', padding: '20px', borderRadius: '12px' }}>
            {renderWindowTimeline(selectedWindowA, setSelectedWindowA)}
            <div style={{ marginTop: '20px' }}>
              {renderPitchForWindow(selectedWindowA)}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '400px', background: '#1a1d2e', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ color: 'white', marginBottom: '16px' }}>Window A</h3>
              {renderWindowTimeline(selectedWindowA, setSelectedWindowA)}
              <div style={{ marginTop: '20px' }}>
                {renderPitchForWindow(selectedWindowA)}
              </div>
            </div>
            
            <div style={{ flex: 1, minWidth: '400px', background: '#1a1d2e', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ color: 'white', marginBottom: '16px' }}>Window B</h3>
              {renderWindowTimeline(selectedWindowB, setSelectedWindowB)}
              <div style={{ marginTop: '20px' }}>
                {renderPitchForWindow(selectedWindowB)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FORMATION EVOLUTION CHART */}
      <div className="evolution-charts" style={{ background: '#1a1d2e', padding: '20px', borderRadius: '12px' }}>
        <h3 style={{ color: 'white', marginBottom: '16px' }}>Formation Evolution (Average Team Depth)</h3>
        {(!data || data.windows.length === 0) ? (
          <div style={{ color: '#888', textAlign: 'center', padding: '40px' }}>No data available</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div id="formation-home-chart" style={{ width: '100%', height: '250px' }}></div>
            <div id="formation-away-chart" style={{ width: '100%', height: '250px' }}></div>
          </div>
        )}
      </div>

    </div>
  )
}
