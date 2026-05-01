import { Router } from 'express'
import YahooFinance from 'yahoo-finance2'

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] })
const router = Router()

router.get('/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params
    const quote = await yf.quote(ticker.toUpperCase())
    res.json({
      ticker: quote.symbol,
      price: quote.regularMarketPrice,
      name: quote.longName || quote.shortName,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
    })
  } catch (err) {
    res.status(404).json({ error: `Could not find ticker: ${req.params.ticker}` })
  }
})

export default router
