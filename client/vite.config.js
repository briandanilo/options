import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __VERSION__: JSON.stringify('v1.08'),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
