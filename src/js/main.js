import '../css/style.css';

import 'bootstrap';
import '~bootstrap/scss/bootstrap.scss';

import { Feature, Map, View } from 'ol';
import { Attribution, Control, Zoom } from 'ol/control';
import { Point } from 'ol/geom';
import { Tile, Vector as VectorLayer } from 'ol/layer';
import { Projection } from 'ol/proj';
import { Vector as VectorSource, XYZ } from 'ol/source';
import * as ol_style from 'ol/style';
import TileGrid from 'ol/tilegrid/TileGrid';
import '~ol/ol.css';

import $ from 'jquery';


(async function () {
  var layers = {
    dim0: {
      name: "Overworld",
      dimensionId: 0,
      attribution:
        '<a href="https://github.com/hrmorley34/papyruscs">PapyrusCS</a>',
      minNativeZoom: 15,
      minZoom: 15,
      maxNativeZoom: 20,
      maxZoom: 22,
      noWrap: true,
      tileSize: 512,
      folder: "dim0",
      fileExtension: "png"
    }
  };

  var config = {
    factor: 1
  };

  await fetch("layers.json")
    .then((response) => response.json())
    .then((result) => {
      const layersjs = result;
      layers = layersjs.layers;
      config = layersjs.config;
    }, (error) => {
      console.error("Failed to load layers.json:", error);
    });

  var playersData = undefined;
  await fetch("playersData.json")
    .then((response) => response.json())
    .then((result) => {
      playersData = result;
    }, (error) => {
      console.error("Failed to load playersData.json:", error);
    });

  // For the extent sizes specified below, OpenLayers tries to fit
  // the whole extents given in a space [0, 0] -> [2^8, 2^8] visually
  // on screen at zoom level 0.
  //
  // This constant represents that internal tile size that OpenLayers
  // will aim for, so that we can calculate zoom levels correctly later.
  const openLayersInternalTileSize = Math.pow(2, 8); // 256

  // The actual size of the tiles that we're using in Papyrus.
  const tileSize = config.tileSize;

  // The maximum positive extents of the whole map. The units for this
  // value are "number of tiles at the most zoomed out level generated
  // by Papyrus". That is, if Papyrus generates a minimum zoom level
  // of 15, then the units for this extent size are the number of (Papyrus)
  // zoom level 15 tiles to display at (OpenLayers) zoom level 0.
  //
  // The minimum zoom level that Papyrus is using is in config.globalMinZoom.
  const maximumExtentSize = 10000;

  // The minimum negative extents of the whole map. Uses the same units
  // as maximumExtentSize.
  const minimumExtentSize = -10000;

  // Computes the resolutions array to use for OpenLayers. For each OpenLayers
  // zoom level (0 through 42), this computes the ratio such that a single tile
  // at OpenLayers zoom level 0 is a single tile at the minimum Papyrus zoom level.
  const papyrusMinimumZoomScale = Math.pow(2, config.globalMinZoom);
  const convertedFromTilesToPixelsUsingTileSize = papyrusMinimumZoomScale / tileSize;
  const resolutions = new Array(43);
  for (let z = 0; z < 43; ++z) {
    resolutions[z] = convertedFromTilesToPixelsUsingTileSize / Math.pow(2, z);
  }

  // When we calculate resolutions above, we've effectively saying that zoom level 0 is
  // zoom level N, where N is the lowest zoom level. This zoom level N also becomes
  // the range of [0, 0] -> [1, 1] in the coordinate system. We need to be able to translate
  // coordinates in that "zoomed out" coordinate system, back down to the maximum zoom level
  // where each tile represents 32x32 (depending on tilesize) Minecraft tiles.
  const zoomRatioForMaximumZoom = 1 / Math.pow(2, config.globalMaxZoom - config.globalMinZoom);
  const minecraftTilesAtMostZoomedInLevel = config.blocksPerTile;

  // Use a projection where pixels have a 1:1 ratio with the screen at zoom level 0.
  const projection = new Projection({
    code: "ZOOMIFY",
    units: "pixels",
    extent: [
      0,
      0,
      openLayersInternalTileSize / tileSize,
      openLayersInternalTileSize / tileSize
    ]
  });

  // Construct the tile grid using the desired maximum and minimum extents listed above,
  // set the origin to [0, 0] (the center of the map), and the calculated resolutions array.
  const tilegrid = new TileGrid({
    extent: [
      minimumExtentSize,
      minimumExtentSize,
      maximumExtentSize,
      maximumExtentSize
    ],
    origin: [0, 0],
    resolutions: resolutions,
    tileSize: [tileSize, tileSize]
  });

  let map;
  let locationElement;

  const tileLayers = Object.keys(layers)
    .sort()
    .map(function (layerKey, idx) {
      const layer = layers[layerKey];
      const tileLayer = new Tile({
        source: new XYZ({
          tileUrlFunction: function (tileCoord, pixelRatio, projection) {
            const z = tileCoord[0];
            const x = tileCoord[1];
            const y = tileCoord[2];
            return (
              "./" +
              layer.folder +
              "/" +
              z +
              "/" +
              x +
              "/" +
              y +
              "." +
              layer.fileExtension
            );
          },
          projection: projection,
          tileGrid: tilegrid,
          attributions: layer.attribution
        }),
        visible: idx == 0
      });
      // Add a dimensionId from the layer key if missing (dim1 -> 1, dim0_stronghold -> 0)
      layer.dimensionId ??= parseInt(layerKey.substring(3));
      tileLayer.metaLayerKey = { dimensionId: layer.dimensionId, layerKey, type: "map" };
      return tileLayer;
    });

  if (Object.keys(layers).sort()[0] == "dim0_stronghold") {
    document.getElementById("map").style.background = "#fff";
  } else {
    document.getElementById("map").style.background = "#202020";
  }

  const view = new View({
    projection: projection,
    center: [0, 0],
    zoom: 0,
    minZoom: 0,
    maxZoom: config.globalMaxZoom - config.globalMinZoom
  });

  class PapyrusControls extends Control {
    constructor(opt_options) {
      const options = opt_options || {};

      const element = document.createElement("div");
      element.className = "layer-select ol-unselectable";

      const card = document.createElement("div");
      card.className = "card";
      element.appendChild(card);

      const cardBody = document.createElement("div");
      cardBody.className = "card-body p-3 px-3";
      card.appendChild(cardBody);

      const form = document.createElement("form");
      cardBody.appendChild(form);

      let currentSelectedLayer = Object.keys(layers).sort()[0];
      let rememberedCenters = {};
      let rememberedZoom = {};

      Object.keys(layers)
        .sort()
        .forEach(function (layerKey, idx) {
          const layer = layers[layerKey];

          const radioContainer = document.createElement("div");
          radioContainer.className = "custom-control custom-radio";
          // radioContainer.className = "form-check";

          const radioInput = document.createElement("input");
          radioInput.type = "radio";
          radioInput.id = layerKey;
          radioInput.name = "layers";
          radioInput.className = "custom-control-input";
          // radioInput.className = "form-check-input";
          radioInput.checked = idx == 0;
          radioInput.value = layerKey;
          radioContainer.appendChild(radioInput);

          const radioLabel = document.createElement("label");
          radioLabel.htmlFor = layerKey;
          radioLabel.className = "custom-control-label";
          // radioLabel.className = "form-check-label";
          radioLabel.innerText = layer.name;
          radioContainer.appendChild(radioLabel);

          const selectLayer = function (e) {
            if (layerKey == "dim0_stronghold") {
              document.getElementById("map").style.background = "#fff";
            } else {
              document.getElementById("map").style.background = "#202020";
            }

            if (currentSelectedLayer != layerKey) {
              const runtimeLayers = map.getLayers();
              runtimeLayers.forEach(function (runtimeLayer) {
                runtimeLayer.setVisible(
                  (runtimeLayer.metaLayerKey.layerKey == layerKey && runtimeLayer.metaLayerKey.type == "map")
                  || (runtimeLayer.metaLayerKey.dimensionId == layer.dimensionId && runtimeLayer.metaLayerKey.type == "player")
                ); // show image layer, and player layer based on dimension
              });

              const oldFocusGroup = currentSelectedLayer.substring(0, 4);
              const newFocusGroup = layerKey.substring(0, 4);

              rememberedCenters[oldFocusGroup] = view.getCenter();
              if (rememberedCenters[newFocusGroup] === undefined) {
                // refocus the map to 0, 0
                view.setCenter([0, 0]);
              } else {
                // set back to where we were
                view.setCenter(rememberedCenters[newFocusGroup]);
              }

              rememberedZoom[oldFocusGroup] = view.getZoom();
              view.setMinZoom(layer.minNativeZoom - config.globalMinZoom);
              view.setMaxZoom(layer.maxNativeZoom - config.globalMinZoom);
              if (rememberedZoom[newFocusGroup] === undefined) {
                // rezoom the map to minimum zoom
                view.setZoom(layer.minNativeZoom - config.globalMinZoom);
              } else {
                // set back to where we were
                view.setZoom(rememberedZoom[newFocusGroup]);
              }

              const radios = $("input[name='layers']");
              radios.each(function (idx, elem) {
                if (elem.value == layerKey) {
                  elem.checked = true;
                } else {
                  elem.checked = false;
                }
              });

              currentSelectedLayer = layerKey;
            }
          };

          radioInput.addEventListener(
            "click",
            selectLayer.bind(this),
            false
          );

          form.appendChild(radioContainer);
        });

      const hr = document.createElement("hr");
      form.appendChild(hr);

      locationElement = document.createElement("div");
      locationElement.innerText = "X: 0, Z: 0";
      form.appendChild(locationElement);

      super({
        element: element,
        target: options.target
      });
    }
  }
  PapyrusControls.__proto__ = Control;

  map = new Map({
    target: "map",
    layers: tileLayers,
    view: view,
    controls: [
      new Zoom(),
      new Attribution(),
      new PapyrusControls()
    ]
  });

  map.on("pointermove", function (event) {
    var x = Math.floor(
      (event.coordinate[0] / zoomRatioForMaximumZoom) *
      minecraftTilesAtMostZoomedInLevel
    );
    var z = Math.floor(
      (-event.coordinate[1] / zoomRatioForMaximumZoom) *
      minecraftTilesAtMostZoomedInLevel
    );

    locationElement.innerText = "X: " + x + " Z: " + z;
  });

  if (typeof (playersData) !== "undefined") {
    var playerFeatures = [[], [], []];
    // array for each dimension

    for (var playerIndex in playersData.players) {
      var player = playersData.players[playerIndex];

      if (!player.visible) { continue; }
      // hide players not visible

      var style = new ol_style.Style({
        text: new ol_style.Text({
          text: player.name + "\n\uf041", // map-marker
          font: "900 18px 'Font Awesome 5 Free'",
          textBaseline: "bottom",
          fill: new ol_style.Fill({ color: player.color }),
          stroke: new ol_style.Stroke({ color: "white", width: 2 })
        })
      });

      var playerFeature = new Feature({
        geometry: new Point([
          (player.position[0] * zoomRatioForMaximumZoom) / minecraftTilesAtMostZoomedInLevel,
          (-player.position[2] * zoomRatioForMaximumZoom) / minecraftTilesAtMostZoomedInLevel
        ])
      });

      playerFeature.setStyle(style);

      playerFeatures[player.dimensionId].push(playerFeature);
      // add to the correct array/layer for the dimension
    }

    for (var dimensionId = 0; dimensionId < 3; dimensionId++) {
      var vectorSource = new VectorSource({
        features: playerFeatures[dimensionId]
      });

      var vectorLayer = new VectorLayer({
        source: vectorSource
      });

      vectorLayer.metaLayerKey = { layerKey: "players_dim" + dimensionId, dimensionId, type: "player" };

      if (dimensionId != 0) {
        // initially display only overworld players
        vectorLayer.values_.visible = false;
      }

      map.addLayer(vectorLayer);
    }
  }
})();
