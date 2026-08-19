import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Hosted on GitHub Pages at https://hs-ye.github.io/IL-fleet-planner/
  base: '/IL-fleet-planner/',
})
