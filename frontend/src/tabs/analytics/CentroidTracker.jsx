import { useState, useEffect, useRef } from 'react'
import { useMatchStore } from '../../store/matchStore'
import { api } from '../../api/client'
import Spinner from '../../components/ui/Spinner'
import PitchSVG from '../../components/pitch/PitchSVG'
import FrameControls from '../../components/controls/FrameControls'
import { fmt } from '../../utils/format'

function getZoneLabel(avgX, avgY) {
  const xZone = avgX < 35 ? 'Defensive Third' : avgX < 70 ? 'Middle Third' : 'Attacking Third'
  const yZone = avgY < 22.7 ? 'Left' : avgY < 45.3 ? 'Central' : 'Right'
  return `${yZone} ${xZone}`
}

function DistanceChart({ timeline, summary, homeColor, awayColor }) {
  if (!timeline || timeline.length === 0) return null

  const W = 700, H = 200, PAD = { top: 20, right: 20, bottom: 40, left: 50 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const minutes = timeline.map(d => d.minute)
  const dists = timeline.map(d => d.centroid_distance)
  const minMin = Math.min(...minutes), maxMin = Math.max(...minutes)
  const minDist = 0, maxDist = Math.max(60, Math.max(...dists))

  const xScale = m => PAD.left + ((m - minMin) / (maxMin - minMin || 1)) * innerW
  const yScale = d => PAD.top + innerH - ((d - minDist) / (maxDist - minDist || 1)) * innerH

  const polyPoints = timeline.map(d => `${xScale(d.minute)},${yScale(d.centroid_distance)}`).join(' ')
  const areaPoints = [
    `${xScale(minMin)},${PAD.top + innerH}`,
    ...timeline.map(d => `${xScale(d.minute)},${yScale(d.centroid_distance)}`),
    `${xScale(maxMin)},${PAD.top + innerH}`
  ].join(' ')

  const refLines = [
    { val: 20, label: 'Compact', color: '#f59e0b' },
    { val: 40, label: 'Separated', color: '#3b82f6' }
  ]

  const htMinute = 45
  const minDistPt = { x: xScale(summary.min_distance_minute), y: yScale(summary.min_centroid_distance) }
  const maxDistPt = { x: xScale(summary.max_distance_minute), y: yScale(summary.max_centroid_distance) }

  const xTicks = []
  for (let m = Math.ceil(minMin / 5) * 5; m <= maxMin; m += 10) xTicks.push(m)

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {/* Area fill */}
      <defs>
        <linearGradient id="distGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#distGrad)" />
      <polyline points={polyPoints} fill="none" stroke="#60a5fa" strokeWidth="1.5" />

      {/* Reference lines */}
      {refLines.map(r => {
        if (r.val > maxDist) return null
        const y = yScale(r.val)
        return (
          <g key={r.val}>
            <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y} stroke={r.color} strokeWidth="1" strokeDasharray="4,3" />
            <text x={PAD.left + innerW + 4} y={y + 4} fill={r.color} fontSize="10">{r.label}</text>
          </g>
        )
      })}

      {/* HT line */}
      {htMinute >= minMin && htMinute <= maxMin && (
        <g>
          <line x1={xScale(htMinute)} y1={PAD.top} x2={xScale(htMinute)} y2={PAD.top + innerH} stroke="#ffffff" strokeWidth="1" strokeDasharray="3,3" strokeOpacity="0.4" />
          <text x={xScale(htMinute) + 3} y={PAD.top + 12} fill="#aaa" fontSize="9">HT</text>
        </g>
      )}

      {/* Min/Max annotations */}
      <circle cx={minDistPt.x} cy={minDistPt.y} r="5" fill="#f59e0b" stroke="#1a1d2e" strokeWidth="1.5" />
      <text x={minDistPt.x + 7} y={minDistPt.y - 4} fill="#f59e0b" fontSize="9">Min {summary.min_centroid_distance}m</text>
      <circle cx={maxDistPt.x} cy={maxDistPt.y} r="5" fill="#ef4444" stroke="#1a1d2e" strokeWidth="1.5" />
      <text x={maxDistPt.x + 7} y={maxDistPt.y - 4} fill="#ef4444" fontSize="9">Max {summary.max_centroid_distance}m</text>

      {/* Axes */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerH} stroke="#444" strokeWidth="1" />
      <line x1={PAD.left} y1={PAD.top + innerH} x2={PAD.left + innerW} y2={PAD.top + innerH} stroke="#444" strokeWidth="1" />

      {xTicks.map(m => (
        <g key={m}>
          <line x1={xScale(m)} y1={PAD.top + innerH} x2={xScale(m)} y2={PAD.top + innerH + 4} stroke="#555" strokeWidth="1" />
          <text x={xScale(m)} y={PAD.top + innerH + 14} fill="#888" fontSize="9" textAnchor="middle">{m}'</text>
        </g>
      ))}

      {[0, 20, 40].map(v => v <= maxDist && (
        <text key={v} x={PAD.left - 6} y={yScale(v) + 4} fill="#888" fontSize="9" textAnchor="end">{v}m</text>
      ))}

      <text x={PAD.left + innerW / 2} y={H - 2} fill="#888" fontSize="10" textAnchor="middle">Match Minute</text>
      <text x={14} y={PAD.top + innerH / 2} fill="#888" fontSize="10" textAnchor="middle" transform={`rotate(-90,14,${PAD.top + innerH / 2})`}>Distance (m)</text>
    </svg>
  )
}

