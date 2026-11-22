import {useEffect,useRef,useState} from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {Crosshair, Maximize, Minimize, Minus, Plus, LocateFixed} from 'lucide-react'
import {poiColor,poiIcon,poiType} from './data/poi'
import {verified, type Place} from './data/schema'
import config from './data/map.json'
import {rasterQuality,toLeaflet} from './geometry'

const base=import.meta.env.BASE_URL
const [left,top,right,bottom]=config.fit
const fullBounds=L.latLngBounds(toLeaflet(left,bottom),toLeaflet(right,top))
const [cx0,cy0,cx1,cy1]=config.coverage
const mapBounds=L.latLngBounds(toLeaflet(cx0,cy1),toLeaflet(cx1,cy0))
const viewKey='leonida-companion.map.v1'
const gridName=config.grid
type Camera={lat:number,lng:number,zoom:number}

function readView(maxZoom:number): Camera | null {
  try {
    const v=JSON.parse(localStorage.getItem(viewKey) || 'null')
    if(v&&v.grid!==gridName){v.lat-=5376/64;v.lng+=5384/64}
    return v && Number.isFinite(v.lat) && Number.isFinite(v.lng) && Number.isFinite(v.zoom)
      && v.zoom >= -4 && mapBounds.contains([v.lat,v.lng]) ? {...v,zoom:Math.min(v.zoom,maxZoom)} : null
  } catch { return null }
}

function markerFor(item: Place, selected: boolean) {
  const position=item.position!
  const icon=L.divIcon({
    className:'point-icon',
    html:`<span style="--pin:${poiColor(item)}" class="map-pin ${position.precision === 'area' ? 'approx' : 'exact'} ${verified(item) ? '' : 'unverified'} ${selected ? 'selected' : ''}">${poiIcon(poiType(item))}</span>`,
    iconSize:[32,32],iconAnchor:[16,16],
  })
  return L.marker(toLeaflet(position.x,position.y),{icon,title:item.zh,alt:item.zh,riseOnHover:true,zIndexOffset:selected ? 1000 : 0})
}

