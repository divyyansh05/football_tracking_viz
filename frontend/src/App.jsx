import { useEffect, useState } from 'react'
import { useMatchStore } from './store/matchStore'
import { api } from './api/client'
import MatchHeader from './components/layout/MatchHeader'
import Navigation from './components/layout/Navigation'
import UploadModal from './components/layout/UploadModal'
import OverviewTab from './tabs/OverviewTab'
import TrackingTab from './tabs/TrackingTab'
import VoronoiTab from './tabs/VoronoiTab'
import PitchControlTab from './tabs/PitchControlTab'
import PlayerHeatmap from './tabs/analytics/PlayerHeatmap'
import DistanceTimeline from './tabs/analytics/DistanceTimeline'
import SpeedProfile from './tabs/analytics/SpeedProfile'
import ConvexHull from './tabs/analytics/ConvexHull'
import FormationTracker from './tabs/analytics/FormationTracker'
import PressingMap from './tabs/analytics/PressingMap'
import CentroidTracker from './tabs/analytics/CentroidTracker'
import SpaceControl from './tabs/analytics/SpaceControl'
import BallTrajectory from './tabs/analytics/BallTrajectory'
import PhysicalDashboard from './tabs/analytics/PhysicalDashboard'

export default function App() {
  const { activeSection, activePage, loadMatch, loading, matchesList, setMatchesList, matchId, error, setError } = useMatchStore()
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    // Load first available match on mount
    api.listMatches()
      .then(data => {
        if (data.matches) {
          setMatchesList(data.matches)
          if (data.matches.length > 0 && !matchId) {
            loadMatch(data.matches[0].match_id)
          } else if (data.matches.length === 0) {
            setShowUpload(true)
          }
        }
      })
      .catch(err => {
        console.error('Failed to list matches:', err)
        setShowUpload(true)
      })
  }, [loadMatch, setMatchesList, matchId])

  const handleMatchSelect = (e) => {
    const value = e.target.value
    if (value === 'upload') {
      setShowUpload(true)
    } else if (value) {
      loadMatch(parseInt(value, 10))
    }
  }

  return (
    <div className="app">
      {loading && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ textAlign: 'center' }}>
            <div className="spinner"><div className="spinner-circle"></div></div>
            <h2>Processing tracking data...</h2>
            <p>This may take 20-30 seconds on first load.</p>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#ef4444', color: 'white', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><strong>Error:</strong> {error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '20px' }}>✕</button>
        </div>
      )}

      <div className="header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#1a1a1a', borderBottom: '1px solid #333' }}>
        <MatchHeader />
        <select 
          className="match-selector"
          value={matchId || ''}
          onChange={handleMatchSelect}
          style={{ padding: '8px', borderRadius: '4px', backgroundColor: '#333', color: 'white', border: '1px solid #555', cursor: 'pointer' }}
        >
          {matchesList.map(m => (
            <option key={m.match_id} value={m.match_id}>
              {m.home_team} {m.score} {m.away_team} | {m.date.split('T')[0]}
            </option>
          ))}
          <option value="upload">[ Upload New Match ]</option>
        </select>
      </div>

      <Navigation />

      <main className="main-content">
        {activePage === 'overview' && <OverviewTab />}
        {activePage === 'tracking' && <TrackingTab />}
        {activePage === 'voronoi' && <VoronoiTab />}
        {activePage === 'pitch-control' && <PitchControlTab />}
        
        {activePage === 'player-heatmap' && <PlayerHeatmap />}
        {activePage === 'player-distance' && <DistanceTimeline />}
        {activePage === 'player-speed' && <SpeedProfile />}
        
        {activePage === 'team-hull' && <ConvexHull />}
        {activePage === 'team-formation' && <FormationTracker />}
        {activePage === 'team-pressing' && <PressingMap />}
        {activePage === 'team-centroid' && <CentroidTracker />}
        {activePage === 'stat-space' && <SpaceControl />}
        {activePage === 'stat-trajectory' && <BallTrajectory />}
        {activePage === 'stat-physical' && <PhysicalDashboard />}

        {/* Coming soon placeholder for unbuilt pages */}
        {![
          'overview', 'tracking', 'voronoi', 'pitch-control',
          'player-heatmap', 'player-distance', 'player-speed',
          'team-hull', 'team-formation', 'team-pressing', 'team-centroid',
          'stat-space', 'stat-trajectory', 'stat-physical'
        ].includes(activePage) && (
          <div className="coming-soon" style={{ textAlign: 'center', padding: '48px', color: '#999', background: '#1a1d2e', borderRadius: '12px' }}>
            <p style={{ fontSize: '24px', marginBottom: '8px' }}>🚧</p>
            <p>Coming soon</p>
          </div>
        )}
      </main>

      <UploadModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
      />
    </div>
  )
}
