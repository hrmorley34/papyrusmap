import TileLayer, { Options as TileLayerOptions } from 'ol/layer/WebGLTile'
import DataTile, { Options as DataTileOptions } from 'ol/source/DataTile'
import MapTileLayer from './MapTileLayer'

import { DataLayerCheckableMixin, DataLayerContents, DataLayerCheckable } from './types'

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
const darkgreen = 'rgba(0, 100, 0, 0.3)'
const lightgreen = 'rgba(0, 200, 0, 0.3)'

// Mersenne Twister, simplified for slime chunk finding
// https://github.com/depressed-pho/slime-finder-pe/issues/21#issuecomment-1108700364
const slime = (cx: number, cz: number): boolean => {
  let m = Math.imul(cx, 0x1f1f1f1f) ^ cz
  const f = (x: number, y: number): number => Math.imul(x ^ x >>> 30, 0x6c078965) + y
  const a = m & 0x80000000 | (m = f(m, 1)) & 0x7fffffff
  for (let i = 2; i < 398; i++)m = f(m, i)
  m ^= a >>> 1 ^ [0, 0x9908b0df][a & 1]
  m ^= m >>> 11
  m ^= m << 7 & 0x9d2c5680
  m ^= m << 15 & 0xefc60000
  m ^= m >>> 18
  return ((m >>> 0) % 10) === 0
}

export class SlimeTile extends DataTile {
  constructor (options?: DataTileOptions) {
    super({
      loader: function (z, x, y) {
        context.clearRect(0, 0, size, size)
        const depth = maxZoom - z
        const chunksPer = Math.pow(2, depth)
        const chunkWidth = size / chunksPer
        const blockWidth = context.lineWidth = chunkWidth / 16
        if (depth < 4) {
          for (let dx = 0; dx < chunksPer; dx++) {
            for (let dy = 0; dy < chunksPer; dy++) {
              const absx = x * chunksPer + dx
              const absz = y * chunksPer + dy
              const isSlimy = slime(absx, absz)

              if (isSlimy) {
                context.fillStyle = darkgreen
                context.fillRect(dx * chunkWidth, dy * chunkWidth, chunkWidth, chunkWidth)
                context.clearRect(dx * chunkWidth + blockWidth, dy * chunkWidth + blockWidth, chunkWidth - 2 * blockWidth, chunkWidth - 2 * blockWidth)
                context.fillStyle = lightgreen
                context.fillRect(dx * chunkWidth + blockWidth, dy * chunkWidth + blockWidth, chunkWidth - 2 * blockWidth, chunkWidth - 2 * blockWidth)
              }
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

class _SlimeLayer extends TileLayer implements DataLayerContents {
  layerType: 'data' = 'data'
  layerKey: 'slime' = 'slime'

  constructor (tileOptions?: DataTileOptions, options?: TileLayerOptions) {
    super({ source: new SlimeTile(tileOptions), ...options })
  }

  checkVisibleWithLayer (mapLayer: MapTileLayer): boolean {
    return mapLayer.layerData.dimensionId === 0
  }
}
type SlimeLayer = _SlimeLayer & DataLayerCheckable
// eslint-disable-next-line @typescript-eslint/no-redeclare
const SlimeLayer = DataLayerCheckableMixin(_SlimeLayer)
export default SlimeLayer
