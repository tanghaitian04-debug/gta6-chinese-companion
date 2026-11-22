import config from './data/map.json'

export function toLeaflet(x: number, y: number): [number, number] {
  const scale = 2 ** config.sourceZoom
  return [-y / scale, x / scale]
}

export function toPixel(lat: number, lng: number): [number, number] {
  const scale = 2 ** config.sourceZoom
  return [lng * scale, -lat * scale]
}

export function gameToPixel(x:number,y:number):[number,number] {
  return [config.worldTransform.originX+x,config.worldTransform.originY-y]
}

export function rasterQuality(pixelRatio:number) {
  const ratio=Math.max(1,Math.min(3,pixelRatio||1))
  const zoomOffset=Math.ceil(Math.log2(ratio))
  return {
    tileSize:config.tileSize/2**zoomOffset,
    zoomOffset,
    maxNativeZoom:config.maxTileZoom-zoomOffset,
    maxZoom:Math.floor((config.maxTileZoom-Math.log2(ratio))*4)/4,
  }
}
