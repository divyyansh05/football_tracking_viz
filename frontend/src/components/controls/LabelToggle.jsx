import { useMatchStore } from '../../store/matchStore'

export default function LabelToggle() {
  const { labelMode, setLabelMode } = useMatchStore()

  return (
    <div className="label-toggle">
      <button
        className={labelMode === 'none' ? 'active' : ''}
        onClick={() => setLabelMode('none')}
      >
        No Labels
      </button>
      <button
        className={labelMode === 'name' ? 'active' : ''}
        onClick={() => setLabelMode('name')}
      >
        Names
      </button>
      <button
        className={labelMode === 'speed' ? 'active' : ''}
        onClick={() => setLabelMode('speed')}
      >
        Speed
      </button>
    </div>
  )
}
