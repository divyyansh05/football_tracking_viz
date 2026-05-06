import { useMatchStore } from '../../store/matchStore'

export default function FrameControls() {
  const {
    currentFrame,
    availableFrames,
    frameData,
    isPlaying,
    fetchFrame,
    startPlay,
    stopPlay,
    stepFrame
  } = useMatchStore()

  if (!availableFrames) {
    return <div className="frame-controls">Loading...</div>
  }

  const handleScrub = (e) => {
    fetchFrame(parseInt(e.target.value))
  }

  const togglePlay = () => {
    if (isPlaying) {
      stopPlay()
    } else {
      startPlay()
    }
  }

  // Format time display
  const time = frameData?.time || { period: 1, minutes: 0, seconds: 0, deciseconds: 0 }
  
  let displayMin = time.period === 1 ? time.minutes : 45 + time.minutes;
  if (time.period === 1 && time.minutes >= 45) {
      displayMin = `45+${time.minutes - 45}`;
  } else if (time.period === 2 && time.minutes >= 45) {
      displayMin = `90+${time.minutes - 45}`;
  }
  const timeStr = `${displayMin}:${String(time.seconds).padStart(2, '0')}.${time.deciseconds}`

  const periods = availableFrames.periods || []
  const activePeriodObj = periods.find(p => p.period === time.period) || periods[0] || {}
  const minFrame = activePeriodObj.start_frame || availableFrames.first_frame
  const maxFrame = activePeriodObj.end_frame || availableFrames.last_frame

  return (
    <div className="frame-controls">
      <div className="period-selectors" style={{ display: 'flex', gap: '8px', marginBottom: '8px', justifyContent: 'center' }}>
        {periods.map(p => (
          <button 
             key={p.period}
             style={{ 
               padding: '4px 12px', 
               borderRadius: '4px',
               backgroundColor: activePeriodObj.period === p.period ? '#4caf50' : '#333',
               color: 'white',
               border: 'none',
               cursor: 'pointer'
             }}
             onClick={() => fetchFrame(p.start_frame)}
          >
             Period {p.period}
          </button>
        ))}
      </div>

      <div className="time-display">
        <span className="period-pill">P{time.period}</span>
        <span className="time-value">{timeStr}</span>
      </div>

      <div className="scrubber">
        <input
          type="range"
          min={minFrame}
          max={maxFrame}
          value={currentFrame}
          onChange={handleScrub}
          step={1}
        />
      </div>

      <div className="controls-buttons">
        <button onClick={() => stepFrame(-100)} title="-10s">◀◀</button>
        <button onClick={() => stepFrame(-10)} title="-1s">-1s</button>
        <button onClick={() => stepFrame(-1)} title="-0.1s">-0.1s</button>
        <button className="play-button" onClick={togglePlay}>
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <button onClick={() => stepFrame(1)} title="+0.1s">+0.1s</button>
        <button onClick={() => stepFrame(10)} title="+1s">+1s</button>
        <button onClick={() => stepFrame(100)} title="+10s">▶▶</button>
      </div>

      <div className="frame-number">
        Frame {currentFrame}
      </div>
    </div>
  )
}
