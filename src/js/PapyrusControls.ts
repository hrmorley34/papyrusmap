import { MapBrowserEvent, Map } from 'ol'
import { Control } from 'ol/control'
import { Coordinate } from 'ol/coordinate'
import BaseLayer from 'ol/layer/Base'

import MapTileLayer from './MapTileLayer'
import { Data, DataLayer } from './types'

export const DEFAULT_BACKGROUND = '#202020'

export type RequiredMapLayerCheckFunction = ((layer: MapTileLayer) => boolean)
export type MapLayerCheckFunction = RequiredMapLayerCheckFunction | null
export type AnyLayerCheckFunction = ((layer: DataLayer) => boolean) | null

export class Checkbox {
  element: HTMLDivElement
  checkbox: HTMLInputElement
  showsForLayer: MapLayerCheckFunction
  appliesToLayer: AnyLayerCheckFunction
  papyrusControls: PapyrusControls | null = null

  /**
   * @param label The text next to the checkbox
   * @param name The internal name of the control. Must be unique
   * @param showsForLayer A function to determine which base layers the checkbox is visible for. null means any
   * @param appliesToLayer A function to determine which layers are affected by this checkbox. null means try all
   */
  constructor (label: string, name: string, showsForLayer?: MapLayerCheckFunction, appliesToLayer?: AnyLayerCheckFunction) {
    const id = `checkbox-${name}`
    const checkContainer = document.createElement('div')
    checkContainer.className = 'form-check'

    const checkInput = document.createElement('input')
    checkInput.type = 'checkbox'
    checkInput.id = id
    checkInput.name = name
    checkInput.className = 'form-check-input'
    checkInput.checked = true
    checkInput.value = name
    checkContainer.appendChild(checkInput)
    this.checkbox = checkInput

    const checkLabel = document.createElement('label')
    checkLabel.htmlFor = id
    checkLabel.className = 'form-check-label'
    checkLabel.innerText = label
    checkContainer.appendChild(checkLabel)
    this.element = checkContainer

    this.showsForLayer = showsForLayer ?? null
    this.appliesToLayer = appliesToLayer ?? null
  }

  setControls (papyrusControls: PapyrusControls): void {
    this.papyrusControls = papyrusControls

    this.checkbox.addEventListener(
      'click',
      papyrusControls.selectFilteredLayer.bind(papyrusControls, this.appliesToLayer),
      false
    )
  }
}

export default class PapyrusControls extends Control {
  data: Data

  cardBodyElement: HTMLDivElement
  radioFormElement: HTMLFormElement
  locationElement: HTMLDivElement
  radios: HTMLInputElement[]

  markers: Checkbox

  currentSelectedLayer: string | null
  rememberedCenters: { [x: string]: Coordinate | undefined }
  rememberedZoom: { [x: string]: number | undefined }

  getTileLayerByKey (layerKey: string): MapTileLayer | null {
    const map = this.getMap()
    if (map === null) return null
    const layer = map.getLayers().getArray().find((runtimeLayer) => ((runtimeLayer as DataLayer).layerKey === layerKey))
    if ((layer as MapTileLayer).layerType !== 'map') return null
    return layer as MapTileLayer
  }

  get currentSelectedTileLayer (): MapTileLayer {
    if (this.currentSelectedLayer === null) throw Error('currentSelectedLayer is null')
    const layer = this.getTileLayerByKey(this.currentSelectedLayer)
    if (layer === null) throw Error('currentSelectedLayer is null')
    return layer
  }

  constructor (data: Data, options?: { target?: string | HTMLElement }) {
    options ??= {}

    const element = document.createElement('div')
    element.className = 'layer-select ol-unselectable'

    super({
      element,
      target: options.target
    })
    this.data = data

    const card = document.createElement('div')
    card.className = 'card'
    element.appendChild(card)

    this.cardBodyElement = document.createElement('div')
    this.cardBodyElement.className = 'card-body p-3 px-3'
    card.appendChild(this.cardBodyElement)

    this.radioFormElement = document.createElement('form')
    this.cardBodyElement.appendChild(this.radioFormElement)

    // this.currentSelectedLayer = Object.keys(layers).sort()[0]
    this.currentSelectedLayer = null
    this.rememberedCenters = {}
    this.rememberedZoom = {}
    this.radios = []

    this.cardBodyElement.appendChild(document.createElement('hr'))

    this.markers = new Checkbox('Players', 'markers', null, (layer) => layer.layerType === 'markers')
    this.cardBodyElement.appendChild(this.markers.element)
    this.markers.setControls(this)

    this.cardBodyElement.appendChild(document.createElement('hr'))

    this.locationElement = document.createElement('div')
    this.cardBodyElement.appendChild(this.locationElement)
    this.setLocationText(0, 0)
  }

