import '../css/style.css'

import 'bootstrap'
import '~bootstrap/scss/bootstrap.scss'

import { Feature, Map, View } from 'ol'
import { Attribution, Zoom } from 'ol/control'
import { Point } from 'ol/geom'
import { Projection } from 'ol/proj'
import * as ol_style from 'ol/style'
import TileGrid from 'ol/tilegrid/TileGrid'
import '~ol/ol.css'

import PapyrusControls, { Checkbox } from './PapyrusControls'
import { Data, makeConstants, PlayersData } from './types'
import MapTileLayer from './MapTileLayer'
import MarkerLayer from './MarkerLayer'

async function main (): Promise<void> {
  const data: Data = await fetch('layers.json')
    .then(async (response) => await response.json())
    .catch((error) => {
      console.error('Failed to load layers.json:', error)
    })
  if (data === undefined) return
  const layers = data.layers
  const config = data.config

  const playersData: PlayersData | undefined = await fetch('playersData.json')
    .then(async (response) => await response.json())
    .catch((error) => {
      console.error('Failed to load playersData.json:', error)
    })

  const c = data.constants = makeConstants(data.config)

  // Use a projection where pixels have a 1:1 ratio with the screen at zoom level 0.
  const projection = new Projection({
    code: 'ZOOMIFY',
    units: 'pixels',
    extent: [
      0,
      0,
      c.openLayersInternalTileSize / c.tileSize,
      c.openLayersInternalTileSize / c.tileSize
    ]
  })

  // Construct the tile grid using the desired maximum and minimum extents listed above,
  // set the origin to [0, 0] (the center of the map), and the calculated resolutions array.
  const tileGrid = new TileGrid({
    extent: [
      c.minimumExtentSize,
      c.minimumExtentSize,
      c.maximumExtentSize,
      c.maximumExtentSize
    ],
    origin: [0, 0],
    resolutions: c.resolutions,
    tileSize: [c.tileSize, c.tileSize]
  })

  const view = new View({
    projection,
    center: [0, 0],
    zoom: 0,
    minZoom: 0,
    maxZoom: config.globalMaxZoom - config.globalMinZoom
  })

  const papyrusControls = new PapyrusControls(data)

  const map = new Map({
    target: 'map',
    layers: [],
    view,
    controls: [
      new Zoom(),
      new Attribution(),
      papyrusControls
    ]
  })

  Object.keys(layers)
    .sort()
    .forEach(function (layerKey: string, idx: number) {
      const tileLayer = new MapTileLayer(layerKey, layers[layerKey], { projection, tileGrid })
      map.addLayer(tileLayer)
      papyrusControls.addLayer(tileLayer)
    })

  const globalGroup = papyrusControls.createCheckboxGroup()

  const markersCheck = new Checkbox('Players', 'markers', null, (layer) => layer.layerType === 'markers')
  globalGroup.addCheckbox(markersCheck)

  if (typeof (playersData) !== 'undefined') {
    const playerFeatures: Array<Array<Feature<Point>>> = [[], [], []]
    // array for each dimension

    for (const player of playersData.players) {
      if (!player.visible) { continue }
      // hide players not visible

      const style = new ol_style.Style({
        text: new ol_style.Text({
          text: player.name + '\n\uf041', // map-marker
          font: "900 18px 'Font Awesome 5 Free'",
          textBaseline: 'bottom',
          fill: new ol_style.Fill({ color: player.color }),
          stroke: new ol_style.Stroke({ color: 'white', width: 2 })
        })
      })

      const playerFeature = new Feature({
        geometry: new Point([
          (player.position[0] * c.zoomRatioForMaximumZoom) / c.minecraftTilesAtMostZoomedInLevel,
          (-player.position[2] * c.zoomRatioForMaximumZoom) / c.minecraftTilesAtMostZoomedInLevel
        ])
      })

      playerFeature.setStyle(style)

      // add to the correct array/layer for the dimension
      playerFeatures[player.dimensionId].push(playerFeature)
    }

    for (let dimensionId = 0; dimensionId < 3; dimensionId++) {
      const vectorLayer = new MarkerLayer(`players_dim${dimensionId}`, playerFeatures[dimensionId], dimensionId)
      vectorLayer.addCheckbox(markersCheck.checkbox)

      if (dimensionId !== 0) {
        // initially display only overworld players
        vectorLayer.setVisible(false)
      }

      map.addLayer(vectorLayer)
    }
  }
}
main().catch(reason => console.error(reason))
