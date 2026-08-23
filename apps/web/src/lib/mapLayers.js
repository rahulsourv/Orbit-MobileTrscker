/**
 * Basemaps, all key-free.
 *
 * Every one of these is usable without an account or a card on file, which is
 * the whole reason Orbit does not depend on Google Maps. Attribution is not
 * optional here - it is the condition each of these providers sets for free
 * use, so it travels with the layer definition rather than being bolted on.
 */
export const MAP_LAYERS = {
  dark: {
    label: "Dark",
    // Two layers so place names stay legible above accent-coloured markers.
    url: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
    labels: "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    dark: true,
  },
  street: {
    label: "Street",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    dark: false,
  },
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    // Imagery alone has no place names, so a transparent label layer goes on top.
    labels:
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
    attribution:
      "Imagery &copy; Esri, Maxar, Earthstar Geographics &middot; Labels &copy; CARTO",
    maxZoom: 19,
    dark: true,
  },
  terrain: {
    label: "Terrain",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    // OpenTopoMap stops here; asking for more just returns blank tiles.
    maxZoom: 17,
    dark: false,
  },
};

export const LAYER_KEYS = Object.keys(MAP_LAYERS);

export const DEFAULT_LAYER = "dark";

export const TRAVEL_MODES = [
  { value: "driving", label: "Drive" },
  { value: "walking", label: "Walk" },
  { value: "cycling", label: "Cycle" },
];
