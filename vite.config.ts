import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.PAGES_BASE || '/gta6-chinese-companion/',
  plugins: [react()],
})
