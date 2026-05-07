import { useState, useEffect, useRef, useCallback } from 'react'
import { useMatchStore } from '../../store/matchStore'
import { api } from '../../api/client'
import Spinner from '../../components/ui/Spinner'
import PitchSVG from '../../components/pitch/PitchSVG'

const SPEED_COLORS = {
  SLOW: '#888888',
  MEDIUM: '#4CAF50',
  FAST: '#FF9800',
  VERY_FAST: '#F44336',
}

const SPEED_LABELS = {
  SLOW: 'Slow (<10)',
  MEDIUM: 'Medium (10-40)',
  FAST: 'Fast (40-80)',
  VERY_FAST: 'Very Fast (80+)',
}

const PRESETS = [
  { label: 'Kickoff (0-5)', period: 1, start: 0, end: 5 },
  { label: 'First 10 min', period: 1, start: 0, end: 10 },
  { label: 'HT -5 (40-45)', period: 1, start: 40, end: 45 },
  { label: 'Last 5 min', period: 2, start: 85, end: 90 },
]

function TrajectoryOverlay({ points, contextPlayers, homeColor, awayColor }) {
  if (!points || points.length < 2) return null

  // Draw colored segments between consecutive points
  const segments = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    segments.push(
      <line key={i}
        x1={a.x_m} y1={a.y_m} x2={b.x_m} y2={b.y_m}
        stroke={SPEED_COLORS[b.speed_class] || '#888'}
        strokeWidth="0.5" strokeOpacity="0.85"
      />
    )
  }

  const start = points[0], end = points[points.length - 1]

  // Touch events: use is_touch flag from backend
  const touchDots = points
    .filter(p => p.is_touch)
    .map((p, i) => (
      <g key={`touch-${i}`}>
        <circle cx={p.x_m} cy={p.y_m} r="0.5" fill="white" opacity="0.7" />
        {p.nearest_player && (
          <text
            x={p.x_m} y={p.y_m - 1.5}
            fontSize="1.2" fill="white" opacity="0.8"
            textAnchor="middle"
            stroke="#1a1d2e" strokeWidth="0.4" paintOrder="stroke">
            {p.nearest_player}
          </text>
        )}
      </g>
    ))

  return (
    <g>
      {/* Faded player context dots at start of window */}
      {contextPlayers?.filter(p => p.player_id !== -1).map(p => (
        <circle key={p.player_id}
          cx={p.x_m} cy={p.y_m} r={0.7}
          fill={p.team === 'home' ? homeColor : awayColor}
          opacity={0.3}
          stroke="white" strokeWidth={0.1}
        />
      ))}
      {segments}
      {touchDots}
      {/* Start */}
      <circle cx={start.x_m} cy={start.y_m} r="0.9" fill="#22c55e" stroke="white" strokeWidth="0.2" />
      <text x={start.x_m + 1.2} y={start.y_m + 0.5} fill="#22c55e" fontSize="1.3" fontWeight="bold">▶</text>
      {/* End */}
      <circle cx={end.x_m} cy={end.y_m} r="0.9" fill="#ef4444" stroke="white" strokeWidth="0.2" />
      <text x={end.x_m + 1.2} y={end.y_m + 0.5} fill="#ef4444" fontSize="1.3" fontWeight="bold">■</text>
      {/* Speed legend */}
      {Object.entries(SPEED_COLORS).map(([cls, color], i) => (
        <g key={cls}>
          <circle cx={3} cy={3 + i * 3.5} r="0.8" fill={color} />
          <text x={5} y={3.5 + i * 3.5} fill="white" fontSize="1.2">{SPEED_LABELS[cls]} km/h</text>
        </g>
      ))}
    </g>
  )
}

