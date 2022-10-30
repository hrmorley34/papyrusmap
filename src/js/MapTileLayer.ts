import { Options as TileOptions } from 'ol/layer/BaseTile'
import TileLayer from 'ol/layer/Tile'
import XYZ, { Options as XYZOptions } from 'ol/source/XYZ'

import { DataLayerContents, Layer } from './types'

export default class MapTileLayer extends TileLayer<XYZ> implements DataLayerContents {
  layerType: 'map' = 'map'
  layerKey: string
  layerData: Layer

  constructor (layerKey: string, layer: Layer, xyzOptions?: XYZOptions, layerOptions?: TileOptions<XYZ>) {
    super({
      source: new XYZ({
        tileUrlFunction: function (tileCoord, pixelRatio, projection) {
          const z = tileCoord[0]
          const x = tileCoord[1]
          const y = tileCoord[2]
          return `./${layer.folder}/${z}/${x}/${y}.${layer.fileExtension}`
        },
        attributions: layer.attribution,
        ...xyzOptions
      }),
      ...layerOptions
    })

    // Add a dimensionId from the layer key if missing (dim1 -> 1, dim0_stronghold -> 0)
    layer.dimensionId ??= parseInt(layerKey.substring(3))
    // Add the background colour if missing
    layer.background ??= layerKey === 'dim0_stronghold' ? '#fff' : null

    this.layerKey = layerKey
    this.layerData = layer
  }

  check (mapLayer: MapTileLayer): boolean { return mapLayer === this }
}
