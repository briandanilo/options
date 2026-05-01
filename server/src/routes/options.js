import { Router } from 'express'

const router = Router()

function parseContract(symbol) {
  const match = symbol.match(/^([A-Z]+)(\d{6})([CP])(\d+)$/)
  if (!match) return null
  const [, , dateStr, type, strikeStr] = match
  const expiration = `20${dateStr.slice(0,2)}-${dateStr.slice(2,4)}-${dateStr.slice(4,6)}`
  const strike = parseInt(strikeStr) / 1000
  return { expiration, type, strike }
}

router.get('/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase()
  const { expiration } = req.query

  console.log(`[options] ${ticker} expiration=${expiration || 'all'}`)

  try {
    const url = `https://cdn.cboe.com/api/global/delayed_quotes/options/${ticker}.json`
    const response = await fetch(url)
    console.log(`[options] ${ticker} CBOE status: ${response.status}`)
    if (!response.ok) throw new Error(`CBOE returned ${response.status}`)

    const data = await response.json()
    const allOptions = data.data.options || []
    console.log(`[options] ${ticker} total contracts: ${allOptions.length}`)

    // Extract all expiration dates
    const expSet = new Set()
    allOptions.forEach(o => {
      const parsed = parseContract(o.option)
      if (parsed) expSet.add(parsed.expiration)
    })
    const expirationDates = [...expSet].sort()
    console.log(`[options] ${ticker} expirations: ${expirationDates.length}`)

    // Filter to requested expiration (or first one)
    const targetExp = expiration || expirationDates[0]
    const filtered = allOptions.filter(o => {
      const parsed = parseContract(o.option)
      return parsed?.expiration === targetExp
    })

    const mapOption = o => {
      const parsed = parseContract(o.option)
      return {
        strike:            parsed.strike,
        lastPrice:         o.last_trade_price,
        bid:               o.bid,
        ask:               o.ask,
        impliedVolatility: o.iv,
        inTheMoney:        false,
        volume:            o.volume        ?? 0,
        openInterest:      o.open_interest ?? 0,
      }
    }

    const calls = filtered.filter(o => parseContract(o.option)?.type === 'C').map(mapOption)
    const puts  = filtered.filter(o => parseContract(o.option)?.type === 'P').map(mapOption)
    console.log(`[options] ${ticker} ${targetExp}: ${calls.length} calls, ${puts.length} puts`)

    res.json({ expirationDates, calls, puts })
  } catch (err) {
    console.error(`[options] ${ticker} error: ${err.message}`)
    res.status(404).json({ error: `Could not fetch options for: ${ticker}` })
  }
})

export default router
