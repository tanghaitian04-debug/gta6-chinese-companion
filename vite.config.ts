import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.PAGES_BASE || '/gta6-chinese-companion/',
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {name:'phonetics',test:/node_modules[\\/]pinyin-pro/},
            {name:'schema',test:/node_modules[\\/]zod/},
            {name:'react',test:/node_modules[\\/](react-dom|react|scheduler)[\\/]/},
          ],
        },
      },
    },
  },
})
