import { Router } from 'express'

const router = Router()

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://finance.yahoo.com',
  'Referer': 'https://finance.yahoo.com/',
}

router.get('/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase()
  const { expiration } = req.query
  const url = expiration
    ? `https://query1.finance.yahoo.com/v7/finance/options/${ticker}?date=${Math.floor(new Date(expiration).getTime() / 1000)}`
    : `https://query1.finance.yahoo.com/v7/finance/options/${ticker}`

  console.log(`[options] fetching: ${url}`)

  let raw
  try {
    const response = await fetch(url, { headers: YF_HEADERS })
    console.log(`[options] ${ticker} HTTP status: ${response.status} ${response.statusText}`)
    raw = await response.text()
    console.log(`[options] ${ticker} raw response (first 500 chars): ${raw.slice(0, 500)}`)
  } catch (netErr) {
    console.error(`[options] ${ticker} NETWORK ERROR: ${netErr.message}`, netErr.cause?.message || '')
    return res.status(502).json({ error: 'Network error reaching data provider' })
  }

  let data
  try {
    data = JSON.parse(raw)
  } catch (parseErr) {
    console.error(`[options] ${ticker} JSON parse error: ${parseErr.message}`)
    return res.status(502).json({ error: 'Bad response from data provider' })
  }

  try {
    const result = data.optionChain?.result?.[0]
    if (!result) {
      console.error(`[options] ${ticker} no result in response:`, JSON.stringify(data).slice(0, 300))
      return res.status(404).json({ error: `No options data for ${ticker}` })
    }

    const expirationDates = (result.expirationDates || []).map(ts =>
      new Date(ts * 1000).toISOString().split('T')[0]
    )
    console.log(`[options] ${ticker} expirations: ${expirationDates.length}, calls: ${result.options?.[0]?.calls?.length}, puts: ${result.options?.[0]?.puts?.length}`)

    const mapOption = o => ({
      strike:            o.strike,
      lastPrice:         o.lastPrice,
      bid:               o.bid,
      ask:               o.ask,
      impliedVolatility: o.impliedVolatility,
      inTheMoney:        o.inTheMoney,
      volume:            o.volume       ?? 0,
      openInterest:      o.openInterest ?? 0,
    })

    res.json({
      expirationDates,
      calls: (result.options?.[0]?.calls || []).map(mapOption),
      puts:  (result.options?.[0]?.puts  || []).map(mapOption),
    })
  } catch (err) {
    console.error(`[options] ${ticker} processing error: ${err.message}`)
    res.status(500).json({ error: 'Error processing options data' })
  }
})

export default router
