import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const pagesBase = '/SCDAid/'
const base =
  process.env.VITE_BASE ||
  (process.env.GITHUB_ACTIONS === 'true' ? pagesBase : '/')

function spaFallback() {
  return {
    name: 'spa-github-pages-fallback',
    closeBundle() {
      const index = resolve('dist/index.html')
      const fallback = resolve('dist/404.html')
      if (existsSync(index)) {
        copyFileSync(index, fallback)
      }
    },
  }
}

export default defineConfig({
  base,
  plugins: [react(), spaFallback()],
})
