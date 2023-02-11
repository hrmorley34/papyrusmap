import { Feature } from 'ol'
import { Geometry, Point } from 'ol/geom'
import { Options } from 'ol/layer/BaseVector'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'

import MapTileLayer from './MapTileLayer'
import { DataLayerCheckableMixin, DataLayerContents, DataLayerCheckable } from './types'

class _MarkerLayer extends VectorLayer<VectorSource<Geometry>> implements DataLayerContents {
  layerType: 'markers' = 'markers'
  layerKey: string
  dimensionId: number

  source: VectorSource

  constructor (layerKey: string, features: Array<Feature<Point>>, dimensionId: number, layerOptions?: Options<VectorSource<Geometry>>) {
    const vectorSource = new VectorSource({
      features
    })

    super({
      source: vectorSource,
      ...layerOptions
    })
    this.source = vectorSource

    this.layerKey = layerKey
    this.dimensionId = dimensionId
  }

  checkVisibleWithLayer (mapLayer: MapTileLayer): boolean {
    return mapLayer.layerData.dimensionId === this.dimensionId
  }
}
type MarkerLayer = _MarkerLayer & DataLayerCheckable
// eslint-disable-next-line @typescript-eslint/no-redeclare
const MarkerLayer = DataLayerCheckableMixin(_MarkerLayer)
export default MarkerLayer
