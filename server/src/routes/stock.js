import { Router } from 'express'

const router = Router()

router.get('/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase()
  try {
    const token = process.env.FINNHUB_KEY
    const [quoteRes, profileRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${token}`),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${token}`),
    ])
    const quote   = await quoteRes.json()
    const profile = await profileRes.json()

    if (!quote.c) throw new Error('No data')

    res.json({
      ticker,
      price:         quote.c,
      name:          profile.name || ticker,
      change:        quote.d,
      changePercent: quote.dp,
    })
  } catch (err) {
    console.error(`[stock] ${ticker}:`, err.message)
    res.status(404).json({ error: `Could not find ticker: ${ticker}` })
  }
})

export default router
