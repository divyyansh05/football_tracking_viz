import { useState, useEffect, useRef } from 'react'
import { useMatchStore } from '../../store/matchStore'
import { api } from '../../api/client'
import Spinner from '../../components/ui/Spinner'

const ZONE_COLORS = {
  walking_km: '#64748b',
  jogging_km: '#22c55e',
  running_km: '#3b82f6',
  high_speed_km: '#f59e0b',
  sprint_km: '#ef4444',
}

const ZONE_LABELS = {
  walking_km: 'Walking',
  jogging_km: 'Jogging',
  running_km: 'Running',
  high_speed_km: 'High Speed',
  sprint_km: 'Sprint',
}

const SORT_OPTIONS = [
  { value: 'total_distance_km', label: 'Total Distance' },
  { value: 'max_speed_kmh', label: 'Top Speed' },
  { value: 'sprint_count', label: 'Sprints' },
  { value: 'high_intensity_distance_m', label: 'High Intensity' },
  { value: 'p1_distance_km', label: 'P1 Distance' },
  { value: 'p2_distance_km', label: 'P2 Distance' },
]

function ZoneBar({ player, maxDist }) {
  const zones = ['walking_km', 'jogging_km', 'running_km', 'high_speed_km', 'sprint_km']
  const total = zones.reduce((s, z) => s + (player[z] || 0), 0) || 1
  return (
    <div style={{ display: 'flex', height: 16, borderRadius: 4, overflow: 'hidden', marginTop: 6 }}>
      {zones.map(z => {
        const w = ((player[z] || 0) / total) * 100
        if (w < 0.5) return null
        return (
          <div key={z} style={{ width: `${w}%`, background: ZONE_COLORS[z] }}
            title={`${ZONE_LABELS[z]}: ${player[z]} km`} />
        )
      })}
    </div>
  )
}

