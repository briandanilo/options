import { useState } from 'react'
import StockSearch from './components/StockSearch.jsx'
import ProtectionPricer from './components/ProtectionPricer.jsx'
import './App.css'

export default function App() {
  const [stock, setStock] = useState(null)

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">collar calculator</h1>
        <p className="tagline">real time options prices</p>
      </header>
      <main className="main">
        <StockSearch onSelect={setStock} />
        {stock && <ProtectionPricer stock={stock} />}
      </main>
      <footer className="footer">
        {__VERSION__} — built {new Date(__BUILD_TIME__).toLocaleString()}
      </footer>
    </div>
  )
}
