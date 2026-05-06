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
    }
  },

  // Start playback
  startPlay: async () => {
    const { isPlaying, currentFrame, availableFrames, matchId, stopPlay } = get()

    if (isPlaying || !matchId || !availableFrames) return

    set({ isPlaying: true })

    let lastFrameTime = performance.now()
    let buffer = get().frameBuffer

    // Initial prefetch
    const prefetchMore = async () => {
      const state = get()
      if (state.isFetchingBatch || !state.isPlaying) return

      set({ isFetchingBatch: true })
      
      const maxFrameInBuffer = buffer.size > 0 
        ? Math.max(...Array.from(buffer.keys())) 
        : state.currentFrame

      const nextBatchEnd = Math.min(maxFrameInBuffer + 50, state.availableFrames.last_frame)
      
      if (maxFrameInBuffer < nextBatchEnd) {
        try {
          const res = await api.getFrameBatch(state.matchId, maxFrameInBuffer + 1, nextBatchEnd, 1)
          // Also need to fetch the time for these frames? The batch endpoint returns minimal frames
          // Actually, let's look at the batch endpoint. It returns { frames: [{ frame, players, ball }] }
          // We need the full frame format for setFrameData. Let's see what getFrameBatch returns.
          // Wait, getFrameBatch doesn't return time or player stats.
          // Let's modify the backend get_frames_batch to include time, or just calculate time in frontend.
          // The backend get_frames_batch returns MinimalFrame which lacks `time` and player details.
          // If we use batching, we need `time` object. The batch endpoint was specifically designed for this!
          // Actually, let's just use the batch data. But we need `time` for the UI.
          // Let's implement it with getFrameBatch and calculate time client-side or check if the batch endpoint needs an update.
          // wait, the prompt says "Prefetch next 50 frames...". I will just use api.getFrameBatch and update the frameBuffer.
          const newFrames = res.frames || []
          
          const newBuffer = new Map(get().frameBuffer)
          for (const f of newFrames) {
            // Need to merge with previous frame time logic if it's missing
            newBuffer.set(f.frame, f)
          }
          set({ frameBuffer: newBuffer })
          buffer = newBuffer // update local reference for loop
        } catch (err) {
          console.error("Prefetch failed:", err)
        }
      }
      set({ isFetchingBatch: false })
    }

    await prefetchMore()

    const animate = (timestamp) => {
      const state = get()
      if (!state.isPlaying) return

      if (timestamp - lastFrameTime >= 100) {
        const nextFrame = state.currentFrame + 1

        if (nextFrame > state.availableFrames.last_frame) {
          stopPlay()
          return
        }

        if (buffer.has(nextFrame)) {
          // We need to inject `time` if the batch endpoint doesn't have it.
          // The frameData needs to look like what getFrame returns.
          // Actually, the user asked to just setFrameData(buffer.get(nextFrame)).
          // But getFrame returns enriched players with name, team, speed etc.
          // Batch frames only have player_id, x_m, y_m. 
          // We can merge static data from `metadata` (names, teams) and assume speed/accel are empty,
          // but the hover tooltip needs speed!
          // Wait, the batch endpoint specifically states: "Keep payload small for animation. {player_id, x_m, y_m} plus ball."
          // So we should merge it with the previous full frame data, updating only positions.
          const prevFrameData = get().frameData
          const minFrame = buffer.get(nextFrame)
          
          const newPlayers = prevFrameData.players.map(p => {
            const minP = minFrame.players.find(mp => mp.player_id === p.player_id)
            if (minP) {
              return { ...p, x_m: minP.x_m, y_m: minP.y_m }
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
          
          const newFrameData = {
            frame: nextFrame,
            time: {
              ...prevTime,
              minutes: newMin,
              seconds: newSec,
              deciseconds: newDeci,
              timestamp: `${String(newMin).padStart(2,'0')}:${String(newSec).padStart(2,'0')}.${newDeci}`
            },
            players: newPlayers,
            ball: minFrame.ball
          }

          set({ frameData: newFrameData, currentFrame: nextFrame })
          
          const newBuffer = new Map(get().frameBuffer)
          newBuffer.delete(nextFrame)
          set({ frameBuffer: newBuffer })
          buffer = newBuffer

          if (buffer.size < 20) {
            prefetchMore()
          }
        } else {
          // Buffer underrun, wait for prefetch
          if (buffer.size < 20) {
            prefetchMore()
          }
        }
        lastFrameTime = timestamp
      }

      const animId = requestAnimationFrame(animate)
      set({ animationFrameId: animId })
    }

    const animId = requestAnimationFrame(animate)
    set({ animationFrameId: animId })
  },

  // Stop playback
  stopPlay: () => {
    const { animationFrameId } = get()

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
    }

    set({ isPlaying: false, animationFrameId: null })
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
