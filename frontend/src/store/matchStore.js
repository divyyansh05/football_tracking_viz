import { create } from 'zustand'
import { api } from '../api/client'

export const useMatchStore = create((set, get) => ({
  // State
  matchId: null,
  metadata: null,
  currentFrame: 6020,
  availableFrames: null,
  frameData: null,
  isPlaying: false,
  playInterval: null,
  labelMode: 'name',
  activeSection: 'match',
  activePage: 'tracking',
  loading: false,
  error: null,
  frameBuffer: new Map(),
  animationFrameId: null,
  isFetchingBatch: false,
  matchesList: [],
  _rafCleanup: null,
  pitchDimensions: { length: 105, width: 68, x_offset: 52.5, y_offset: 34.0 },

  // Actions
  setMatchId: (id) => set({ matchId: id }),

  setMetadata: (data) => set({ metadata: data }),

  setCurrentFrame: (frame) => set({ currentFrame: frame }),

  setAvailableFrames: (data) => set({ availableFrames: data }),

  setFrameData: (data) => set({ frameData: data }),

  setLabelMode: (mode) => set({ labelMode: mode }),

  setActiveSection: (section) => set({ activeSection: section }),

  setActivePage: (page) => set({ activePage: page }),

  setLoading: (bool) => set({ loading: bool }),

  setError: (msg) => set({ error: msg }),

  setMatchesList: (list) => set({ matchesList: list }),

  togglePlay: () => {
    const { isPlaying, startPlay, stopPlay } = get()
    if (isPlaying) stopPlay()
    else startPlay()
  },

  setFrame: (frame) => get().fetchFrame(frame),

  // Load match
  loadMatch: async (matchId) => {
    const { setLoading, setError, setMatchId, setMetadata, setAvailableFrames, fetchFrame } = get()

    try {
      setLoading(true)
      setError(null)
      setMatchId(matchId)

      // Fetch metadata and available frames in parallel
      const [metadata, availableFrames] = await Promise.all([
        api.getMetadata(matchId),
        api.getAvailableFrames(matchId)
      ])

      setMetadata(metadata)
      setAvailableFrames(availableFrames)

      // Normalize: add player_id alias from id so all components use player_id consistently
      if (metadata?.players) {
        const normalized = {
          ...metadata,
          players: metadata.players.map(p => ({
            ...p,
            player_id: p.player_id ?? p.id
          }))
        }
        setMetadata(normalized)
      }

      // Extract and store pitch dimensions
      if (metadata.pitch) {
        set({ pitchDimensions: metadata.pitch })
      }

      // Fetch initial frame
      const initialFrame = availableFrames.first_frame || 6020
      await fetchFrame(initialFrame)

      setLoading(false)
    } catch (err) {
      setError(err.message)
      setLoading(false)
      console.error('Failed to load match:', err)
    }
  },

  // Fetch single frame
  fetchFrame: async (frame) => {
    const { matchId, setFrameData, setCurrentFrame } = get()

    if (!matchId) return

    try {
      const data = await api.getFrame(matchId, frame)
      setFrameData(data)
      setCurrentFrame(frame)
    } catch (err) {
      console.error('Failed to fetch frame:', err)
      // Do NOT clear frameData on error - keep showing last valid frame
    }
  },

  // Start playback
  startPlay: () => {
    const store = get()
    if (store.isPlaying) return

    set({ isPlaying: true })

    // Prefetch buffer: Map<frameNumber, frameData>
    const frameBuffer = new Map()
    let animRunning = true
    let lastTimestamp = null
    const FRAME_INTERVAL_MS = 100  // 10Hz

    // Prefetch function — fetches next N frames in batch
    const prefetch = async (fromFrame, count = 60) => {
      const toFrame = fromFrame + count
      try {
        const result = await api.getFrameBatch(
          get().matchId, fromFrame, toFrame, 1
        )
        if (result.frames) {
          result.frames.forEach(f => frameBuffer.set(f.frame, f))
        }
      } catch (e) {
        console.warn('Prefetch failed:', e)
        // Do not stop playback on prefetch failure
        // Just let buffer drain naturally
      }
    }

    // Start initial prefetch
    const currentFrame = get().currentFrame
    prefetch(currentFrame, 60)

    // Animation loop using requestAnimationFrame only
    const animate = (timestamp) => {
      if (!animRunning) return
      if (!get().isPlaying) {
        animRunning = false
        return
      }

      if (lastTimestamp === null) {
        lastTimestamp = timestamp
      }

      const elapsed = timestamp - lastTimestamp

      if (elapsed >= FRAME_INTERVAL_MS) {
        lastTimestamp = timestamp

        const current = get().currentFrame
        const available = get().availableFrames

        // Stop if end of match
        if (available && current >= available.last_frame) {
          set({ isPlaying: false })
          animRunning = false
          return
        }

        const nextFrame = current + 1

        if (frameBuffer.has(nextFrame)) {
          const frameData = frameBuffer.get(nextFrame)
          frameBuffer.delete(nextFrame)

          // Merge with previous frame data to preserve player names/metadata
          const prevFrameData = get().frameData
          const newPlayers = prevFrameData.players.map(p => {
            const minP = frameData.players.find(mp => mp.player_id === p.player_id)
            if (minP) {
              // Calculate speed from position change
              const dx = minP.x_m - p.x_m
              const dy = minP.y_m - p.y_m
              const distance = Math.sqrt(dx * dx + dy * dy)
              const newSpeed = distance / 0.1  // m/s (0.1s per frame at 10Hz)

              // Calculate acceleration from speed change
              const speedDelta = newSpeed - (p.speed || 0)
              const newAccel = speedDelta / 0.1  // m/s²

              return {
                ...p,
                x_m: minP.x_m,
                y_m: minP.y_m,
                speed: newSpeed,
                accel: newAccel
              }
            }
            return p
          })

          // Estimate time by adding 0.1s to previous time
          const prevTime = prevFrameData.time
          let newDeci = prevTime.deciseconds + 1
          let newSec = prevTime.seconds
          let newMin = prevTime.minutes
          if (newDeci >= 10) { newDeci = 0; newSec += 1 }
          if (newSec >= 60) { newSec = 0; newMin += 1 }

          // Update store with new frame data
          set({
            currentFrame: nextFrame,
            frameData: {
              frame: nextFrame,
              time: {
                ...prevTime,
                minutes: newMin,
                seconds: newSec,
                deciseconds: newDeci,
                timestamp: `${String(newMin).padStart(2,'0')}:${String(newSec).padStart(2,'0')}.${newDeci}`
              },
              players: newPlayers,
              ball: frameData.ball || null
            }
          })

          // Refetch when buffer is low
          if (frameBuffer.size < 20) {
            const lastBuffered = Math.max(...frameBuffer.keys(), nextFrame)
            prefetch(lastBuffered + 1, 60)
          }
        } else {
          // Buffer empty — skip this tick but keep running
          // Do not stop. Buffer will refill from prefetch.
          console.debug('Buffer empty at frame', nextFrame, '— waiting')
          // Trigger immediate prefetch
          prefetch(current + 1, 60)
        }
      }

      // Always continue the loop
      if (animRunning && get().isPlaying) {
        requestAnimationFrame(animate)
      }
    }

    // Start the loop and store cleanup function
    requestAnimationFrame(animate)
    set({ _rafCleanup: () => { animRunning = false } })
  },

  // Stop playback
  stopPlay: () => {
    const cleanup = get()._rafCleanup
    if (cleanup) cleanup()
    set({ isPlaying: false, _rafCleanup: null })
  },

  // Step frame by delta
  stepFrame: (delta) => {
    const { currentFrame, availableFrames, fetchFrame } = get()

    if (!availableFrames) return

    const newFrame = Math.max(
      availableFrames.first_frame,
      Math.min(availableFrames.last_frame, currentFrame + delta)
    )

    fetchFrame(newFrame)
  }
}))
