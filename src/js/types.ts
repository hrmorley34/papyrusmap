import { AttributionLike } from 'ol/source/Source'

import MapTileLayer from './MapTileLayer'
import MarkerLayer from './MarkerLayer'

export interface Layer {
  name: string
  dimensionId: number
  attribution: AttributionLike
  minNativeZoom: number
  minZoom: number
  maxNativeZoom: number
  maxZoom: number
  noWrap: boolean
  background: string | null
  tileSize: number
  folder: string
  fileExtension: string
}
export interface Layers {
  [layerKey: string]: Layer
}

export interface Config {
  factor: number
  globalMinZoom: number
  globalMaxZoom: number
  tileSize: number
  blocksPerTile: number
}

export interface PlayerMarker {
  uuid: string
  name: string
  dimensionId: number
  position: [number, number, number]
  color: string
  visible: boolean
}

export interface PlayersData {
  players: PlayerMarker[]
}

export interface Constants {
  openLayersInternalTileSize: number
  tileSize: number
  maximumExtentSize: number
  minimumExtentSize: number
  papyrusMinimumZoomScale: number
  convertedFromTilesToPixelsUsingTileSize: number
  resolutions: number[]
  zoomRatioForMaximumZoom: number
  minecraftTilesAtMostZoomedInLevel: number
}

export function makeConstants (config: Config): Constants {
  // For the extent sizes specified below, OpenLayers tries to fit
  // the whole extents given in a space [0, 0] -> [2^8, 2^8] visually
  // on screen at zoom level 0.
  //
  // This constant represents that internal tile size that OpenLayers
  // will aim for, so that we can calculate zoom levels correctly later.
  const openLayersInternalTileSize = Math.pow(2, 8) // 256

  // The actual size of the tiles that we're using in Papyrus.
  const tileSize = config.tileSize

  // The maximum positive extents of the whole map. The units for this
  // value are "number of tiles at the most zoomed out level generated
  // by Papyrus". That is, if Papyrus generates a minimum zoom level
  // of 15, then the units for this extent size are the number of (Papyrus)
  // zoom level 15 tiles to display at (OpenLayers) zoom level 0.
  //
  // The minimum zoom level that Papyrus is using is in config.globalMinZoom.
  const maximumExtentSize = 10000

  // The minimum negative extents of the whole map. Uses the same units
  // as maximumExtentSize.
  const minimumExtentSize = -10000

  // Computes the resolutions array to use for OpenLayers. For each OpenLayers
  // zoom level (0 through 42), this computes the ratio such that a single tile
  // at OpenLayers zoom level 0 is a single tile at the minimum Papyrus zoom level.
  const papyrusMinimumZoomScale = Math.pow(2, config.globalMinZoom)
  const convertedFromTilesToPixelsUsingTileSize = papyrusMinimumZoomScale / tileSize
  const resolutions: number[] = new Array(43)
  for (let z = 0; z < 43; ++z) {
    resolutions[z] = convertedFromTilesToPixelsUsingTileSize / Math.pow(2, z)
  }

  // When we calculate resolutions above, we've effectively saying that zoom level 0 is
  // zoom level N, where N is the lowest zoom level. This zoom level N also becomes
  // the range of [0, 0] -> [1, 1] in the coordinate system. We need to be able to translate
  // coordinates in that "zoomed out" coordinate system, back down to the maximum zoom level
  // where each tile represents 32x32 (depending on tilesize) Minecraft tiles.
  const zoomRatioForMaximumZoom = 1 / Math.pow(2, config.globalMaxZoom - config.globalMinZoom)
  const minecraftTilesAtMostZoomedInLevel = config.blocksPerTile

  return {
    openLayersInternalTileSize,
    tileSize,
    maximumExtentSize,
    minimumExtentSize,
    papyrusMinimumZoomScale,
    convertedFromTilesToPixelsUsingTileSize,
    resolutions,
    zoomRatioForMaximumZoom,
    minecraftTilesAtMostZoomedInLevel
  }
}

export interface Data {
  layers: Layers
  config: Config
  playersData?: PlayerMarker
  constants?: Constants
}

export type DataLayerKeyType = 'map' | 'markers'

export interface DataLayerContents {
  layerType: DataLayerKeyType
  layerKey: string

  check: (mapLayer: MapTileLayer) => boolean
}

export interface DataLayerCheckable extends DataLayerContents {
  addCheckbox: (checkbox: HTMLInputElement) => void
}

export type DataLayer = MapTileLayer | MarkerLayer
