import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

// Vite ruleaza din frontend, deci construim path-uri absolute pentru certificate.
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Frontendul local foloseste HTTPS ca sa se potriveasca backendului cu Socket.IO.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    https: {
      // Certificatele sunt partajate cu backendul pentru acelasi mediu local securizat.
      key: readFileSync(resolve(__dirname, '../backend/certs/server.key')),
      cert: readFileSync(resolve(__dirname, '../backend/certs/server.crt')),
    },
    open: false
  }
})
