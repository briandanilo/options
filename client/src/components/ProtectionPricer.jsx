import { useState, useEffect, useMemo, useRef } from 'react'
import * as Slider from '@radix-ui/react-slider'
import './ProtectionPricer.css'

const MAX_PCT = 30

function describeDate(dateStr) {
  const days = Math.round((new Date(dateStr) - Date.now()) / 86400000)
  if (days <= 4)               return 'Next'
  if (days <= 10)              return '1 Week'
  if (days <= 45)              return `${Math.round(days / 7)} Weeks`
  if (days <= 270)             return `${Math.round(days / 30)} Months`
  if (days <= 450)             return '1 Year'
  return `${Math.round(days / 365)} Years`
}

function pickExpirations(dates) {
  if (!dates.length) return []
  if (dates.length <= 5) return dates.map(date => ({ date, label: describeDate(date) }))
  const today = Date.now()
  const MS = 86400000
  const targets = [
    { label: 'Next',    days: 0   },
    { label: '1 Week',  days: 7   },
    { label: '1 Month', days: 30  },
    { label: '6 Mo',    days: 180 },
    { label: '1 Year',  days: 365 },
  ]
  const seen = new Set()
  return targets.map(({ label, days }) => {
    const target = today + days * MS
    const date = dates.reduce((best, d) =>
      Math.abs(new Date(d) - target) < Math.abs(new Date(best) - target) ? d : best
    )
    if (seen.has(date)) return null
    seen.add(date)
    return { date, label }
  }).filter(Boolean)
}

function findNearest(chain, targetStrike) {
  if (!chain.length) return null
  return chain.reduce((best, o) =>
    Math.abs(o.strike - targetStrike) < Math.abs(best.strike - targetStrike) ? o : best
  )
}

