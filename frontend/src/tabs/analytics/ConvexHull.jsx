import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useMatchStore } from '../../store/matchStore'
import { api } from '../../api/client'
import Spinner from '../../components/ui/Spinner'
import PitchSVG from '../../components/pitch/PitchSVG'

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export default function ConvexHull() {
  const { matchId, metadata, currentFrame, setFrame, frameData, isPlaying, togglePlay } = useMatchStore()
  
  const [hullData, setHullData] = useState(null)
  const [timelineData, setTimelineData] = useState(null)
  const [loadingTimeline, setLoadingTimeline] = useState(false)
  const [chartView, setChartView] = useState('area') // 'area' or 'distance'

  const debouncedFrame = useDebounce(currentFrame, 200)

  // Fetch timeline on mount
  useEffect(() => {
    if (!matchId) return
    const fetchTimeline = async () => {
      setLoadingTimeline(true)
      try {
        const result = await api.getConvexHullTimeline(matchId)
        setTimelineData(result)
      } catch (err) {
        console.error("Failed to fetch convex hull timeline", err)
      } finally {
        setLoadingTimeline(false)
      }
    }
    fetchTimeline()
  }, [matchId])

  // Fetch hull for current frame (debounced)
  useEffect(() => {
    if (!matchId || debouncedFrame === null) return
    const fetchHull = async () => {
      try {
        const result = await api.getConvexHull(matchId, debouncedFrame)
        setHullData(result)
      } catch (err) {
        console.error("Failed to fetch convex hull frame", err)
      }
    }
    fetchHull()
  }, [matchId, debouncedFrame])

  useEffect(() => {
    if (timelineData && window.Plotly) {
      if (chartView === 'area') renderAreaChart()
      else renderDistanceChart()
    }
  }, [timelineData, chartView])

  const renderAreaChart = () => {
    if (!timelineData || !metadata || !window.Plotly) return
    
    const traceHome = {
      x: timelineData.timeline.map(t => t.minute),
      y: timelineData.timeline.map(t => t.home_area_m2),
      mode: 'lines',
      name: metadata.home_team.name,
      line: { color: metadata.home_team.jersey_color, width: 2 },
      hovertemplate: `${metadata.home_team.name}: %{y} m² at minute %{x}<extra></extra>`
    }

    const traceAway = {
      x: timelineData.timeline.map(t => t.minute),
      y: timelineData.timeline.map(t => t.away_area_m2),
      mode: 'lines',
      name: metadata.away_team.name,
      line: { color: metadata.away_team.jersey_color, width: 2 },
      hovertemplate: `${metadata.away_team.name}: %{y} m² at minute %{x}<extra></extra>`
    }

    const layout = {
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: '#ccc' },
      xaxis: { title: 'Match Minute', gridcolor: '#333', zerolinecolor: '#333' },
      yaxis: { title: 'Hull Area (m²)', gridcolor: '#333', zerolinecolor: '#333' },
      margin: { l: 60, r: 20, t: 30, b: 50 },
      legend: { orientation: 'h', y: -0.2 },
      shapes: [
        { type: 'line', x0: 45, y0: 0, x1: 45, y1: 1, yref: 'paper', line: { color: '#888', width: 2, dash: 'dash' } }
      ],
      annotations: [
        { x: 45, y: 1, yref: 'paper', text: 'HT', showarrow: false, yanchor: 'bottom', font: { color: '#888' } }
      ]
    }

    const chartEl = document.getElementById('hull-timeline-chart')
    if (chartEl) {
      window.Plotly.newPlot(chartEl, [traceHome, traceAway], layout, { responsive: true, displayModeBar: false })
    }
  }

  const renderDistanceChart = () => {
    if (!timelineData || !window.Plotly) return
    
    const trace = {
      x: timelineData.timeline.map(t => t.minute),
      y: timelineData.timeline.map(t => t.centroid_distance),
      mode: 'lines',
      name: 'Distance',
      line: { color: '#4f8ef7', width: 2 },
      hovertemplate: 'Distance: %{y} m at minute %{x}<extra></extra>'
    }

    const layout = {
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: '#ccc' },
      xaxis: { title: 'Match Minute', gridcolor: '#333', zerolinecolor: '#333' },
      yaxis: { title: 'Centroid Distance (m)', gridcolor: '#333', zerolinecolor: '#333' },
      margin: { l: 60, r: 20, t: 30, b: 50 },
      showlegend: false,
      shapes: [
        { type: 'line', x0: 45, y0: 0, x1: 45, y1: 1, yref: 'paper', line: { color: '#888', width: 2, dash: 'dash' } },
        { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: 20, y1: 20, line: { color: '#f44336', width: 1, dash: 'dot' } },
        { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: 40, y1: 40, line: { color: '#4caf50', width: 1, dash: 'dot' } }
      ],
      annotations: [
        { x: 45, y: 1, yref: 'paper', text: 'HT', showarrow: false, yanchor: 'bottom', font: { color: '#888' } },
        { x: 0, y: 20, text: 'Compact (20m)', showarrow: false, xanchor: 'left', yanchor: 'bottom', font: { color: '#f44336', size: 10 } },
        { x: 0, y: 40, text: 'Separated (40m)', showarrow: false, xanchor: 'left', yanchor: 'bottom', font: { color: '#4caf50', size: 10 } }
      ]
    }

    const chartEl = document.getElementById('hull-timeline-chart')
    if (chartEl) {
      window.Plotly.newPlot(chartEl, [trace], layout, { responsive: true, displayModeBar: false })
    }
  }

  const getSeparationText = (dist) => {
    if (dist > 40) return "Teams well separated"
    if (dist >= 20 && dist <= 40) return "Compact mid-block scenario"
    return "Teams pressing high and compact"
  }

  if (!metadata) return <div className="loading">Loading metadata...</div>

  // Create hull polygon strings for SVG
  let homePolygonStr = ''
  let awayPolygonStr = ''
  
  if (hullData) {
    if (hullData.home?.hull_polygon?.length > 0) {
      homePolygonStr = hullData.home.hull_polygon.map(p => `${p[0]},${p[1]}`).join(' ')
    }
    if (hullData.away?.hull_polygon?.length > 0) {
      awayPolygonStr = hullData.away.hull_polygon.map(p => `${p[0]},${p[1]}`).join(' ')
    }
  }

  // Draw players on pitch
  const playersOverlay = frameData ? (
    <g>
      {frameData.home_players?.map(p => (
        <circle key={p.player_id} cx={p.x_m} cy={p.y_m} r={1.2} fill={metadata.home_team.jersey_color} stroke="white" strokeWidth={0.2} />
      ))}
      {frameData.away_players?.map(p => (
        <circle key={p.player_id} cx={p.x_m} cy={p.y_m} r={1.2} fill={metadata.away_team.jersey_color} stroke="white" strokeWidth={0.2} />
      ))}
      {frameData.ball && (
        <circle cx={frameData.ball.x_m} cy={frameData.ball.y_m} r={0.8} fill="yellow" stroke="black" strokeWidth={0.2} />
      )}
    </g>
  ) : null

  return (
    <div className="convex-hull-tab" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* FRAME VIEW SECTION */}
      <div className="frame-view-section" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        
        {/* Pitch Area */}
        <div className="pitch-container" style={{ flex: '2', minWidth: '400px' }}>
          <PitchSVG>
            {homePolygonStr && (
              <polygon points={homePolygonStr} fill={metadata.home_team.jersey_color} fillOpacity={0.2} stroke={metadata.home_team.jersey_color} strokeOpacity={0.7} strokeWidth={0.4} />
            )}
            {awayPolygonStr && (
              <polygon points={awayPolygonStr} fill={metadata.away_team.jersey_color} fillOpacity={0.2} stroke={metadata.away_team.jersey_color} strokeOpacity={0.7} strokeWidth={0.4} />
            )}
            {playersOverlay}
          </PitchSVG>
          
          {/* Controls */}
          <div className="controls" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px', background: '#1a1d2e', padding: '12px 20px', borderRadius: '12px' }}>
            <button onClick={togglePlay} style={{ padding: '8px 16px', borderRadius: '6px', background: isPlaying ? '#f44336' : '#4caf50', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <input 
              type="range" 
              min={metadata.match_periods[0]?.start_frame || 0} 
              max={metadata.match_periods[metadata.match_periods.length-1]?.end_frame || 1000}
              value={currentFrame || 0}
              onChange={(e) => setFrame(parseInt(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ color: '#ccc', fontVariantNumeric: 'tabular-nums' }}>Frame: {currentFrame}</span>
          </div>
        </div>
        
        {/* Metrics Panel */}
        <div className="metrics-panel" style={{ flex: '1', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {hullData ? (
            <>
              {/* Home Card */}
              <div style={{ background: '#1a1d2e', padding: '20px', borderRadius: '12px', borderLeft: `4px solid ${metadata.home_team.jersey_color}` }}>
                <h3 style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: metadata.home_team.jersey_color }}></span>
                  {metadata.home_team.name}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#888' }}>Area</div>
                    <div style={{ fontSize: '18px', color: '#fff' }}>{hullData.home?.area_m2?.toLocaleString() || 0} m²</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#888' }}>Players in hull</div>
                    <div style={{ fontSize: '18px', color: '#fff' }}>{hullData.home?.player_count || 0}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#888' }}>Length</div>
                    <div style={{ fontSize: '18px', color: '#fff' }}>{hullData.home?.team_length || 0} m</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#888' }}>Width</div>
                    <div style={{ fontSize: '18px', color: '#fff' }}>{hullData.home?.team_width || 0} m</div>
                  </div>
                </div>
              </div>

              {/* Away Card */}
              <div style={{ background: '#1a1d2e', padding: '20px', borderRadius: '12px', borderLeft: `4px solid ${metadata.away_team.jersey_color}` }}>
                <h3 style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: metadata.away_team.jersey_color }}></span>
                  {metadata.away_team.name}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#888' }}>Area</div>
                    <div style={{ fontSize: '18px', color: '#fff' }}>{hullData.away?.area_m2?.toLocaleString() || 0} m²</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#888' }}>Players in hull</div>
                    <div style={{ fontSize: '18px', color: '#fff' }}>{hullData.away?.player_count || 0}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#888' }}>Length</div>
                    <div style={{ fontSize: '18px', color: '#fff' }}>{hullData.away?.team_length || 0} m</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#888' }}>Width</div>
                    <div style={{ fontSize: '18px', color: '#fff' }}>{hullData.away?.team_width || 0} m</div>
                  </div>
                </div>
              </div>

              {/* Separation Card */}
              <div style={{ background: '#1e2235', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
                <h3 style={{ color: 'white', marginBottom: '12px', fontSize: '15px' }}>↔ Centroid Distance: <span style={{color: '#4f8ef7'}}>{hullData.centroid_distance} m</span></h3>
                <p style={{ color: '#aaa', fontSize: '14px', lineHeight: '1.4' }}>
                  {getSeparationText(hullData.centroid_distance)}
                </p>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#1a1d2e', borderRadius: '12px', color: '#888' }}>
              Loading frame metrics...
            </div>
          )}
        </div>
      </div>

      {/* TIMELINE CHARTS SECTION */}
      <div className="timeline-section" style={{ background: '#1a1d2e', padding: '20px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ color: 'white' }}>Match Timeline</h3>
          <div className="chart-toggles" style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setChartView('area')}
              style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: chartView === 'area' ? '#4f8ef7' : '#2a2d3e', color: chartView === 'area' ? 'white' : '#ccc', cursor: 'pointer', fontSize: '13px' }}>
              Hull Area Over Time
            </button>
            <button 
              onClick={() => setChartView('distance')}
              style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: chartView === 'distance' ? '#4f8ef7' : '#2a2d3e', color: chartView === 'distance' ? 'white' : '#ccc', cursor: 'pointer', fontSize: '13px' }}>
              Centroid Distance Over Time
            </button>
          </div>
        </div>

        <div style={{ width: '100%', height: '350px', position: 'relative' }}>
          {loadingTimeline && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#1a1d2e', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 10, gap: '16px' }}>
              <Spinner />
              <p style={{ color: '#888', fontSize: '14px' }}>Computing timeline data...</p>
            </div>
          )}
          <div id="hull-timeline-chart" style={{ width: '100%', height: '100%' }}></div>
        </div>
        
        {chartView === 'area' && (
          <p style={{ textAlign: 'center', color: '#888', fontSize: '13px', marginTop: '12px' }}>
            Note: Larger hull = team spread out. Smaller = compact.
          </p>
        )}
      </div>

    </div>
  )
}
