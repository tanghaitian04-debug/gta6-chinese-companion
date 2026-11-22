import config from './data/map.json'

export function toLeaflet(x: number, y: number): [number, number] {
  const scale = 2 ** config.sourceZoom
  return [-y / scale, x / scale]
}

export function toPixel(lat: number, lng: number): [number, number] {
  const scale = 2 ** config.sourceZoom
  return [lng * scale, -lat * scale]
}
