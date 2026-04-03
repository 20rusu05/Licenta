import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    https: {
      key: readFileSync(resolve(__dirname, '../backend/certs/server.key')),
      cert: readFileSync(resolve(__dirname, '../backend/certs/server.crt')),
    },
    open: false
  }
})