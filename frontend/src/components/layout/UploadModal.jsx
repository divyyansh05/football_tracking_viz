import { useState } from 'react'
import { api } from '../../api/client'
import { useMatchStore } from '../../store/matchStore'

export default function UploadModal({ isOpen, onClose }) {
  const [matchJsonFile, setMatchJsonFile] = useState(null)
  const [trackingJsonlFile, setTrackingJsonlFile] = useState(null)
  const [uploading, setUploading] = useState(false)
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
      setError(null)

      const result = await api.uploadMatch(matchJsonFile, trackingJsonlFile)

      // Load the newly uploaded match
      await loadMatch(result.match_id)

      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
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