  setMap (map: Map | null): void {
    super.setMap(map)
    if (map === null) return

    // add handler to new map
    map.on('pointermove', this.handlePointerMove.bind(this))

    this.currentSelectedLayer = null
    this.radios[0]?.click()
  }

  protected handlePointerMove (event: MapBrowserEvent<any>): void {
    const c = this.data.constants
    if (c === undefined) return

    const x = Math.floor(
      (event.coordinate[0] / c.zoomRatioForMaximumZoom) *
      c.minecraftTilesAtMostZoomedInLevel
    )
    const z = Math.floor(
      (-event.coordinate[1] / c.zoomRatioForMaximumZoom) *
      c.minecraftTilesAtMostZoomedInLevel
    )

    this.setLocationText(x, z)
  }

  protected setLocationText (x: number, z: number): void {
    this.locationElement.innerText = `X: ${x} Z: ${z}`
  }

  addLayer (this: PapyrusControls, layer: MapTileLayer): void {
    const radioContainer = document.createElement('div')
    radioContainer.className = 'form-check'

    const radioInput = document.createElement('input')
    radioInput.type = 'radio'
    radioInput.id = layer.layerKey
    radioInput.name = 'layers'
    radioInput.className = 'form-check-input'
    radioInput.checked = this.radios.length === 0
    radioInput.value = layer.layerKey
    radioContainer.appendChild(radioInput)
    this.radios.push(radioInput)

    const radioLabel = document.createElement('label')
    radioLabel.htmlFor = layer.layerKey
    radioLabel.className = 'form-check-label'
    radioLabel.innerText = layer.layerData.name
    radioContainer.appendChild(radioLabel)

    radioInput.addEventListener(
      'click',
      this.selectLayer.bind(this, layer.layerKey),
      false
    )
    this.radioFormElement.appendChild(radioContainer)

    if (this.radios.length === 1) {
      this.currentSelectedLayer = layer.layerKey
      layer.setVisible(true)
    } else {
      layer.setVisible(false)
    }
  }

  selectLayer (this: PapyrusControls, layerKey: string, e: MouseEvent): void {
    const map = this.getMap()
    if (map == null) return
    const mapElement = map.getTargetElement()
    const view = map.getView()
    const config = this.data.config

    if (this.currentSelectedLayer !== layerKey) {
      const runtimeLayers = map.getLayers()
      const olLayer = this.getTileLayerByKey(layerKey)
      if (olLayer?.layerKey === undefined) return
      const layer = olLayer.layerData

      mapElement.style.background = layer.background ?? DEFAULT_BACKGROUND

      runtimeLayers.forEach(function (this: PapyrusControls, runtimeLayer: BaseLayer) {
        if ((runtimeLayer as DataLayer).layerType === undefined) return
        const runtimeDataLayer = runtimeLayer as DataLayer
        runtimeDataLayer.setVisible(runtimeDataLayer.check(olLayer))
      })

      // const oldFocusGroup = this.currentSelectedLayer?.substring(0, 4) ?? null
      // const newFocusGroup = layerKey.substring(0, 4)
      const oldFocusGroup = this.currentSelectedTileLayer?.layerData?.dimensionId ?? null
      const newFocusGroup = layer.dimensionId

      if (oldFocusGroup !== null) { this.rememberedCenters[oldFocusGroup] = view.getCenter() }
      // set back to where we were, or refocus the map to 0, 0
      view.setCenter(this.rememberedCenters[newFocusGroup] ?? [0, 0])

      if (oldFocusGroup !== null) { this.rememberedZoom[oldFocusGroup] = view.getZoom() }
      view.setMinZoom(layer.minNativeZoom - config.globalMinZoom)
      view.setMaxZoom(layer.maxNativeZoom - config.globalMinZoom)
      // set back to where we were, or rezoom the map to minimum zoom
      view.setZoom(this.rememberedZoom[newFocusGroup] ?? layer.minNativeZoom - config.globalMinZoom)

      // this.radios.forEach((elem) => { elem.checked = (elem.value === layerKey) })

      this.currentSelectedLayer = layerKey
    }
  }

  selectFilteredLayer (this: PapyrusControls, check: AnyLayerCheckFunction, e: Event): void {
    const map = this.getMap()
    if (map == null) return
    const runtimeLayers = map.getLayers()
    runtimeLayers.forEach(function (this: PapyrusControls, runtimeLayer: BaseLayer) {
      const runtimeDataLayer = runtimeLayer as DataLayer
      if (runtimeDataLayer.layerType === undefined) return
      if (check !== null && !check(runtimeDataLayer)) return
      runtimeDataLayer.setVisible(runtimeDataLayer.check(this.currentSelectedTileLayer))
    }.bind(this))
  }
}
