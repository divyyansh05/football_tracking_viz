import { useMatchStore } from '../../store/matchStore'

const TABS = [
  { id: 'overview', label: '📋 Overview' },
  { id: 'tracking', label: '📍 Tracking' },
  { id: 'voronoi', label: '🔷 Voronoi' },
  { id: 'pitch-control', label: '🎯 Pitch Control' }
]

export default function TabNav() {
  const { activeTab, setActiveTab } = useMatchStore()

  return (
    <div className="tab-nav">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
