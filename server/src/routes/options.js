import { Router } from 'express'
import YahooFinance from 'yahoo-finance2'

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] })
const router = Router()

router.get('/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params
    const { expiration } = req.query

    const opts = expiration ? { date: new Date(expiration) } : {}
    const result = await yf.options(ticker.toUpperCase(), opts)

    const expirationDates = (result.expirationDates || []).map(d =>
      new Date(d).toISOString().split('T')[0]
    )

    const mapOption = o => ({
      strike: o.strike,
      lastPrice: o.lastPrice,
      bid: o.bid,
      ask: o.ask,
      impliedVolatility: o.impliedVolatility,
      inTheMoney: o.inTheMoney,
      volume: o.volume ?? 0,
      openInterest: o.openInterest ?? 0,
    })

    const calls = (result.options?.[0]?.calls || []).map(mapOption)
    const puts = (result.options?.[0]?.puts || []).map(mapOption)

    res.json({ expirationDates, calls, puts })
  } catch (err) {
    console.error(`[options] ${req.params.ticker}:`, err.message)
    res.status(404).json({ error: `Could not fetch options for: ${req.params.ticker}` })
  }
})

export default router
