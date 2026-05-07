import { useState, useEffect, useRef } from 'react'
import { useMatchStore } from '../../store/matchStore'
import { api } from '../../api/client'
import Spinner from '../../components/ui/Spinner'
import PitchSVG from '../../components/pitch/PitchSVG'
import VoronoiOverlay from '../../components/pitch/VoronoiOverlay'
import PitchOrientation from '../../components/pitch/PitchOrientation'
import { fmt } from '../../utils/format'

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

function AreaChart({ timeline, homeName, awayName, homeColor, awayColor }) {
  if (!timeline || timeline.length === 0) return null

  const W = 680, H = 180, PAD = { top: 16, right: 16, bottom: 36, left: 48 }
  const iW = W - PAD.left - PAD.right
  const iH = H - PAD.top - PAD.bottom

  const minutes = timeline.map(d => d.minute)
  const minM = Math.min(...minutes), maxM = Math.max(...minutes)
  const xS = m => PAD.left + ((m - minM) / (maxM - minM || 1)) * iW
  const yS = pct => PAD.top + iH - (pct / 100) * iH

  // Build stacked area: home from bottom, away stacked on top (always = 100%)
  const homeArea = [
    `${xS(minM)},${yS(0)}`,
    ...timeline.map(d => `${xS(d.minute)},${yS(d.home_pct)}`),
    `${xS(maxM)},${yS(0)}`
  ].join(' ')

  const awayArea = [
    ...timeline.map(d => `${xS(d.minute)},${yS(d.home_pct)}`),
    `${xS(maxM)},${yS(100)}`,
    `${xS(minM)},${yS(100)}`
  ].join(' ')

  const xTicks = []
  for (let m = Math.ceil(minM / 10) * 10; m <= maxM; m += 10) xTicks.push(m)
  const htX = xS(45)

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        <clipPath id="chartClip">
          <rect x={PAD.left} y={PAD.top} width={iW} height={iH} />
        </clipPath>
      </defs>

      <polygon points={homeArea} fill={homeColor} fillOpacity="0.7" clipPath="url(#chartClip)" />
      <polygon points={awayArea} fill={awayColor} fillOpacity="0.7" clipPath="url(#chartClip)" />

      {/* 50% line */}
      <line x1={PAD.left} y1={yS(50)} x2={PAD.left + iW} y2={yS(50)}
        stroke="white" strokeWidth="1" strokeDasharray="4,3" strokeOpacity="0.6" />
      <text x={PAD.left + iW + 3} y={yS(50) + 4} fill="white" fontSize="9" opacity="0.7">50%</text>

      {/* HT line */}
      {45 >= minM && 45 <= maxM && (
        <g>
          <line x1={htX} y1={PAD.top} x2={htX} y2={PAD.top + iH}
            stroke="white" strokeWidth="1" strokeDasharray="2,2" strokeOpacity="0.4" />
          <text x={htX + 2} y={PAD.top + 10} fill="#aaa" fontSize="8">HT</text>
        </g>
      )}

      {/* Axes */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + iH} stroke="#444" strokeWidth="1" />
      <line x1={PAD.left} y1={PAD.top + iH} x2={PAD.left + iW} y2={PAD.top + iH} stroke="#444" strokeWidth="1" />

      {[0, 25, 50, 75, 100].map(v => (
        <text key={v} x={PAD.left - 4} y={yS(v) + 4} fill="#888" fontSize="9" textAnchor="end">{v}%</text>
      ))}

      {xTicks.map(m => (
        <g key={m}>
          <line x1={xS(m)} y1={PAD.top + iH} x2={xS(m)} y2={PAD.top + iH + 4} stroke="#555" strokeWidth="1" />
          <text x={xS(m)} y={PAD.top + iH + 14} fill="#888" fontSize="9" textAnchor="middle">{m}'</text>
        </g>
      ))}

      <text x={PAD.left + iW / 2} y={H - 2} fill="#888" fontSize="10" textAnchor="middle">Match Minute</text>
      <text x={14} y={PAD.top + iH / 2} fill="#888" fontSize="10" textAnchor="middle"
        transform={`rotate(-90,14,${PAD.top + iH / 2})`}>Space Control %</text>

      {/* Team labels inside chart */}
      <text x={PAD.left + 8} y={yS(timeline[Math.floor(timeline.length / 2)]?.home_pct / 2 || 25)} fill="white" fontSize="10" fontWeight="bold" opacity="0.8">{homeName}</text>
      <text x={PAD.left + 8} y={yS(100 - (timeline[Math.floor(timeline.length / 2)]?.away_pct / 2 || 25))} fill="white" fontSize="10" fontWeight="bold" opacity="0.8">{awayName}</text>
    </svg>
  )
}

