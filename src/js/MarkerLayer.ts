import { Feature } from 'ol'
import { Geometry, Point } from 'ol/geom'
import { Options } from 'ol/layer/BaseVector'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'

import MapTileLayer from './MapTileLayer'
import { allCheckboxes, DataLayerCheckable } from './types'

export default class MarkerLayer extends VectorLayer<VectorSource<Geometry>> implements DataLayerCheckable {
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

    this.checkboxes = []
  }

  checkboxes: HTMLInputElement[]

  addCheckbox (checkbox: HTMLInputElement): void {
    this.checkboxes.push(checkbox)
  }

  check (mapLayer: MapTileLayer): boolean {
    return allCheckboxes(this.checkboxes) && mapLayer.layerData.dimensionId === this.dimensionId
  }
}