export default function CentroidTracker() {
  const { matchId, metadata, currentFrame } = useMatchStore()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const cachedRef = useRef(null)

  useEffect(() => {
    if (!matchId) return
    if (cachedRef.current?.matchId === matchId) {
      setData(cachedRef.current.data)
      return
    }
    setLoading(true)
    setError(null)
    api.getCentroid(matchId)
      .then(res => {
        setData(res)
        cachedRef.current = { matchId, data: res }
      })
      .catch(err => setError(err.message || 'Failed to load centroid data'))
      .finally(() => setLoading(false))
  }, [matchId])

  if (!metadata) return <div style={{ padding: 32, color: '#888' }}>Loading match data...</div>

  const homeColor = metadata.home_team.jersey_color
  const awayColor = metadata.away_team.jersey_color
  const homeName = metadata.home_team.name
  const awayName = metadata.away_team.name

  // Find current centroid position from timeline by closest frame
  let homeCurrent = null, awayCurrent = null, currentDist = null
  if (data?.timeline?.length) {
    const tl = data.timeline
    // Find timeline entry closest to currentFrame
    let best = tl[0]
    let bestDiff = Math.abs((tl[0].frame || 0) - (currentFrame || 0))
    for (const pt of tl) {
      const diff = Math.abs((pt.frame || 0) - (currentFrame || 0))
      if (diff < bestDiff) { bestDiff = diff; best = pt }
    }
    homeCurrent = { x: best.home_x, y: best.home_y }
    awayCurrent = { x: best.away_x, y: best.away_y }
    currentDist = best.centroid_distance
  }

  return (
    <div style={{ padding: '24px', background: '#0f1117', minHeight: '100vh', color: 'white' }}>
      <h2 style={{ marginBottom: 8, fontSize: 22 }}>Team Centroid Tracker</h2>
      <p style={{ color: '#888', marginBottom: 24, fontSize: 14 }}>
        Average team positions and distance between centroids over the match.
      </p>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <Spinner />
          <p style={{ color: '#888', marginTop: 12 }}>Computing centroid timeline...</p>
        </div>
      )}

      {error && (
        <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 8, padding: 16, marginBottom: 24, color: '#ef4444' }}>
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Info bar */}
          <div className="info-bar" style={{ background: '#1e2235', border: '1px solid #3a3d5e', borderRadius: 8, padding: 16, marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: '20px' }}>ℹ️</span>
            <span style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.5' }}>
              The <strong>centroid</strong> is the geometric center of all outfield players. It shows where each team's "weight" is on the pitch. Closer centroids = teams engaging each other. Trails show where each centroid has been this match.
            </span>
          </div>

          {/* Pitch */}
          <div style={{ background: '#1a1d2e', borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <h3 style={{ marginBottom: 12, fontSize: 15, color: '#ccc' }}>Centroid Paths &amp; Current Position</h3>
            <div style={{ position: 'relative' }}>
              <PitchSVG>
                {/* Full path trails (faded) */}
                <polyline
                  points={data.timeline.map(d => `${d.home_x},${d.home_y}`).join(' ')}
                  fill="none" stroke={homeColor} strokeWidth="0.3" strokeOpacity="0.2"
                />
                <polyline
                  points={data.timeline.map(d => `${d.away_x},${d.away_y}`).join(' ')}
                  fill="none" stroke={awayColor} strokeWidth="0.3" strokeOpacity="0.2"
                />

                {/* Recent trail (last 30 seconds = 300 frames at 10Hz) - higher opacity */}
                {currentFrame && (() => {
                  const recentThreshold = Math.max(0, currentFrame - 300)
                  const recentHome = data.timeline.filter(d => (d.frame || 0) >= recentThreshold && (d.frame || 0) <= currentFrame)
                  const recentAway = data.timeline.filter(d => (d.frame || 0) >= recentThreshold && (d.frame || 0) <= currentFrame)
                  return (
                    <>
                      {recentHome.length > 1 && (
                        <polyline
                          points={recentHome.map(d => `${d.home_x},${d.home_y}`).join(' ')}
                          fill="none" stroke={homeColor} strokeWidth="0.5" strokeOpacity="0.7"
                        />
                      )}
                      {recentAway.length > 1 && (
                        <polyline
                          points={recentAway.map(d => `${d.away_x},${d.away_y}`).join(' ')}
                          fill="none" stroke={awayColor} strokeWidth="0.5" strokeOpacity="0.7"
                        />
                      )}
                    </>
                  )
                })()}

                {/* Current positions */}
                {homeCurrent && (
                  <g>
                    <circle cx={homeCurrent.x} cy={homeCurrent.y} r="1.8" fill={homeColor} stroke="white" strokeWidth="0.3">
                      <animate attributeName="r" values="1.5;1.9;1.5" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                    <text x={homeCurrent.x} y={homeCurrent.y + 0.5} fill="white" fontSize="1.2" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">H</text>
                  </g>
                )}
                {awayCurrent && (
                  <g>
                    <circle cx={awayCurrent.x} cy={awayCurrent.y} r="1.8" fill={awayColor} stroke="white" strokeWidth="0.3">
                      <animate attributeName="r" values="1.5;1.9;1.5" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                    <text x={awayCurrent.x} y={awayCurrent.y + 0.5} fill="white" fontSize="1.2" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">A</text>
                  </g>
                )}

                {/* Dashed line between centroids with distance label */}
                {homeCurrent && awayCurrent && (
                  <g>
                    <line
                      x1={homeCurrent.x} y1={homeCurrent.y}
                      x2={awayCurrent.x} y2={awayCurrent.y}
                      stroke="white" strokeWidth="0.3" strokeDasharray="1.5,1" strokeOpacity="0.35"
                    />
                    <text
                      x={(homeCurrent.x + awayCurrent.x) / 2}
                      y={(homeCurrent.y + awayCurrent.y) / 2 - 1.2}
                      fill="white" fontSize="1.5" textAnchor="middle" fontWeight="bold"
                      style={{ textShadow: '0 0 4px #000' }}
                    >
                      {currentDist?.toFixed(1)}m
                    </text>
                  </g>
                )}
              </PitchSVG>
            </div>

          </div>

          {/* Frame controls */}
          <FrameControls />

          {/* Live centroid coordinate card */}
          {homeCurrent && awayCurrent && (
            <div className="centroid-live-card" style={{ background: '#1a1d2e', borderRadius: 12, padding: 20, marginTop: 24, marginBottom: 24 }}>
              <h4 style={{ fontSize: 14, color: '#888', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Live Centroid Positions (Frame {currentFrame || 0})
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div className="centroid-stat" style={{ background: '#111827', borderRadius: 8, padding: 16, borderLeft: `4px solid ${homeColor}` }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                    <span style={{ color: homeColor }}>●</span> {metadata.home_team.short_name} centroid
                  </div>
                  <div style={{ fontSize: 14, color: 'white' }}>
                    x={fmt.coord(homeCurrent.x)} m
                  </div>
                  <div style={{ fontSize: 14, color: 'white' }}>
                    y={fmt.coord(homeCurrent.y)} m
                  </div>
                </div>
                <div className="centroid-stat" style={{ background: '#111827', borderRadius: 8, padding: 16, borderLeft: `4px solid ${awayColor}` }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                    <span style={{ color: awayColor }}>●</span> {metadata.away_team.short_name} centroid
                  </div>
                  <div style={{ fontSize: 14, color: 'white' }}>
                    x={fmt.coord(awayCurrent.x)} m
                  </div>
                  <div style={{ fontSize: 14, color: 'white' }}>
                    y={fmt.coord(awayCurrent.y)} m
                  </div>
                </div>
                <div className="centroid-stat" style={{ background: '#111827', borderRadius: 8, padding: 16, borderLeft: '4px solid #60a5fa' }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                    ↔ Distance
                  </div>
                  <div style={{ fontSize: 22, color: '#60a5fa', fontWeight: 'bold' }}>
                    {currentDist ? fmt.coord(currentDist) : '—'} m
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Territory cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {[
              { team: homeName, color: homeColor, avgX: data.summary.home_avg_x, avgY: data.summary.home_avg_y },
              { team: awayName, color: awayColor, avgX: data.summary.away_avg_x, avgY: data.summary.away_avg_y }
            ].map(t => (
              <div key={t.team} style={{ background: '#1a1d2e', borderRadius: 12, padding: 20, borderTop: `4px solid ${t.color}` }}>
                <div style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>{t.team} — Average Territory</div>
                <div style={{ fontSize: 16, fontWeight: 'bold', color: 'white' }}>
                  {getZoneLabel(t.avgX, t.avgY)}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  Avg position: x={t.avgX}m, y={t.avgY}m
                </div>
              </div>
            ))}
          </div>

          {/* Distance chart */}
          <div style={{ background: '#1a1d2e', borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16, fontSize: 15, color: '#ccc' }}>
              Centroid Distance Over Match
            </h3>
            <DistanceChart
              timeline={data.timeline}
              summary={data.summary}
              homeColor={homeColor}
              awayColor={awayColor}
            />
            {/* Summary stats row */}
            <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Avg Distance', value: `${data.summary.avg_centroid_distance}m` },
                { label: `Min Distance`, value: `${data.summary.min_centroid_distance}m`, sub: `at min ${data.summary.min_distance_minute}` },
                { label: `Max Distance`, value: `${data.summary.max_centroid_distance}m`, sub: `at min ${data.summary.max_distance_minute}` }
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: '#111827', borderRadius: 8, padding: '12px 16px', minWidth: 140 }}>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 'bold', color: '#60a5fa', marginTop: 4 }}>{s.value}</div>
                  {s.sub && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{s.sub}</div>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
