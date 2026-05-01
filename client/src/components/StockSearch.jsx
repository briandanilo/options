import { useState } from 'react'
import './StockSearch.css'

export default function StockSearch({ onSelect }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/stock/${input.trim().toUpperCase()}`)
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()
      onSelect(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="search-card">
      <form className="search-form" onSubmit={handleSubmit}>
        <input
          className="search-input"
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          placeholder="Enter ticker (e.g. AAPL)"
          spellCheck={false}
        />
        <button className="search-btn" type="submit" disabled={loading}>
          {loading ? 'Loading…' : 'Look up'}
        </button>
      </form>
      {error && <p className="search-error">{error}</p>}
    </div>
  )
}