function MomentumBar({ blocks, homeColor, awayColor, totalMinutes }) {
  if (!blocks || blocks.length === 0) return null
  const maxMin = blocks[blocks.length - 1]?.end_min || 90

  return (
    <div style={{ position: 'relative', height: 40, marginBottom: 8 }}>
      <div style={{ display: 'flex', height: 32, borderRadius: 6, overflow: 'hidden' }}>
        {blocks.map((b, i) => {
          const width = ((b.end_min - b.start_min) / maxMin) * 100
          const bg = b.dominant_team === 'home' ? homeColor
            : b.dominant_team === 'away' ? awayColor
            : '#444'
          return (
            <div key={i} title={`${b.start_min}-${b.end_min} min: ${b.label} (Home ${b.home_pct}%)`}
              style={{ width: `${width}%`, background: bg, opacity: b.dominant_team === 'contested' ? 0.5 : 0.85,
                borderRight: '1px solid #1a1d2e', cursor: 'default', flexShrink: 0 }} />
          )
        })}
      </div>
      {/* Minute labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 10, color: '#666' }}>
        {[0, 15, 30, 45, 60, 75, 90].filter(m => m <= maxMin).map(m => (
          <span key={m}>{m}'</span>
        ))}
      </div>
    </div>
  )
}

export default function SpaceControl() {
  const { matchId, metadata, pitchDimensions } = useMatchStore()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [snapshotMinute, setSnapshotMinute] = useState(45)
  const debouncedSnapshot = useDebounce(snapshotMinute, 400)
  const [snapshotData, setSnapshotData] = useState(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const cachedRef = useRef(null)

  useEffect(() => {
    if (!matchId) return
    if (cachedRef.current?.matchId === matchId) {
      setData(cachedRef.current.data)
      return
    }
    setLoading(true)
    setError(null)
    api.getSpaceControlTimeline(matchId)
      .then(res => {
        setData(res)
        cachedRef.current = { matchId, data: res }
      })
      .catch(err => setError(err.message || 'Failed to compute space control'))
      .finally(() => setLoading(false))
  }, [matchId])

  // Auto-fetch snapshot when debounced minute changes
  useEffect(() => {
    if (!matchId || !metadata || !data?.timeline?.length) return

    const tl = data.timeline
    let best = tl[0]
    let bestDiff = Math.abs(tl[0].minute - debouncedSnapshot)
    for (const pt of tl) {
      const d = Math.abs(pt.minute - debouncedSnapshot)
      if (d < bestDiff) { bestDiff = d; best = pt }
    }

    setSnapshotLoading(true)
    api.getVoronoiFrame(matchId, best.frame)
      .then(res => setSnapshotData(res))
      .catch(err => console.error('Snapshot error', err))
      .finally(() => setSnapshotLoading(false))
  }, [matchId, metadata, data, debouncedSnapshot])

  if (!metadata) return <div style={{ padding: 32, color: '#888' }}>Loading match data...</div>

  const homeColor = metadata.home_team.jersey_color
  const awayColor = metadata.away_team.jersey_color
  const homeName = metadata.home_team.name
  const awayName = metadata.away_team.name

  return (
    <div style={{ padding: '24px', background: '#0f1117', minHeight: '100vh', color: 'white' }}>
      <h2 style={{ marginBottom: 8, fontSize: 22 }}>Space Control Over Time</h2>
      <p style={{ color: '#888', marginBottom: 24, fontSize: 14 }}>
        Voronoi-based territory control across the match.
      </p>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <Spinner />
          <p style={{ color: '#aaa', marginTop: 16, fontSize: 15 }}>Computing space control for each frame...</p>
          <p style={{ color: '#666', marginTop: 6, fontSize: 13 }}>This takes ~20 seconds on first load.</p>
        </div>
      )}

      {error && (
        <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 8, padding: 16, marginBottom: 24, color: '#ef4444' }}>
          Space control could not be computed. {error}. Try refreshing.
        </div>
      )}

      {data && (
        <>
          {/* Two-column layout: chart + pitch */}
          <div className="space-control-layout" style={{ display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>

            {/* Left column: Chart + Momentum */}
            <div className="space-control-chart" style={{ flex: '1 1 55%', minWidth: 400, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Area chart */}
              <div style={{ background: '#1a1d2e', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 15, color: '#ccc', margin: 0 }}>Space Control Over Match</h3>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                    <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: homeColor, marginRight: 5 }}></span>{homeName}</span>
                    <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: awayColor, marginRight: 5 }}></span>{awayName}</span>
                  </div>
                </div>
                <AreaChart timeline={data.timeline} homeName={homeName} awayName={awayName} homeColor={homeColor} awayColor={awayColor} />
              </div>

              {/* Momentum bar */}
              <div style={{ background: '#1a1d2e', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 15, color: '#ccc', margin: 0 }}>Momentum Map</h3>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#aaa' }}>
                    <span><span style={{ display: 'inline-block', width: 10, height: 10, background: homeColor, marginRight: 4 }}></span>Home dominant</span>
                    <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#444', marginRight: 4 }}></span>Contested</span>
                    <span><span style={{ display: 'inline-block', width: 10, height: 10, background: awayColor, marginRight: 4 }}></span>Away dominant</span>
                  </div>
                </div>
                <MomentumBar blocks={data.momentum_blocks} homeColor={homeColor} awayColor={awayColor} />
              </div>
            </div>

            {/* Right column: Pitch snapshot */}
            <div className="space-control-pitch" style={{ flex: '1 1 40%', minWidth: 350 }}>
              <div style={{ background: '#1a1d2e', borderRadius: 12, padding: 20 }}>
                <h3 style={{ fontSize: 15, color: '#ccc', marginBottom: 4 }}>
                  Space Control at Minute <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{snapshotMinute}</span>
                </h3>
                <div style={{ position: 'relative' }}>
                  {snapshotLoading && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(26,29,46,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                      <Spinner />
                    </div>
                  )}
                  <PitchSVG pitchLength={pitchDimensions.length} pitchWidth={pitchDimensions.width}>
                    {snapshotData && (
                      <VoronoiOverlay
                        voronoiData={snapshotData}
                        homeColor={homeColor}
                        awayColor={awayColor}
                        showLines={true}
                      />
                    )}
                    <PitchOrientation
                      homeTeamName={metadata.home_team.short_name}
                      awayTeamName={metadata.away_team.short_name}
                      homeColor={homeColor}
                      awayColor={awayColor}
                      pitchLength={pitchDimensions.length}
                      pitchWidth={pitchDimensions.width}
                    />
                  </PitchSVG>
                </div>

                {/* Minute slider */}
                <div style={{ marginTop: 16 }}>
                  <input
                    type="range"
                    min="0" max="97" step="1"
                    value={snapshotMinute}
                    onChange={e => setSnapshotMinute(parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: 11, color: '#666', marginTop: 4, textAlign: 'center' }}>
                    Drag to explore space control over the match
                  </div>
                </div>

                {/* Snapshot territory cards */}
                {snapshotData?.summary && (
                  <div className="snapshot-summary" style={{ display: 'flex', gap: 12, marginTop: 16, justifyContent: 'space-around' }}>
                    <span style={{ color: homeColor, fontSize: 14, fontWeight: 'bold' }}>
                      {metadata.home_team.short_name}: {fmt.pct(snapshotData.summary.home_pct)}
                    </span>
                    <span style={{ color: awayColor, fontSize: 14, fontWeight: 'bold' }}>
                      {metadata.away_team.short_name}: {fmt.pct(snapshotData.summary.away_pct)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: `${homeName} Space`, value: `${data.summary.overall_home_pct}%`, color: homeColor },
              { label: `${awayName} Space`, value: `${data.summary.overall_away_pct}%`, color: awayColor },
              { label: 'Home Dominant', value: `${data.summary.home_dominant_minutes} min` },
              { label: 'Key Period', value: data.summary.most_dominant_period, small: true },
            ].map(s => (
              <div key={s.label} style={{ background: '#1a1d2e', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: s.small ? 13 : 22, fontWeight: 'bold', color: s.color || '#60a5fa', lineHeight: 1.2 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
