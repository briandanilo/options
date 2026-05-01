import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import stockRoutes from './routes/stock.js'
import optionsRoutes from './routes/options.js'

const app = express()
const PORT = process.env.PORT || 3001
const __dirname = dirname(fileURLToPath(import.meta.url))

app.use(cors())
app.use(express.json())

app.use('/api/stock', stockRoutes)
app.use('/api/options', optionsRoutes)

// Serve built React app in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = join(__dirname, '../../client/dist')
  app.use(express.static(clientDist))
  app.get('*', (req, res) => res.sendFile(join(clientDist, 'index.html')))
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