function InlineDistBar({ value, max, color }) {
  const pct = Math.min((value / (max || 1)) * 100, 100)
  return (
    <div style={{ width: '100%', height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
    </div>
  )
}

export default function PhysicalDashboard() {
  const { matchId, metadata } = useMatchStore()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [teamFilter, setTeamFilter] = useState('both')
  const [sortBy, setSortBy] = useState('total_distance_km')
  const [sortAsc, setSortAsc] = useState(false)
  const [expandedRow, setExpandedRow] = useState(null)
  const [zoneOpen, setZoneOpen] = useState(false)
  const cachedRef = useRef(null)

  useEffect(() => {
    if (!matchId) return
    if (cachedRef.current?.matchId === matchId) {
      setData(cachedRef.current.data)
      return
    }
    setLoading(true)
    setError(null)
    api.getPhysicalSummary(matchId)
      .then(res => {
        setData(res)
        cachedRef.current = { matchId, data: res }
      })
      .catch(err => setError(err.message || 'Failed to load physical data'))
      .finally(() => setLoading(false))
  }, [matchId])

  if (!metadata) return <div style={{ padding: 32, color: '#888' }}>Loading...</div>

  const homeColor = metadata.home_team.jersey_color
  const awayColor = metadata.away_team.jersey_color
  const homeName = metadata.home_team.name
  const awayName = metadata.away_team.name

  const getTeamColor = (team) => team === 'home' ? homeColor : awayColor

  let players = data?.players || []

  // Filter
  if (teamFilter !== 'both') {
    players = players.filter(p => p.team === teamFilter)
  }

  // Sort
  players = [...players].sort((a, b) => {
    const av = a[sortBy] ?? 0, bv = b[sortBy] ?? 0
    return sortAsc ? av - bv : bv - av
  })

  const maxDist = Math.max(...(data?.players || []).map(p => p.total_distance_km), 1)
  const records = data?.match_records || {}

  return (
    <div style={{ padding: '24px', background: '#0f1117', minHeight: '100vh', color: 'white' }}>
      <h2 style={{ marginBottom: 8, fontSize: 22 }}>Physical Dashboard</h2>
      <p style={{ color: '#888', marginBottom: 20, fontSize: 14 }}>Distance, speed, and sprint data for all players.</p>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spinner />
          <p style={{ color: '#aaa', marginTop: 12 }}>Computing physical data for all players...</p>
        </div>
      )}

      {error && (
        <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 8, padding: 12, marginBottom: 16, color: '#ef4444', fontSize: 13 }}>{error}</div>
      )}

      {data && (
        <>
          {/* Records banner */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { icon: '🏃', label: 'Most Distance', name: records.most_distance?.name, team: records.most_distance?.team, val: `${records.most_distance?.distance_km} km` },
              { icon: '⚡', label: 'Top Speed', name: records.fastest_player?.name, team: records.fastest_player?.team, val: `${records.fastest_player?.speed_kmh} km/h` },
              { icon: '🔥', label: 'Most Sprints', name: records.most_sprints?.name, team: records.most_sprints?.team, val: `${records.most_sprints?.count} sprints` },
            ].map(r => (
              <div key={r.label} style={{ background: '#1a1d2e', borderRadius: 12, padding: 16, borderTop: `4px solid ${getTeamColor(r.team)}` }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{r.icon}</div>
                <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{r.label}</div>
                <div style={{ fontSize: 18, fontWeight: 'bold', marginTop: 4, color: 'white' }}>{r.val}</div>
                <div style={{ fontSize: 12, marginTop: 2 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: getTeamColor(r.team), marginRight: 5 }}></span>
                  {r.name}
                </div>
              </div>
            ))}
          </div>

          {/* Table controls */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {['both', 'home', 'away'].map(f => (
              <button key={f} onClick={() => setTeamFilter(f)}
                style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${f === 'home' ? homeColor : f === 'away' ? awayColor : '#334155'}`,
                  background: teamFilter === f ? (f === 'home' ? homeColor : f === 'away' ? awayColor : '#334155') : 'transparent',
                  color: 'white', cursor: 'pointer', fontSize: 13, textTransform: 'capitalize' }}>
                {f === 'both' ? 'Both Teams' : f === 'home' ? homeName : awayName}
              </button>
            ))}

            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, background: '#1a1d2e', border: '1px solid #334155', color: 'white', fontSize: 13, marginLeft: 'auto' }}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <button onClick={() => setSortAsc(v => !v)}
              style={{ padding: '6px 12px', borderRadius: 8, background: '#1a1d2e', border: '1px solid #334155', color: 'white', cursor: 'pointer', fontSize: 13 }}>
              {sortAsc ? '↑ Asc' : '↓ Desc'}
            </button>
          </div>

          {/* Table */}
          <div style={{ background: '#1a1d2e', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155', color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>#</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Player</th>
                    <th style={{ padding: '10px 12px' }}>Pos</th>
                    <th style={{ padding: '10px 12px' }} title="Minutes played">Min</th>
                    <th style={{ padding: '10px 12px' }}>Total KM</th>
                    <th style={{ padding: '10px 12px' }}>P1 KM</th>
                    <th style={{ padding: '10px 12px' }}>P2 KM</th>
                    <th style={{ padding: '10px 12px' }} title="High Speed Running">HSR KM</th>
                    <th style={{ padding: '10px 12px' }}>Sprints</th>
                    <th style={{ padding: '10px 12px' }}>Top Speed</th>
                    <th style={{ padding: '10px 12px', minWidth: 80 }}>Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, i) => {
                    const tc = getTeamColor(p.team)
                    const isExpanded = expandedRow === p.player_id
                    return (
                      <>
                        <tr key={p.player_id}
                          onClick={() => setExpandedRow(isExpanded ? null : p.player_id)}
                          style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer',
                            background: isExpanded ? '#1e293b' : i % 2 === 0 ? 'transparent' : '#151a28' }}>
                          <td style={{ padding: '10px 12px', color: '#555' }}>{i + 1}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 3, height: 16, background: tc, borderRadius: 2, display: 'inline-block', flexShrink: 0 }}></span>
                              <span style={{ fontWeight: 'bold' }}>{p.name}</span>
                              {p.minutes_played < 80 && (
                                <span className="sub-badge" title="Substitute (played &lt;80 min)">SUB</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>{p.position}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8' }}>{p.minutes_played}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold', color: tc }}>{p.total_distance_km}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8' }}>{p.p1_distance_km}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8' }}>{p.p2_distance_km}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: '#f59e0b' }}>{p.high_speed_km}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: '#ef4444', fontWeight: 'bold' }}>{p.sprint_count}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: '#60a5fa' }}>{p.max_speed_kmh}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <InlineDistBar value={p.total_distance_km} max={maxDist} color={tc} />
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${p.player_id}-expand`} style={{ background: '#1e293b' }}>
                            <td colSpan={11} style={{ padding: '12px 20px' }}>
                              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>Zone Breakdown — {p.name}</div>
                              <ZoneBar player={p} maxDist={maxDist} />
                              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, flexWrap: 'wrap' }}>
                                {['walking_km','jogging_km','running_km','high_speed_km','sprint_km'].map(z => (
                                  <span key={z}>
                                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: ZONE_COLORS[z], marginRight: 4 }}></span>
                                    {ZONE_LABELS[z]}: <strong>{p[z]} km</strong>
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Comparison charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* Distance chart */}
            <div style={{ background: '#1a1d2e', borderRadius: 12, padding: 16 }}>
              <h3 style={{ fontSize: 14, color: '#ccc', marginBottom: 12 }}>Total Distance (km)</h3>
              <div style={{ overflowY: 'auto', maxHeight: 300 }}>
                {[...players].sort((a,b) => b.total_distance_km - a.total_distance_km).map(p => (
                  <div key={p.player_id} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                      <span style={{ color: getTeamColor(p.team) }}>{p.last_name}</span>
                      <span style={{ color: '#94a3b8' }}>{p.total_distance_km} km</span>
                    </div>
                    <div style={{ height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${(p.total_distance_km / maxDist) * 100}%`, height: '100%', background: getTeamColor(p.team), borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sprint chart */}
            <div style={{ background: '#1a1d2e', borderRadius: 12, padding: 16 }}>
              <h3 style={{ fontSize: 14, color: '#ccc', marginBottom: 12 }}>Sprint Count</h3>
              {(() => {
                const maxSprint = Math.max(...players.map(p => p.sprint_count), 1)
                return (
                  <div style={{ overflowY: 'auto', maxHeight: 300 }}>
                    {[...players].sort((a,b) => b.sprint_count - a.sprint_count).map((p, i) => (
                      <div key={p.player_id} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                          <span style={{ color: getTeamColor(p.team), display: 'flex', alignItems: 'center', gap: 4 }}>
                            {i === 0 && <span style={{ fontSize: 10 }}>🥇</span>}
                            {p.last_name}
                          </span>
                          <span style={{ color: '#94a3b8' }}>{p.sprint_count}</span>
                        </div>
                        <div style={{ height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden',
                          outline: i === 0 ? `1px solid gold` : 'none', outlineOffset: 1 }}>
                          <div style={{ width: `${(p.sprint_count / maxSprint) * 100}%`, height: '100%', background: getTeamColor(p.team), borderRadius: 4 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Zone summary collapsible */}
          <div style={{ background: '#1a1d2e', borderRadius: 12, overflow: 'hidden' }}>
            <button onClick={() => setZoneOpen(v => !v)}
              style={{ width: '100%', padding: '14px 20px', background: 'transparent', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 14, textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
              Team Zone Breakdown
              <span>{zoneOpen ? '▲' : '▼'}</span>
            </button>

            {zoneOpen && (
              <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {['home', 'away'].map(team => {
                  const teamPlayers = players.filter(p => p.team === team)
                  if (!teamPlayers.length) return null
                  const tc = team === 'home' ? homeColor : awayColor
                  const tname = team === 'home' ? homeName : awayName
                  return (
                    <div key={team}>
                      <h4 style={{ color: tc, marginBottom: 12, fontSize: 13 }}>{tname}</h4>
                      {teamPlayers.map(p => (
                        <div key={p.player_id} style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 3 }}>{p.last_name}</div>
                          <ZoneBar player={p} />
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', fontSize: 10 }}>
                        {Object.entries(ZONE_LABELS).map(([k, l]) => (
                          <span key={k}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: ZONE_COLORS[k], marginRight: 3 }}></span>{l}</span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
