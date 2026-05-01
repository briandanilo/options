import { Router } from 'express'

const router = Router()

router.get('/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase()
  try {
    const token = process.env.FINNHUB_KEY
    const { expiration } = req.query

    const url = expiration
      ? `https://finnhub.io/api/v1/stock/option-chain?symbol=${ticker}&expiration=${expiration}&token=${token}`
      : `https://finnhub.io/api/v1/stock/option-chain?symbol=${ticker}&token=${token}`

    const result = await fetch(url).then(r => r.json())
    if (!result.data?.length) throw new Error('No options data')

    const expirationDates = [...new Set(result.data.map(d => d.expirationDate))].sort()

    const target = expiration
      ? result.data.find(d => d.expirationDate === expiration)
      : result.data[0]

    const mapOption = o => ({
      strike:            o.strike,
      lastPrice:         o.lastPrice,
      bid:               o.bid,
      ask:               o.ask,
      impliedVolatility: o.impliedVolatility,
      inTheMoney:        o.inTheMoney,
      volume:            o.volume    ?? 0,
      openInterest:      o.openInterest ?? 0,
    })

    res.json({
      expirationDates,
      calls: (target?.options?.CALL || []).map(mapOption),
      puts:  (target?.options?.PUT  || []).map(mapOption),
    })
  } catch (err) {
    console.error(`[options] ${ticker}:`, err.message)
    res.status(404).json({ error: `Could not fetch options for: ${ticker}` })
  }
})

export default router