export function MapView({items,active,focus,labels,style,full,onFull,onSelect}:{
  items:Place[],active:Place | undefined,focus:number,labels:boolean,style:string,full:boolean,
  onFull:()=>void,onSelect:(id:string)=>void,
}) {
  const node=useRef<HTMLDivElement>(null)
  const map=useRef<L.Map|null>(null)
  const group=useRef<L.LayerGroup|null>(null)
  const range=useRef<L.Circle|null>(null)
  const callback=useRef(onSelect)
  const quality=rasterQuality(window.devicePixelRatio)
  const [missing,setMissing]=useState(false)
  const [loading,setLoading]=useState(false)
  const [zoom,setZoom]=useState(0)
  const [online,setOnline]=useState(navigator.onLine)
  useEffect(() => { callback.current=onSelect },[onSelect])
  useEffect(()=>{
    const connection=()=>setOnline(navigator.onLine)
    addEventListener('online',connection)
    addEventListener('offline',connection)
    return ()=>{removeEventListener('online',connection);removeEventListener('offline',connection)}
  },[])
  useEffect(() => {
    if (!node.current) return
    const quality=rasterQuality(window.devicePixelRatio)
    const instance=L.map(node.current,{
      crs:L.CRS.Simple,zoomControl:false,attributionControl:false,minZoom:-3.5,maxZoom:quality.maxZoom,
      zoomSnap:0.25,zoomDelta:1,touchZoom:true,maxBounds:mapBounds.pad(0.4),maxBoundsViscosity:0.7,
      preferCanvas:true,
    })
    map.current=instance
    const overview=L.imageOverlay(base+'map/overview.webp',mapBounds,{alt:'雷奥奈达社区地图总览',interactive:false,zIndex:1}).addTo(instance)
    overview.on('error',()=>setMissing(true))
    const tiles=L.tileLayer(base+'map/tiles/{z}/{x}/{y}.jpg',{
      minZoom:Math.max(0,1-quality.zoomOffset),maxZoom:quality.maxZoom,maxNativeZoom:quality.maxNativeZoom,bounds:mapBounds,
      noWrap:true,keepBuffer:1,tileSize:quality.tileSize,zoomOffset:quality.zoomOffset,zIndex:2,
      errorTileUrl:base+'map/blank.svg',
    })
    const assetUrl=tiles.getTileUrl.bind(tiles)
    tiles.getTileUrl=coords=>{
      const range=config.upstreamRanges[coords.z+quality.zoomOffset-1]
      return range&&coords.x>=range[0]&&coords.y>=range[1]&&coords.x<=range[2]&&coords.y<=range[3]?assetUrl(coords):base+'map/water.svg'
    }
    let errorCount=0
    tiles.on('loading',()=>{errorCount=0;setLoading(true)})
    tiles.on('tileerror',()=>{errorCount++})
    tiles.on('load',()=>{setLoading(false);setMissing(errorCount>0)})
    tiles.addTo(instance)
    group.current=L.layerGroup().addTo(instance)
    const previous=readView(quality.maxZoom)
    if(previous) instance.setView([previous.lat,previous.lng],previous.zoom)
    else instance.fitBounds(fullBounds,{padding:[32,28]})
    setZoom(instance.getZoom())
    instance.on('moveend',()=>{
      setZoom(instance.getZoom())
      const {lat,lng}=instance.getCenter()
      try { localStorage.setItem(viewKey,JSON.stringify({lat,lng,zoom:instance.getZoom(),grid:gridName})) } catch { /* optional preference */ }
    })
    const observer=new ResizeObserver(()=>instance.invalidateSize({pan:false}))
    observer.observe(node.current)
    return ()=>{
      observer.disconnect()
      instance.remove()
      map.current=null
      group.current=null
      range.current=null
    }
  },[])
  useEffect(()=>{
    const instance=map.current
    const cluster=group.current
    if(!instance || !cluster) return
    const paintMap=instance
    const paintLayer=cluster
    const positioned=items.filter(item=>item.position)
    if(active?.position && !positioned.some(item=>item.id===active.id)) positioned.push(active)
    function paint(){
      paintLayer.clearLayers()
      const zoom=paintMap.getZoom()
      const grid=new Map<string,Place[]>()
      for(const item of positioned){
        const [lat,lng]=toLeaflet(item.position!.x,item.position!.y)
        const xy=paintMap.project([lat,lng],zoom)
        const cell=zoom>=4 ? 21 : zoom>=2 ? 31 : 48
        const key=item.id===active?.id||zoom>=paintMap.getMaxZoom() ? item.id : `${Math.floor(xy.x/cell)}:${Math.floor(xy.y/cell)}`
        const members=grid.get(key)
        if(members) members.push(item)
        else grid.set(key,[item])
      }
      for(const members of grid.values()){
        if(members.length>1){
          const bounds=L.latLngBounds(members.map(item=>toLeaflet(item.position!.x,item.position!.y)))
          const count=members.length
          const icon=L.divIcon({className:'cluster-icon',html:`<span>${count}</span>`,iconSize:[40,40]})
          const marker=L.marker(bounds.getCenter(),{icon,title:`查看 ${count} 个地点`})
          marker.on('click',()=>paintMap.fitBounds(bounds,{
            padding:[50,50],maxZoom:Math.min(paintMap.getMaxZoom(),zoom+2),animate:false,
          }))
          paintLayer.addLayer(marker)
          continue
        }
        const item=members[0]
        const marker=markerFor(item,item.id===active?.id)
        if(labels){
          const caption=document.createElement('span')
          caption.textContent=item.zh
          const permanent=item.category==='explore'&&item.subcategory==='城市与城区'&&verified(item)
          marker.bindTooltip(caption,{direction:'top',offset:[0,-9],permanent})
        }
        marker.on('click',()=>callback.current(item.id))
        paintLayer.addLayer(marker)
      }
    }
    paint()
    instance.on('zoomend',paint)
    range.current?.remove()
    range.current=null
    if(active?.position?.radius) {
      range.current=L.circle(toLeaflet(active.position.x,active.position.y),{
        radius:active.position.radius / (2 ** config.sourceZoom),color:poiColor(active),
        fillOpacity:0.14,weight:2,dashArray:'5 5',interactive:false,
      }).addTo(instance)
    }
    return ()=>{instance.off('zoomend',paint)}
  },[items,active,labels])
  useEffect(()=>{
    const instance=map.current
    const position=active?.position
    if(!instance || !position) return
    const center=toLeaflet(position.x,position.y)
    const desired=position.precision==='exact' ? 5 : position.radius && position.radius > 860 ? 2.2 : 4.25
    const initialZoom=Math.min(desired,instance.getMaxZoom()-.75)
    instance.setView(center,Math.max(instance.getZoom(),initialZoom),{animate:false})
  },[active,focus])
  return <div className={`map-stage map-style-${style}`}>
    <div className="map-canvas" ref={node} aria-label="雷奥奈达互动地图" data-testid="map-canvas" data-zoom={zoom} data-max-zoom={quality.maxZoom} />
    <div className="map-top-label"><LocateFixed size={15}/> 雷奥奈达 <span>LEONIDA</span></div>
    <div className="map-controls">
      <button aria-label="放大地图" disabled={zoom>=quality.maxZoom} onClick={()=>map.current?.zoomIn()}><Plus size={20}/></button>
      <button aria-label="缩小地图" onClick={()=>map.current?.zoomOut()}><Minus size={20}/></button>
      <button aria-label="返回全图" onClick={()=>map.current?.fitBounds(fullBounds,{padding:[32,28]})}><Crosshair size={19}/></button>
      <button aria-label={full?'退出地图全屏':'地图全屏'} onClick={onFull}>{full?<Minimize size={18}/>:<Maximize size={18}/>}</button>
    </div>
    <div className="map-quality" role="status">{!online?'离线 · 已缓存瓦片与总览':missing?'瓦片加载失败 · 显示总览':loading?'正在加载原生瓦片…':zoom>=quality.maxZoom?'已达设备原生清晰度上限':'Yanis v18 · 社区地形'}</div>
    <div className="map-credit">地图 © <a href="https://map.gtadb.org/" target="_blank" rel="noreferrer">Yanis · GTADB 社区</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></div>
  </div>
}
