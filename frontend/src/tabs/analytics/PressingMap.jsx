import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useMatchStore } from '../../store/matchStore'
import { api } from '../../api/client'
import Spinner from '../../components/ui/Spinner'
import PitchSVG from '../../components/pitch/PitchSVG'
import HeatmapLayer from '../../components/pitch/HeatmapLayer'

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

export default function PressingMap() {
  const { matchId, metadata, pitchDimensions } = useMatchStore()
  
  const [teamFilter, setTeamFilter] = useState('home')
  const [period, setPeriod] = useState(0)
  const [thresholdSlider, setThresholdSlider] = useState(5.0)
  const threshold = useDebounce(thresholdSlider, 500)
  const [minuteWindow, setMinuteWindow] = useState(null) // null = full match
  const debouncedMinuteWindow = useDebounce(minuteWindow, 400)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  
  const [compareDataHome, setCompareDataHome] = useState(null)
  const [compareDataAway, setCompareDataAway] = useState(null)

  // Fetch main map
  useEffect(() => {
    if (!matchId) return
    const fetchPressing = async () => {
      setLoading(true)
      try {
        const startMin = debouncedMinuteWindow
        const endMin = debouncedMinuteWindow !== null ? debouncedMinuteWindow + 5 : null
        const result = await api.getPressingMap(matchId, teamFilter, period, threshold, startMin, endMin)
        setData(result)
      } catch (err) {
        console.error("Failed to fetch pressing map", err)
      } finally {
        setLoading(false)
      }
    }
    fetchPressing()
  }, [matchId, teamFilter, period, threshold, debouncedMinuteWindow])

  // Fetch comparison data when panel opened
  useEffect(() => {
    if (!matchId || !showCompare) return
    const fetchCompare = async () => {
      try {
        const [hRes, aRes] = await Promise.all([
          api.getPressingMap(matchId, 'home', period, threshold),
          api.getPressingMap(matchId, 'away', period, threshold)
        ])
        setCompareDataHome(hRes)
        setCompareDataAway(aRes)
      } catch(err) {
        console.error("Failed to fetch compare data", err)
      }
    }
    fetchCompare()
  }, [matchId, showCompare, period, threshold])

  const getInterpretation = (pct) => {
    if (pct > 30) return { icon: '🔥', text: 'High pressing team. Aggressive ball recovery.' }
    if (pct >= 15) return { icon: '⚡', text: 'Moderate press. Selective pressing in key zones.' }
    return { icon: '🛡', text: 'Low block. Defending deep and compact.' }
  }

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255'
  }

  const renderPitchWithHeatmap = (mapData, isCompare = false) => {
    if (!mapData || !metadata) return null
    
    const teamColor = mapData.team === 'home' ? metadata.home_team.jersey_color : metadata.away_team.jersey_color
    const colorRgb = hexToRgb(teamColor)
    
    // Create a color scale based on the team's primary color
    const colorScale = [
      [0.0, `rgba(${colorRgb}, 0)`],
      [0.2, `rgba(${colorRgb}, 0.2)`],
      [0.5, `rgba(${colorRgb}, 0.5)`],
      [0.8, `rgba(${colorRgb}, 0.8)`],
      [1.0, `rgba(${colorRgb}, 1.0)`]
    ]

    return (
      <div style={{ position: 'relative' }}>
        <PitchSVG>
          {mapData.heatmap && (
            <HeatmapLayer 
              heatmapData={mapData.heatmap} 
              xGrid={mapData.x_grid} 
              yGrid={mapData.y_grid} 
              customColorScale={colorScale}
            />
          )}
          
          {/* Half line marker */}
          <line x1={pitchDimensions.length / 2} y1={0} x2={pitchDimensions.length / 2} y2={pitchDimensions.width} stroke="white" strokeWidth={0.5} strokeDasharray="2,2" opacity={0.5} />
          
          {/* Label pressing zone */}
          {mapData.team === 'home' ? (
            <text x={78.75} y={34} fill="white" opacity={0.3} fontSize={4} textAnchor="middle" transform="rotate(-90 78.75 34)">
              OPPONENT HALF (PRESSING ZONE)
            </text>
          ) : (
            <text x={26.25} y={34} fill="white" opacity={0.3} fontSize={4} textAnchor="middle" transform="rotate(-90 26.25 34)">
              OPPONENT HALF (PRESSING ZONE)
            </text>
          )}

          {/* Threshold circle visualization */}
          {!isCompare && (
            <g className="threshold-indicator">
              <circle
                cx={mapData.team === 'home' ? 78.75 : 26.25}
                cy={34}
                r={thresholdSlider}
                fill="none"
                stroke="white"
                strokeWidth={0.3}
                strokeDasharray="1,1"
                opacity={0.4}
              />
              <text
                x={mapData.team === 'home' ? 78.75 : 26.25}
                y={34 + thresholdSlider + 2}
                textAnchor="middle"
                fontSize={1.2}
                fill="white"
                opacity={0.5}>
                {thresholdSlider}m threshold
              </text>
            </g>
          )}
        </PitchSVG>
        
        {loading && !isCompare && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(26,29,46,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Spinner />
          </div>
        )}
      </div>
    )
  }

  if (!metadata) return <div className="loading">Loading metadata...</div>

  return (
    <div className="pressing-map-tab" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* CONTROLS */}
      <div className="controls-panel" style={{ background: '#1a1d2e', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button 
            onClick={() => setTeamFilter('home')}
            style={{ flex: 1, padding: '12px', borderRadius: '8px', border: `2px solid ${metadata.home_team.jersey_color}`, background: teamFilter === 'home' ? metadata.home_team.jersey_color : 'transparent', color: 'white', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
            Home — {metadata.home_team.name}
          </button>
          <button 
            onClick={() => setTeamFilter('away')}
            style={{ flex: 1, padding: '12px', borderRadius: '8px', border: `2px solid ${metadata.away_team.jersey_color}`, background: teamFilter === 'away' ? metadata.away_team.jersey_color : 'transparent', color: 'white', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
            Away — {metadata.away_team.name}
          </button>
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '8px' }}>Period</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[{l: 'Full Match', v: 0}, {l: 'Period 1', v: 1}, {l: 'Period 2', v: 2}].map(p => (
                <button
                  key={p.v}
                  onClick={() => setPeriod(p.v)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #333', background: period === p.v ? '#4f8ef7' : 'transparent', color: period === p.v ? 'white' : '#ccc', cursor: 'pointer' }}
                >
                  {p.l}
                </button>
              ))}
            </div>
          </div>
          
          <div style={{ flex: 1, minWidth: '300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: '#888' }}>Pressing range: {thresholdSlider} m</span>
              <span style={{ fontSize: '12px', color: '#555' }}>Distance from ball considered 'pressing'</span>
            </div>
            <input
              type="range"
              min="2" max="10" step="0.5"
              value={thresholdSlider}
              onChange={(e) => setThresholdSlider(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div className="minute-window-control" style={{ borderTop: '1px solid #2a2d3e', paddingTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#888' }}>
              {minuteWindow === null ? 'Viewing: Full Match' : `Viewing: Minute ${minuteWindow} — ${minuteWindow + 5}`}
            </span>
            {minuteWindow !== null && (
              <button
                onClick={() => setMinuteWindow(null)}
                style={{ padding: '4px 12px', background: '#333', border: '1px solid #555', borderRadius: '4px', color: '#ccc', cursor: 'pointer', fontSize: '12px' }}>
                Show Full Match
              </button>
            )}
          </div>
          <input
            type="range"
            min="0" max="90" step="5"
            value={minuteWindow === null ? 0 : minuteWindow}
            onChange={(e) => setMinuteWindow(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
            Slide to explore pressing by 5-minute windows
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      {data && (
        <div className="main-layout" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          
          <div className="pitch-container" style={{ flex: '3', minWidth: '400px' }}>
            {renderPitchWithHeatmap(data)}
          </div>
          
          <div className="stats-container" style={{ flex: '2', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div className="intensity-card" style={{ background: '#1a1d2e', padding: '24px', borderRadius: '12px', borderTop: `4px solid ${data.team === 'home' ? metadata.home_team.jersey_color : metadata.away_team.jersey_color}` }}>
              <div style={{ fontSize: '14px', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Pressing Intensity</div>
              <div style={{ fontSize: '48px', color: 'white', fontWeight: 'bold' }}>{data.stats.pressing_intensity_pct}%</div>
              <div style={{ fontSize: '13px', color: '#aaa', marginTop: '4px' }}>% of match time at least one player was pressing</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '24px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#888' }}>Total Events</div>
                  <div style={{ fontSize: '18px', color: '#fff' }}>{data.stats.total_pressing_events}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#888' }}>Most Pressed Zone</div>
                  <div style={{ fontSize: '18px', color: '#fff' }}>{data.stats.most_pressed_zone}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#888' }}>Avg Distance</div>
                  <div style={{ fontSize: '18px', color: '#fff' }}>{data.stats.avg_pressing_distance_m} m</div>
                </div>
                {period === 0 && (
                  <div>
                    <div style={{ fontSize: '12px', color: '#888' }}>Period Comparison</div>
                    <div style={{ fontSize: '16px', color: '#ccc' }}>P1 vs P2</div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="interpretation-card" style={{ background: '#1e2235', padding: '20px', borderRadius: '12px', border: '1px solid #333', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ fontSize: '32px' }}>
                {getInterpretation(data.stats.pressing_intensity_pct).icon}
              </div>
              <div style={{ color: '#ccc', fontSize: '16px', lineHeight: '1.4' }}>
                {getInterpretation(data.stats.pressing_intensity_pct).text}
              </div>
            </div>

            {/* Zone breakdown */}
            {data.zone_breakdown && (
              <div className="zone-breakdown-card" style={{ background: '#1a1d2e', padding: '20px', borderRadius: '12px' }}>
                <h4 style={{ color: '#fff', marginBottom: '12px', fontSize: '14px' }}>Pressing by Zone</h4>
                <div className="zone-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { key: 'left_att', label: 'Left Attack' },
                    { key: 'center_att', label: 'Center Attack' },
                    { key: 'right_att', label: 'Right Attack' },
                    { key: 'left_def', label: 'Left Def' },
                    { key: 'center_def', label: 'Center Def' },
                    { key: 'right_def', label: 'Right Def' }
                  ].map(zone => {
                    const count = data.zone_breakdown[zone.key] || 0
                    const maxCount = Math.max(...Object.values(data.zone_breakdown))
                    const intensity = maxCount > 0 ? count / maxCount : 0
                    const teamColor = data.team === 'home' ? metadata.home_team.jersey_color : metadata.away_team.jersey_color
                    const teamRgb = hexToRgb(teamColor)
                    return (
                      <div
                        key={zone.key}
                        className="zone-cell"
                        style={{
                          background: `rgba(${teamRgb}, ${intensity * 0.6})`,
                          border: '1px solid #333',
                          borderRadius: '6px',
                          padding: '12px 8px',
                          textAlign: 'center'
                        }}>
                        <div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', marginBottom: '4px' }}>
                          {zone.label}
                        </div>
                        <div style={{ fontSize: '16px', color: 'white', fontWeight: 'bold' }}>
                          {count}
                        </div>
                        <div style={{ fontSize: '9px', color: '#666' }}>events</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Top pressers */}
            {data.top_pressers && data.top_pressers.length > 0 && (
              <div className="top-pressers-card" style={{ background: '#1a1d2e', padding: '20px', borderRadius: '12px' }}>
                <h4 style={{ color: '#fff', marginBottom: '12px', fontSize: '14px' }}>Top Pressing Players</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Player</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Events</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>% Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_pressers.map(p => (
                      <tr key={p.player_id} style={{ borderBottom: '1px solid #2a2d3e' }}>
                        <td style={{ padding: '8px', color: 'white' }}>{p.name}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#ccc' }}>{p.pressing_frames}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#ccc' }}>{p.pressing_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Period breakdown */}
            {data.period_breakdown && (
              <div className="period-breakdown-card" style={{ background: '#1e2235', padding: '16px', borderRadius: '12px', border: '1px solid #333' }}>
                <h4 style={{ color: '#fff', marginBottom: '12px', fontSize: '14px' }}>Period Comparison</h4>
                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#888' }}>Period 1</div>
                    <div style={{ fontSize: '20px', color: 'white', fontWeight: 'bold' }}>
                      {data.period_breakdown.p1_intensity_pct}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#888' }}>Period 2</div>
                    <div style={{ fontSize: '20px', color: 'white', fontWeight: 'bold' }}>
                      {data.period_breakdown.p2_intensity_pct}%
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* COMPARISON */}
      <div className="comparison-section" style={{ background: '#1a1d2e', padding: '20px', borderRadius: '12px', marginTop: '16px' }}>
        <button 
          onClick={() => setShowCompare(!showCompare)}
          style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #4f8ef7', background: 'transparent', color: '#4f8ef7', cursor: 'pointer', width: '100%', fontSize: '15px' }}>
          {showCompare ? 'Hide Comparison' : 'Show Comparison'}
        </button>
        
        {showCompare && (
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '24px' }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <h3 style={{ color: metadata.home_team.jersey_color, marginBottom: '12px', textAlign: 'center' }}>{metadata.home_team.name}</h3>
              {renderPitchWithHeatmap(compareDataHome, true)}
              {compareDataHome && (
                <div style={{ textAlign: 'center', marginTop: '12px', color: 'white', fontSize: '18px' }}>
                  Intensity: {compareDataHome.stats.pressing_intensity_pct}%
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <h3 style={{ color: metadata.away_team.jersey_color, marginBottom: '12px', textAlign: 'center' }}>{metadata.away_team.name}</h3>
              {renderPitchWithHeatmap(compareDataAway, true)}
              {compareDataAway && (
                <div style={{ textAlign: 'center', marginTop: '12px', color: 'white', fontSize: '18px' }}>
                  Intensity: {compareDataAway.stats.pressing_intensity_pct}%
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
