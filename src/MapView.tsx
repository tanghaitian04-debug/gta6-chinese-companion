import {useEffect,useRef,useState} from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import {Crosshair, Maximize, Minimize, Minus, Plus, LocateFixed} from 'lucide-react'
import {categoryColors} from './data/categories'
import {verified, type Place} from './data/schema'
import config from './data/map.json'
import {toLeaflet} from './geometry'

const base=import.meta.env.BASE_URL
const [left,top,right,bottom]=config.fit
const fullBounds=L.latLngBounds(toLeaflet(left,bottom),toLeaflet(right,top))
const mapBounds=L.latLngBounds(toLeaflet(0,config.height),toLeaflet(config.width,0))
const viewKey='leonida-companion.map.v1'
type Camera={lat:number,lng:number,zoom:number}

function readView(): Camera | null {
  try {
    const v=JSON.parse(localStorage.getItem(viewKey) || 'null')
    return v && Number.isFinite(v.lat) && Number.isFinite(v.lng) && Number.isFinite(v.zoom)
      && v.zoom >= -4 && v.zoom <= 6 && mapBounds.contains([v.lat,v.lng]) ? v : null
  } catch { return null }
}

function markerFor(item: Place, selected: boolean) {
  const position=item.position!
  const icon=L.divIcon({
    className:'point-icon',
    html:`<span style="--pin:${categoryColors[item.category]}" class="map-pin ${position.precision === 'area' ? 'approx' : 'exact'} ${verified(item) ? '' : 'unverified'} ${selected ? 'selected' : ''}"><i></i></span>`,
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
  const group=useRef<L.MarkerClusterGroup|null>(null)
  const range=useRef<L.Circle|null>(null)
  const markers=useRef(new Map<string,L.Marker>())
  const callback=useRef(onSelect)
  const [missing,setMissing]=useState(false)
  useEffect(() => { callback.current=onSelect },[onSelect])
  useEffect(() => {
    if (!node.current) return
    const instance=L.map(node.current,{
      crs:L.CRS.Simple,zoomControl:false,attributionControl:false,minZoom:-3.5,maxZoom:6,
      zoomSnap:0.25,zoomDelta:1,touchZoom:true,maxBounds:mapBounds.pad(0.4),maxBoundsViscosity:0.7,
      preferCanvas:true,
    })
    map.current=instance
    const overview=L.imageOverlay(base+'map/overview.webp',mapBounds,{alt:'雷奥奈达社区地图总览',interactive:false,zIndex:1}).addTo(instance)
    overview.on('error',()=>setMissing(true))
    const tiles=L.tileLayer(base+'map/tiles/{z}/{x}/{y}.webp',{
      minZoom:1,maxZoom:6,maxNativeZoom:config.maxTileZoom,bounds:mapBounds,
      noWrap:true,keepBuffer:2,tileSize:config.tileSize,zIndex:2,
      errorTileUrl:base+'map/blank.svg',
    }).addTo(instance)
    const cluster=L.markerClusterGroup({
      disableClusteringAtZoom:4.5,maxClusterRadius:46,showCoverageOnHover:false,
      spiderfyOnMaxZoom:true,chunkedLoading:false,
      iconCreateFunction: c => L.divIcon({className:'cluster-icon',html:`<span>${c.getChildCount()}</span>`,iconSize:[40,40]}),
    }).addTo(instance)
    group.current=cluster
    const previous=readView()
    if(previous) instance.setView([previous.lat,previous.lng],previous.zoom)
    else instance.fitBounds(fullBounds,{padding:[32,28]})
    instance.on('moveend',()=>{
      const {lat,lng}=instance.getCenter()
      try { localStorage.setItem(viewKey,JSON.stringify({lat,lng,zoom:instance.getZoom()})) } catch { /* optional preference */ }
    })
    const observer=new ResizeObserver(()=>instance.invalidateSize({pan:false}))
    observer.observe(node.current)
    tiles.on('tileload',()=>setMissing(false))
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
    const positioned=items.filter(item=>item.position)
    if(active?.position && !positioned.some(item=>item.id===active.id)) positioned.push(active)
    cluster.clearLayers()
    range.current?.remove()
    range.current=null
    markers.current.clear()
    const layer=positioned.map(item=>{
      const marker=markerFor(item,item.id===active?.id)
      if(labels) {
        const caption=document.createElement('span')
        caption.textContent=item.zh
        marker.bindTooltip(caption,{direction:'top',offset:[0,-9],permanent:item.category==='explore' && item.subcategory==='城市与城区' && verified(item)})
      }
      marker.on('click',()=>callback.current(item.id))
      markers.current.set(item.id,marker)
      return marker
    })
    cluster.addLayers(layer)
    if(active?.position?.radius) {
      range.current=L.circle(toLeaflet(active.position.x,active.position.y),{
        radius:active.position.radius / (2 ** config.sourceZoom),color:categoryColors[active.category],
        fillOpacity:0.14,weight:2,dashArray:'5 5',interactive:false,
      }).addTo(instance)
    }
  },[items,active,labels])
  useEffect(()=>{
    const instance=map.current
    const position=active?.position
    if(!instance || !position) return
    const center=toLeaflet(position.x,position.y)
    const zoom=position.precision==='exact' ? 5 : position.radius && position.radius > 430 ? 2.2 : 4.3
    instance.setView(center,Math.max(instance.getZoom(),zoom),{animate:false})
  },[active,focus])
  return <div className={`map-stage map-style-${style}`}>
    <div className="map-canvas" ref={node} aria-label="雷奥奈达互动地图" data-testid="map-canvas" />
    <div className="map-top-label"><LocateFixed size={15}/> 雷奥奈达 <span>LEONIDA</span></div>
    <div className="map-controls">
      <button aria-label="放大地图" onClick={()=>map.current?.zoomIn()}><Plus size={20}/></button>
      <button aria-label="缩小地图" onClick={()=>map.current?.zoomOut()}><Minus size={20}/></button>
      <button aria-label="返回全图" onClick={()=>map.current?.fitBounds(fullBounds,{padding:[32,28]})}><Crosshair size={19}/></button>
      <button aria-label={full?'退出地图全屏':'地图全屏'} onClick={onFull}>{full?<Minimize size={18}/>:<Maximize size={18}/>}</button>
    </div>
    {missing && <p className="map-notice" role="status">底图加载失败。联网后可重新打开地图。</p>}
    <div className="map-credit">地图 © <a href="https://map.gtadb.org/" target="_blank" rel="noreferrer">Yanis · GTADB 社区</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></div>
  </div>
}
