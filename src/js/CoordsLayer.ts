import TileLayer, { Options as TileLayerOptions } from 'ol/layer/WebGLTile'
import DataTile, { Options as DataTileOptions } from 'ol/source/DataTile'
import MapTileLayer from './MapTileLayer'

import { allCheckboxes, DataLayerCheckable } from './types'

const size = 256 // one chunk
const maxZoom = 20

const canvas = document.createElement('canvas')
canvas.width = size
canvas.height = size

const context = (() => {
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('Unable to get 2D context')
  return context
})()
context.textAlign = 'left'

export class CoordsTile extends DataTile {
  constructor (options?: DataTileOptions) {
    super({
      loader: function (z, x, y) {
        context.clearRect(0, 0, size, size)
        const depth = maxZoom - z
        const chunksPer = Math.pow(2, depth)
        const chunkWidth = size / chunksPer
        const blockWidth = context.lineWidth = chunkWidth / 16
        const borderWidth = blockWidth / 4

        const fontSize = Math.floor(chunkWidth / 16 * 2)
        context.font = `${fontSize}px sans-serif`

        if (depth < 3) {
          for (let dx = 0; dx < chunksPer; dx++) {
            for (let dy = 0; dy < chunksPer; dy++) {
              const absx = x * chunksPer + dx
              const absz = y * chunksPer + dy

              context.fillStyle = 'rgba(0, 0, 0, 0.5)'
              context.fillRect(dx * chunkWidth, dy * chunkWidth, chunkWidth, chunkWidth)
              context.clearRect(dx * chunkWidth + borderWidth, dy * chunkWidth + borderWidth, chunkWidth - 2 * borderWidth, chunkWidth - 2 * borderWidth)
              context.fillStyle = 'rgba(0, 0, 0, 1.0)'
              context.fillText(`x: ${absx}, z: ${absz}`, dx * chunkWidth + borderWidth + 2, dy * chunkWidth + borderWidth + fontSize)
            }
          }
        }
        // converting to Uint8Array for increased browser compatibility
        return new Uint8Array(context.getImageData(0, 0, size, size).data.buffer)
      },
      transition: 0,
      ...options
    })
  }
}

export default class CoordsLayer extends TileLayer implements DataLayerCheckable {
  layerType: 'data' = 'data'
  layerKey: 'coords' = 'coords'

  constructor (tileOptions?: DataTileOptions, options?: TileLayerOptions) {
    super({ source: new CoordsTile(tileOptions), ...options })
    this.checkboxes = []
  }

  checkboxes: HTMLInputElement[]

  addCheckbox (checkbox: HTMLInputElement): void {
    this.checkboxes.push(checkbox)
    this.setVisible(this.getVisible() && checkbox.checked)
  }

  check (mapLayer: MapTileLayer): boolean {
    return allCheckboxes(this.checkboxes)
  }
}
