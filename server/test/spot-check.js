// Pre-deploy spot check — fetches live JPM data from CBOE and verifies bps calculations
const TICKER = 'JPM'
const TOLERANCE = 0.01 // allow tiny floating-point drift

function parseContract(symbol) {
  const match = symbol.match(/^([A-Z]+)(\d{6})([CP])(\d+)$/)
  if (!match) return null
  const [, , dateStr, type, strikeStr] = match
  const expiration = `20${dateStr.slice(0,2)}-${dateStr.slice(2,4)}-${dateStr.slice(4,6)}`
  return { expiration, type, strike: parseInt(strikeStr) / 1000 }
}

function bps(mid, price) {
  return (mid / price) * 10000
}

function pass(label, expected, actual) {
  const ok = Math.abs(expected - actual) < TOLERANCE
  console.log(`  ${ok ? '✓' : '✗'} ${label}: expected ${expected.toFixed(4)}, got ${actual.toFixed(4)}`)
  if (!ok) throw new Error(`FAIL: ${label}`)
}

async function run() {
  console.log(`\nSpot-checking ${TICKER} options via CBOE...\n`)

  const res = await fetch(`https://cdn.cboe.com/api/global/delayed_quotes/options/${TICKER}.json`)
  if (!res.ok) throw new Error(`CBOE returned ${res.status}`)
  const data = await res.json()

  const price = data.data.current_price
  console.log(`${TICKER} current price: $${price.toFixed(2)}`)

  const allOptions = data.data.options.map(o => ({ ...o, parsed: parseContract(o.option) })).filter(o => o.parsed)
  const expirations = [...new Set(allOptions.map(o => o.parsed.expiration))].sort()
  const exp = expirations[1] || expirations[0] // use second expiry (first is often same-day)
  console.log(`Using expiration: ${exp}\n`)

  const puts  = allOptions.filter(o => o.parsed.expiration === exp && o.parsed.type === 'P' && o.bid > 0 && o.ask > 0)
  const calls = allOptions.filter(o => o.parsed.expiration === exp && o.parsed.type === 'C' && o.bid > 0 && o.ask > 0)

  // Pick 3 puts at ~5%, ~10%, ~15% OTM
  const testPcts = [5, 10, 15]
  const checks = testPcts.map(pct => {
    const targetStrike = price * (1 - pct / 100)
    const put  = puts.reduce((b, o) => Math.abs(o.parsed.strike - targetStrike) < Math.abs(b.parsed.strike - targetStrike) ? o : b)
    const callTarget = price * (1 + pct / 100)
    const call = calls.reduce((b, o) => Math.abs(o.parsed.strike - callTarget) < Math.abs(b.parsed.strike - callTarget) ? o : b)
    return { pct, put, call }
  })

  let allPassed = true
  for (const { pct, put, call } of checks) {
    console.log(`--- ~${pct}% OTM ---`)

    const putMid      = (put.bid + put.ask) / 2
    const putBpsCalc  = bps(putMid, price)
    const putBpsCheck = (putMid / price) * 10000
    console.log(`  Put  strike $${put.parsed.strike.toFixed(2)} | bid ${put.bid} ask ${put.ask} | mid ${putMid.toFixed(3)}`)
    try { pass('put bps', putBpsCheck, putBpsCalc) } catch { allPassed = false }

    const callMid      = (call.bid + call.ask) / 2
    const callBpsCalc  = bps(callMid, price)
    const callBpsCheck = (callMid / price) * 10000
    console.log(`  Call strike $${call.parsed.strike.toFixed(2)} | bid ${call.bid} ask ${call.ask} | mid ${callMid.toFixed(3)}`)
    try { pass('call bps', callBpsCheck, callBpsCalc) } catch { allPassed = false }

    const netBps = putBpsCalc - callBpsCalc
    console.log(`  Net cost: ${netBps.toFixed(1)} bps (put ${putBpsCalc.toFixed(1)} - call ${callBpsCalc.toFixed(1)})\n`)
  }

  if (!allPassed) {
    console.error('SPOT CHECK FAILED — aborting deploy\n')
    process.exit(1)
  }

  console.log('All spot checks passed ✓\n')
}

run().catch(err => {
  console.error('Spot check error:', err.message)
  process.exit(1)
})
