import { useState } from 'react'
import StockSearch from './components/StockSearch.jsx'
import ProtectionPricer from './components/ProtectionPricer.jsx'
import './App.css'

export default function App() {
  const [stock, setStock] = useState(null)

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">collar</h1>
        <p className="tagline">Downside protection pricer</p>
      </header>
      <main className="main">
        <StockSearch onSelect={setStock} />
        {stock && <ProtectionPricer stock={stock} />}
      </main>
    </div>
  )
}
