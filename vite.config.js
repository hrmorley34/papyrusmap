import { defineConfig } from 'vite'

const path = require('path')

export default defineConfig({
  root: path.resolve(__dirname, 'src'),
  resolve: {
    alias: {
      '~bootstrap': path.resolve(__dirname, 'node_modules/bootstrap'),
      '~ol': path.resolve(__dirname, 'node_modules/ol')
    }
  },
  build: {
    sourcemap: true
  },
  base: './'
})
