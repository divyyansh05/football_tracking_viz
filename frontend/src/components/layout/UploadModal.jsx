import { useState } from 'react'
import { api } from '../../api/client'
import { useMatchStore } from '../../store/matchStore'

export default function UploadModal({ isOpen, onClose }) {
  const [matchJsonFile, setMatchJsonFile] = useState(null)
  const [trackingJsonlFile, setTrackingJsonlFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  const { loadMatch } = useMatchStore()

  if (!isOpen) return null

  const handleUpload = async () => {
    if (!matchJsonFile || !trackingJsonlFile) {
      setError('Please select both files')
      return
    }

    try {
      setUploading(true)
      setProgress(0)
      setError(null)

      // Parse match ID from JSON
      const text = await matchJsonFile.text()
      const matchData = JSON.parse(text)
      const matchId = matchData.id

      if (!matchId) throw new Error("Match JSON missing 'id' field")

      // Attempt to get signed URLs
      const matchUrlRes = await api.getSignedUrl(matchId, 'match')
      const trackingUrlRes = await api.getSignedUrl(matchId, 'tracking')

      // If no signed URL (Local Mode), fallback to traditional backend upload
      if (!matchUrlRes.url) {
        setProgress(50) // Indeterminate progress for backend upload
        const result = await api.uploadMatch(matchJsonFile, trackingJsonlFile)
        await loadMatch(result.match_id)
        onClose()
        return
      }

      // Cloud Mode: Direct GCS Upload
      await api.uploadToSignedUrl(matchUrlRes.url, matchJsonFile, (p) => setProgress(p * 0.1))
      await api.uploadToSignedUrl(trackingUrlRes.url, trackingJsonlFile, (p) => setProgress(10 + p * 0.9))
      
      setProgress(100)
      
      // Notify backend to clear cache
      await api.completeUpload(matchId)
      
      await loadMatch(matchId)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Upload Match Data</h2>

        <div className="file-input-group">
          <label>
            Match JSON:
            <input
              type="file"
              accept=".json"
              onChange={(e) => setMatchJsonFile(e.target.files[0])}
            />
          </label>

          <label>
            Tracking JSONL:
            <input
              type="file"
              accept=".jsonl"
              onChange={(e) => setTrackingJsonlFile(e.target.files[0])}
            />
          </label>
        </div>

        {uploading && progress > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ width: '100%', backgroundColor: '#eee', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, backgroundColor: '#4CAF50', height: '100%', transition: 'width 0.2s' }} />
            </div>
            <div style={{ fontSize: '0.8rem', textAlign: 'center', marginTop: '4px' }}>
              {Math.round(progress)}%
            </div>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <div className="modal-buttons">
          <button onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <button onClick={handleUpload} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}