export default function BallTrajectory() {
  const { matchId, metadata } = useMatchStore()
  const [period, setPeriod] = useState(1)
  const [startMin, setStartMin] = useState(0)
  const [endMin, setEndMin] = useState(5)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [animating, setAnimating] = useState(false)
  const [animFrame, setAnimFrame] = useState(0)
  const animRef = useRef(null)
  const warned = useRef(false)

  const fetchData = useCallback(() => {
    if (!matchId) return
    let sMn = startMin, eMn = endMin
    if (eMn - sMn > 10) {
      eMn = sMn + 10
      setEndMin(eMn)
      warned.current = true
    } else {
      warned.current = false
    }
    setLoading(true)
    setError(null)
    setAnimating(false)
    setAnimFrame(0)
    api.getBallTrajectory(matchId, period, sMn, eMn)
      .then(res => setData(res))
      .catch(err => setError(err.message || 'Failed to load trajectory'))
      .finally(() => setLoading(false))
  }, [matchId, period, startMin, endMin])

  const applyPreset = (preset) => {
    setPeriod(preset.period)
    setStartMin(preset.start)
    setEndMin(preset.end)
  }

  // Trigger fetch after preset applied
  useEffect(() => {}, [period, startMin, endMin])

  const toggleAnimate = () => {
    if (animating) {
      clearInterval(animRef.current)
      setAnimating(false)
      return
    }
    if (!data?.points?.length) return
    setAnimFrame(0)
    setAnimating(true)
    animRef.current = setInterval(() => {
      setAnimFrame(f => {
        if (f >= data.points.length - 1) {
          clearInterval(animRef.current)
          setAnimating(false)
          return f
        }
        return f + 1
      })
    }, 80)
  }

  useEffect(() => () => clearInterval(animRef.current), [])

  const pts = data?.points || []
  const displayPoints = animating ? pts.slice(0, animFrame + 1) : pts
  const currentSpeed = animating && pts[animFrame] ? pts[animFrame].speed_kmh : null

  const stats = data?.stats || {}
  const dist = data?.speed_distribution || {}

  return (
    <div style={{ padding: '24px', background: '#0f1117', minHeight: '100vh', color: 'white' }}>
      <h2 style={{ marginBottom: 8, fontSize: 22 }}>Ball Trajectory</h2>
      <p style={{ color: '#888', marginBottom: 20, fontSize: 14 }}>
        Ball path, speed classification, and movement stats for any time window.
      </p>

      {/* Controls */}
      <div style={{ background: '#1a1d2e', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        {/* Period */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[1, 2].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #333',
                background: period === p ? '#3b82f6' : 'transparent',
                color: 'white', cursor: 'pointer', fontSize: 14 }}>
              Period {p}
            </button>
          ))}
        </div>

        {/* Minute range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, color: '#aaa' }}>From:</label>
          <input type="number" min="0" max="97" value={startMin}
            onChange={e => setStartMin(parseFloat(e.target.value) || 0)}
            style={{ width: 70, padding: '6px 10px', borderRadius: 6, background: '#111827', border: '1px solid #333', color: 'white' }} />
          <label style={{ fontSize: 13, color: '#aaa' }}>To:</label>
          <input type="number" min="0" max="97" value={endMin}
            onChange={e => setEndMin(parseFloat(e.target.value) || 5)}
            style={{ width: 70, padding: '6px 10px', borderRadius: 6, background: '#111827', border: '1px solid #333', color: 'white' }} />
          <span style={{ fontSize: 11, color: '#666' }}>Max 10 min window</span>
          <button onClick={fetchData} disabled={loading}
            style={{ padding: '8px 20px', borderRadius: 8, background: '#3b82f6', border: 'none', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 'bold' }}>
            {loading ? '...' : '▶ Show Trajectory'}
          </button>
        </div>

        {warned.current && (
          <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 8 }}>
            Max 10 minutes. Showing first 10 minutes of selected range.
          </div>
        )}

        {/* Presets */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => { applyPreset(p) }}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #334155',
                background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 8, padding: 12, marginBottom: 16, color: '#ef4444', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Pitch */}
      <div style={{ background: '#1a1d2e', borderRadius: 12, padding: 16, marginBottom: 16, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: '#ccc' }}>
            {pts.length > 0 ? `Trajectory: ${startMin}-${endMin} min (P${period})` : 'Ball Trajectory'}
          </h3>
          {pts.length > 0 && (
            <button onClick={toggleAnimate}
              style={{ padding: '6px 16px', borderRadius: 8, background: animating ? '#f59e0b' : '#6366f1', border: 'none', color: 'white', cursor: 'pointer', fontSize: 13 }}>
              {animating ? '⏸ Pause' : '▶ Animate Ball'}
            </button>
          )}
        </div>

        {loading && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10 }}>
            <Spinner />
          </div>
        )}

        {animating && currentSpeed !== null && (
          <div style={{ position: 'absolute', top: 56, right: 32, background: 'rgba(0,0,0,0.7)', padding: '6px 12px', borderRadius: 8, fontSize: 13, color: '#f59e0b', zIndex: 10 }}>
            ⚡ {currentSpeed.toFixed(1)} km/h
          </div>
        )}

        <PitchSVG>
          {pts.length > 0
            ? <TrajectoryOverlay
                points={displayPoints}
                contextPlayers={data?.context_players}
                homeColor={metadata?.home_team?.jersey_color || '#3b82f6'}
                awayColor={metadata?.away_team?.jersey_color || '#ef4444'}
              />
            : (
              <text x="52.5" y="34" fill="#555" fontSize="3" textAnchor="middle">
                Select a time window above and click Show Trajectory
              </text>
            )
          }
        </PitchSVG>
      </div>

      {/* Possession legend */}
      {pts.length > 0 && (
        <div style={{ background: '#1a1d2e', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: '#aaa', display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <span>🔵 Faded dots = player positions at start of window</span>
          <span>⚪ White rings = estimated touch points</span>
          <span>🏷️ Player labels at touch points = nearest player</span>
        </div>
      )}

      {/* Stats row */}
      {pts.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Max Speed', value: `${stats.max_speed_kmh} km/h`, icon: '⚡' },
              { label: 'Distance', value: `${stats.distance_covered_m} m`, icon: '📏' },
              { label: 'Est. Touches', value: stats.estimated_touches, icon: '👟' },
              { label: 'Duration', value: `${(endMin - startMin).toFixed(0)} min`, icon: '⏱' },
              { label: 'Avg Speed', value: `${stats.avg_speed_kmh} km/h`, icon: '📊' },
            ].map(s => (
              <div key={s.label} style={{ background: '#1a1d2e', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 'bold', color: '#60a5fa' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Speed distribution bar */}
          <div style={{ background: '#1a1d2e', borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontSize: 14, color: '#ccc', marginBottom: 12 }}>Speed Distribution</h3>
            <div style={{ display: 'flex', height: 28, borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
              {[
                { cls: 'SLOW', pct: dist.slow_pct },
                { cls: 'MEDIUM', pct: dist.medium_pct },
                { cls: 'FAST', pct: dist.fast_pct },
                { cls: 'VERY_FAST', pct: dist.very_fast_pct },
              ].filter(s => s.pct > 0).map(s => (
                <div key={s.cls}
                  style={{ width: `${s.pct}%`, background: SPEED_COLORS[s.cls], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white', fontWeight: 'bold', minWidth: s.pct > 5 ? undefined : 0 }}>
                  {s.pct > 8 ? `${s.pct}%` : ''}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#aaa', flexWrap: 'wrap' }}>
              {Object.entries(SPEED_COLORS).map(([cls, color]) => (
                <span key={cls}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 5 }}></span>
                  {SPEED_LABELS[cls]} km/h — {dist[cls.toLowerCase() + '_pct'] ?? 0}%
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {!pts.length && !loading && !error && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#555', fontSize: 14 }}>
          Select a time window above and click <strong style={{ color: '#3b82f6' }}>▶ Show Trajectory</strong>
        </div>
      )}
    </div>
  )
}
