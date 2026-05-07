const BASE = '/api'

async function handleResponse(res) {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

export const api = {
  listMatches: () =>
    fetch(`${BASE}/match/list`).then(handleResponse),

  getMetadata: (matchId) =>
    fetch(`${BASE}/match/${matchId}/metadata`).then(handleResponse),

  getFrame: (matchId, frame) =>
    fetch(`${BASE}/match/${matchId}/frame/${frame}`).then(handleResponse),

  getFrameBatch: (matchId, fromFrame, toFrame, step = 1) =>
    fetch(`${BASE}/match/${matchId}/frames?from_frame=${fromFrame}&to_frame=${toFrame}&step=${step}`)
      .then(handleResponse),

  getAvailableFrames: (matchId) =>
    fetch(`${BASE}/match/${matchId}/available-frames`).then(handleResponse),

  getPitchControl: (matchId, frame) =>
    fetch(`${BASE}/match/${matchId}/pitch-control/${frame}`).then(handleResponse),

  getVoronoi: (matchId, frame) =>
    fetch(`${BASE}/match/${matchId}/voronoi/${frame}`).then(handleResponse),

  getPlayerStats: (matchId, frame) =>
    fetch(`${BASE}/match/${matchId}/players/${frame}/stats`).then(handleResponse),

  uploadMatch: (matchJsonFile, trackingJsonlFile) => {
    const form = new FormData()
    form.append('match_json', matchJsonFile)
    form.append('tracking_jsonl', trackingJsonlFile)
    return fetch(`${BASE}/upload/match`, { method: 'POST', body: form })
      .then(handleResponse)
  },

  getPlayerHeatmap: (matchId, playerId, period = 0) =>
    fetch(`${BASE}/analytics/${matchId}/heatmap/${playerId}?period=${period}`).then(handleResponse),

  getDistanceTimeline: (matchId) =>
    fetch(`${BASE}/analytics/${matchId}/distance`).then(handleResponse),

  getPlayerSpeedProfile: (matchId, playerId) =>
    fetch(`${BASE}/analytics/${matchId}/speed/${playerId}`).then(handleResponse),

  getConvexHull: (matchId, frameNumber) =>
    fetch(`${BASE}/analytics/${matchId}/convex-hull/${frameNumber}`).then(handleResponse),

  getConvexHullTimeline: (matchId) =>
    fetch(`${BASE}/analytics/${matchId}/convex-hull-timeline`).then(handleResponse),

  getFormation: (matchId, windowMinutes = 5, period = 0) =>
    fetch(`${BASE}/analytics/${matchId}/formation?window_minutes=${windowMinutes}&period=${period}`).then(handleResponse),

  getPressingMap: (matchId, team = 'home', period = 0, distanceThreshold = 5.0, startMinute = null, endMinute = null) => {
    let url = `${BASE}/analytics/${matchId}/pressing?team=${team}&period=${period}&distance_threshold=${distanceThreshold}`
    if (startMinute !== null && endMinute !== null) {
      url += `&start_minute=${startMinute}&end_minute=${endMinute}`
    }
    return fetch(url).then(handleResponse)
  },

  getCentroid: (matchId, sampleEvery = 10, smoothWindow = 50) =>
    fetch(`${BASE}/analytics/${matchId}/centroid?sample_every=${sampleEvery}&smooth_window=${smoothWindow}`).then(handleResponse),

  getSpaceControlTimeline: (matchId, sampleEvery = 50) =>
    fetch(`${BASE}/analytics/${matchId}/space-control-timeline?sample_every=${sampleEvery}`).then(handleResponse),

  getVoronoiFrame: (matchId, frame) =>
    fetch(`${BASE}/match/${matchId}/voronoi/${frame}`).then(handleResponse),

  getBallTrajectory: (matchId, period = 1, startMinute = 0, endMinute = 5) =>
    fetch(`${BASE}/analytics/${matchId}/ball-trajectory?period=${period}&start_minute=${startMinute}&end_minute=${endMinute}`).then(handleResponse),

  getPhysicalSummary: (matchId) =>
    fetch(`${BASE}/analytics/${matchId}/physical-summary`).then(handleResponse),

  getMatchStatus: (matchId) =>
    fetch(`${BASE}/match/${matchId}/status`).then(handleResponse),
}