export default function ProtectionPricer({ stock }) {
  const [allExpirations, setAllExpirations] = useState([])
  const [expiration, setExpiration] = useState('')
  const [isCustomExp, setIsCustomExp] = useState(false)
  const [calls, setCalls] = useState([])
  const [puts, setPuts] = useState([])
  const [loading, setLoading] = useState(false)
  const [values, setValues] = useState([-5, 10])
  const lastCommitted  = useRef([-5, 10])
  const draggingThumb  = useRef(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const expirations = useMemo(() => pickExpirations(allExpirations), [allExpirations])

  function selectPill(date) {
    setIsCustomExp(false)
    setExpiration(date)
  }

  function selectCustom(date) {
    setIsCustomExp(true)
    setExpiration(date)
  }

  // Initial load — default to 1-month
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/options/${stock.ticker}`)
        const data = await res.json()
        const dates = data.expirationDates || []
        setAllExpirations(dates)
        const picked = pickExpirations(dates)
        const oneMonth = picked.find(p => p.label === '1 Month') || picked[0]
        const defaultExp = oneMonth?.date || dates[0] || ''
        setIsCustomExp(false)
        setExpiration(defaultExp)
        if (defaultExp) {
          const r2 = await fetch(`/api/options/${stock.ticker}?expiration=${defaultExp}`)
          const d2 = await r2.json()
          setCalls(d2.calls || [])
          setPuts(d2.puts || [])
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [stock.ticker])

  useEffect(() => {
    if (!expiration || !allExpirations.length) return
    async function loadChain() {
      setLoading(true)
      try {
        const res = await fetch(`/api/options/${stock.ticker}?expiration=${expiration}`)
        const data = await res.json()
        setCalls(data.calls || [])
        setPuts(data.puts || [])
      } finally {
        setLoading(false)
      }
    }
    loadChain()
  }, [expiration]) // eslint-disable-line react-hooks/exhaustive-deps

  const downsidePct = Math.abs(values[0])
  const upsidePct   = values[1]

  const putTarget  = stock.price * (1 - downsidePct / 100)
  const callTarget = stock.price * (1 + upsidePct   / 100)

  const activePuts  = useMemo(() => puts.filter(p  => p.bid > 0 && p.ask > 0 && p.strike  <= stock.price), [puts,  stock.price])
  const activeCalls = useMemo(() => calls.filter(c => c.bid > 0 && c.ask > 0 && c.strike >= stock.price), [calls, stock.price])

  const selectedPut  = useMemo(() =>
    downsidePct === 0 ? null : findNearest(activePuts,  putTarget),
    [activePuts, putTarget, downsidePct]
  )
  const selectedCall = useMemo(() =>
    upsidePct === 0 ? null : findNearest(activeCalls, callTarget),
    [activeCalls, callTarget, upsidePct]
  )

  function snapToStrikes(vals) {
    const thumb = draggingThumb.current
    const [prevDown, prevUp] = lastCommitted.current
    let snappedDown = prevDown
    let snappedUp   = prevUp

    if (thumb === 0 && Math.abs(vals[0]) > 0 && activePuts.length) {
      const reqPct = Math.abs(vals[0])
      const goingMoreOTM = reqPct > Math.abs(prevDown)
      const byPct = activePuts
        .map(p => ({ pct: (stock.price - p.strike) / stock.price * 100 }))
        .sort((a, b) => a.pct - b.pct)
      const snap = goingMoreOTM
        ? byPct.find(x => x.pct >= reqPct) ?? byPct[byPct.length - 1]
        : [...byPct].reverse().find(x => x.pct <= reqPct) ?? byPct[0]
      if (snap) snappedDown = -snap.pct
    } else if (thumb === 0) {
      snappedDown = 0
    }

    if (thumb === 1 && vals[1] > 0 && activeCalls.length) {
      const reqPct = vals[1]
      const goingMoreOTM = reqPct > prevUp
      const byPct = activeCalls
        .map(c => ({ pct: (c.strike - stock.price) / stock.price * 100 }))
        .sort((a, b) => a.pct - b.pct)
      const snap = goingMoreOTM
        ? byPct.find(x => x.pct >= reqPct) ?? byPct[byPct.length - 1]
        : [...byPct].reverse().find(x => x.pct <= reqPct) ?? byPct[0]
      if (snap) snappedUp = snap.pct
    } else if (thumb === 1) {
      snappedUp = 0
    }

    lastCommitted.current = [snappedDown, snappedUp]
    setValues([snappedDown, snappedUp])
  }

  const putMid  = selectedPut  ? (selectedPut.bid  + selectedPut.ask)  / 2 : null
  const callMid = selectedCall ? (selectedCall.bid + selectedCall.ask) / 2 : null

  const putBps  = putMid  != null ? (putMid  / stock.price) * 10000 : null
  const callBps = callMid != null ? (callMid / stock.price) * 10000 : null
  const netBps  = (putBps ?? 0) - (callBps ?? 0)



  const change = stock.changePercent
  const changeSign = change >= 0 ? '+' : ''
  const activePillLabel = isCustomExp ? null : expirations.find(e => e.date === expiration)?.label

  return (
    <div className="pricer">

      <div className="stock-banner">
        <div>
          <span className="stock-ticker">{stock.ticker}</span>
          <span className="stock-name">{stock.name}</span>
        </div>
        <div className="stock-price-block">
          <span className="stock-price">${stock.price.toFixed(2)}</span>
          <span className={`stock-change ${change >= 0 ? 'up' : 'down'}`}>
            {changeSign}{change.toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="expiry-bar">
        {expirations.map(({ date, label }) => (
          <button
            key={date}
            className={`expiry-pill ${!isCustomExp && expiration === date ? 'active' : ''}`}
            onClick={() => selectPill(date)}
            disabled={loading}
          >
            <span className="pill-label">{label}</span>
            <span className="pill-date">{date}</span>
          </button>
        ))}
        {loading && <span className="loading-badge">loading…</span>}
      </div>

      <div className="slider-card">
        <div className="slider-labels">
          <div className="side-label left">
            <span className="side-name">Put protection</span>
            <span className="side-pct put-pct">{downsidePct.toFixed(1)}% below</span>
            <span className="side-strike">
              {selectedPut ? `strike $${selectedPut.strike.toFixed(2)}` : '—'}
            </span>
          </div>
          <div className="center-label">
            <span className="center-price">${stock.price.toFixed(2)}</span>
            <span className="center-sub">
              {isCustomExp ? expiration : (activePillLabel || expiration)}
            </span>
          </div>
          <div className="side-label right">
            <span className="side-name">Call sold</span>
            <span className="side-pct call-pct">{upsidePct.toFixed(1)}% above</span>
            <span className="side-strike">
              {selectedCall ? `strike $${selectedCall.strike.toFixed(2)}` : '—'}
            </span>
          </div>
        </div>

        <div className="slider-container">
          <div className="track-zones" aria-hidden="true">
            <div className="zone-left" />
            <div className="zone-center" />
            <div className="zone-right" />
          </div>
          <Slider.Root
            className="slider-root"
            min={-MAX_PCT}
            max={MAX_PCT}
            step={0.5}
            value={values}
            onValueChange={setValues}
            onValueCommit={snapToStrikes}
            minStepsBetweenThumbs={0}
          >
            <Slider.Track className="slider-track">
              <Slider.Range className="slider-range" />
            </Slider.Track>
            <Slider.Thumb className="slider-thumb thumb-put"  aria-label="Downside protection" onPointerDown={() => { draggingThumb.current = 0 }} />
            <Slider.Thumb className="slider-thumb thumb-call" aria-label="Upside sold"          onPointerDown={() => { draggingThumb.current = 1 }} />
          </Slider.Root>
        </div>

        <div className="slider-axis">
          <span>-{MAX_PCT}%</span>
          <span>0%</span>
          <span>+{MAX_PCT}%</span>
        </div>
      </div>

      <div className="summary-row">
        <SummaryCard label="Put cost"      value={putBps}  mid={putMid}  color="red"   />
        <div className="net-card">
          <span className="net-label">{netBps <= 0 ? 'Pays' : 'Costs'}</span>
          <span className={`net-value ${netBps <= 0 ? 'green' : 'red'}`}>
            {Math.abs(netBps).toFixed(1)}
          </span>
          <span className="net-unit">bps</span>
        </div>
        <SummaryCard label="Call premium"  value={callBps} mid={callMid} color="green" />
      </div>

      {(selectedPut || selectedCall) && (
        <LiquidityPanel put={selectedPut} call={selectedCall} />
      )}

      <div className="advanced-section">
        <button className="advanced-toggle" onClick={() => setShowAdvanced(v => !v)}>
          {showAdvanced ? '▲' : '▼'} Advanced
        </button>
        {showAdvanced && (
          <div className="advanced-content">
            <label className="adv-label">Custom expiration date</label>
            <select
              className="adv-select"
              value={isCustomExp ? expiration : ''}
              onChange={e => e.target.value && selectCustom(e.target.value)}
              disabled={loading}
            >
              <option value="">— select a date —</option>
              {allExpirations.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {isCustomExp && (
              <p className="adv-hint">Custom date selected. Click a pill above to switch back.</p>
            )}

            <div className="chain-tables">
              <ChainTable
                title="Puts"
                chain={puts.filter(p => p.bid > 0 && p.ask > 0 && p.strike <= stock.price)}
                selectedStrike={selectedPut?.strike}
                ascending={false}
              />
              <ChainTable
                title="Calls"
                chain={calls.filter(c => c.bid > 0 && c.ask > 0 && c.strike >= stock.price)}
                selectedStrike={selectedCall?.strike}
                ascending={true}
              />
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

function spreadGrade(spreadPct) {
  if (spreadPct <  3) return { label: 'Tight',    color: '#4ade80', score: 4 }
  if (spreadPct < 10) return { label: 'Fair',     color: '#facc15', score: 3 }
  if (spreadPct < 25) return { label: 'Wide',     color: '#fb923c', score: 2 }
  return                     { label: 'Very wide', color: '#f87171', score: 1 }
}

function volumeGrade(volume, oi) {
  if (volume > 100 || oi > 500) return { label: 'Active',   color: '#4ade80' }
  if (volume > 10  || oi > 100) return { label: 'Light',    color: '#facc15' }
  if (volume > 0   || oi > 0)   return { label: 'Thin',     color: '#fb923c' }
  return                                { label: 'No volume', color: '#f87171' }
}

function LiquidityPanel({ put, call }) {
  function metrics(o, side) {
    if (!o) return null
    const mid = (o.bid + o.ask) / 2
    const spreadPct = mid > 0 ? ((o.ask - o.bid) / mid) * 100 : 999
    const sg = spreadGrade(spreadPct)
    const vg = volumeGrade(o.volume, o.openInterest)
    return { side, strike: o.strike, spreadPct, sg, vg, volume: o.volume, oi: o.openInterest }
  }

  const rows = [metrics(put, 'Put'), metrics(call, 'Call')].filter(Boolean)

  return (
    <div className="liquidity-panel">
      <div className="liq-title">Market liquidity</div>
      <div className="liq-grid">
        {rows.map(r => (
          <div key={r.side} className="liq-card">
            <div className="liq-card-header">
              <span className="liq-side">{r.side}</span>
              <span className="liq-strike">${r.strike.toFixed(2)}</span>
            </div>
            <div className="liq-metrics">
              <div className="liq-metric">
                <span className="liq-metric-label">Spread</span>
                <span className="liq-metric-value" style={{ color: r.sg.color }}>
                  {r.spreadPct.toFixed(1)}%
                </span>
                <span className="liq-badge" style={{ color: r.sg.color }}>{r.sg.label}</span>
              </div>
              <div className="liq-metric">
                <span className="liq-metric-label">Volume</span>
                <span className="liq-metric-value" style={{ color: r.vg.color }}>
                  {r.volume.toLocaleString()}
                </span>
                <span className="liq-badge" style={{ color: r.vg.color }}>{r.vg.label}</span>
              </div>
              <div className="liq-metric">
                <span className="liq-metric-label">Open interest</span>
                <span className="liq-metric-value">{r.oi.toLocaleString()}</span>
              </div>
            </div>
            <div className="liq-bar-track">
              <div className="liq-bar-fill" style={{ width: `${Math.max(5, Math.min(100, (r.sg.score / 4) * 100))}%`, background: r.sg.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChainTable({ title, chain, selectedStrike, ascending }) {
  const sorted = [...chain].sort((a, b) => ascending ? a.strike - b.strike : b.strike - a.strike)
  return (
    <div className="chain-table">
      <div className="chain-title">{title}</div>
      <table>
        <thead>
          <tr>
            <th>Strike</th>
            <th>Bid</th>
            <th>Ask</th>
            <th>Mid</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(o => {
            const mid = (o.bid + o.ask) / 2
            const isSelected = o.strike === selectedStrike
            return (
              <tr key={o.strike} className={isSelected ? 'selected-row' : ''}>
                <td className="strike-cell">${o.strike.toFixed(2)}</td>
                <td>{o.bid.toFixed(2)}</td>
                <td>{o.ask.toFixed(2)}</td>
                <td className="mid-cell">{mid.toFixed(2)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SummaryCard({ label, value, mid, color }) {
  return (
    <div className="summary-card">
      <span className="summary-label">{label}</span>
      <span className={`summary-value ${color}`}>
        {value != null ? value.toFixed(1) : '—'}
      </span>
      <span className="summary-unit">{value != null ? 'bps' : ''}</span>
      <span className="summary-sub">{mid != null ? `$${mid.toFixed(2)}/share` : ''}</span>
    </div>
  )
}
