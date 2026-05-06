import { useMatchStore } from '../../store/matchStore'

const sections = [
  {
    id: 'match',
    label: 'Match View',
    icon: '🏟',
    pages: [
      { id: 'overview', label: 'Overview' },
      { id: 'tracking', label: 'Tracking' },
      { id: 'voronoi', label: 'Voronoi' },
      { id: 'pitch-control', label: 'Pitch Control' }
    ]
  },
  {
    id: 'players',
    label: 'Players',
    icon: '👤',
    pages: [
      { id: 'player-heatmap', label: 'Heatmap' },
      { id: 'player-distance', label: 'Distance' },
      { id: 'player-speed', label: 'Speed Profile' }
    ]
  },
  {
    id: 'teams',
    label: 'Teams',
    icon: '👥',
    pages: [
      { id: 'team-hull', label: 'Convex Hull' },
      { id: 'team-formation', label: 'Formation' },
      { id: 'team-pressing', label: 'Pressing' },
      { id: 'team-centroid', label: 'Centroid' }
    ]
  },
  {
    id: 'stats',
    label: 'Match Stats',
    icon: '📊',
    pages: [
      { id: 'stat-space', label: 'Space Control' },
      { id: 'stat-trajectory', label: 'Ball Trajectory' },
      { id: 'stat-physical', label: 'Physical Dashboard' }
    ]
  }
]

export default function Navigation() {
  const { activeSection, setActiveSection, activePage, setActivePage } = useMatchStore()

  const currentSectionObj = sections.find(s => s.id === activeSection) || sections[0]

  return (
    <nav className="nav-root">
      <div className="nav-sections">
        {sections.map(section => (
          <button
            key={section.id}
            className={`nav-section ${activeSection === section.id ? 'active' : ''}`}
            onClick={() => {
              setActiveSection(section.id)
              // Auto-select the first page of the section when switching
              setActivePage(section.pages[0].id)
            }}>
            {section.icon} {section.label}
          </button>
        ))}
      </div>
      <div className="nav-pages">
        {currentSectionObj.pages.map(page => (
          <button
            key={page.id}
            className={`nav-page ${activePage === page.id ? 'active' : ''}`}
            onClick={() => setActivePage(page.id)}>
            {page.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
