import {lazy,Suspense,useEffect,useMemo,useRef,useState,type CSSProperties,type FormEvent,type ReactNode} from 'react'
import {
  BookOpen, CarFront, Check, ChevronRight, CircleHelp, Compass, Download, ExternalLink, Eye, EyeOff,
  Flag as FlagIcon, Gamepad2, House, Layers3, LibraryBig, ListFilter, Map as MapIcon, MapPin, Search,
  Share2, ShieldCheck, Star, Target, Trophy, Upload, UserRound, X, Navigation, Clock3, Menu,
} from 'lucide-react'
import {byId,entries,places,records,stats} from './data/content'
import {categories,categoryIds,categoryColors,categoryNames,confidenceIds,confidenceNames,regionIds,regionNames,type Category} from './data/categories'
import {verified,type Entry,type Place,type RecordItem} from './data/schema'
import {articles,articleStatus,type Article} from './data/articles'
import {poiIcon,poiType,poiTypes,quickTypes,type PoiType} from './data/poi'
import {createSearch} from './search'
import {addProfile,blankFlag,parseBackup,replaceProgress,resetCategory,selectProfile,toggleCheck,updateFlag,useProgress,type Flag} from './progress'

const MapView=lazy(()=>import('./MapView').then(module=>({default:module.MapView})))
const officialMedia='https://www.rockstargames.com/VI/media'
const repo='https://github.com/tanghaitian04-debug/gta6-chinese-companion'
const base=import.meta.env.BASE_URL
const nav=[
  ['home','首页',House],['map','地图',MapIcon],['guide','攻略',BookOpen],['library','资料库',LibraryBig],['me','我的',UserRound],
] as const
const routes=['home','map','guide','library','me','cheats','completion','sources'] as const
type Route=typeof routes[number]
type RouteData={page:Route,id:string,filter:string}
type ItemHandler=(item:RecordItem)=>void
type Profile=ReturnType<typeof useProgress>['profile']
const kindName:Record<Entry['kind'],string>={mission:'任务攻略',character:'角色',vehicle:'载具',weapon:'武器',collection:'收集品',cheat:'秘籍',completion:'100% 条件',guide:'玩法攻略'}
const primaryPlaces=places.filter(verified)
const search=createSearch(records.filter(verified))
const reviewSearch=createSearch(records.filter(item=>!verified(item)))
const mapSearch=createSearch(places)
const mapSearchDefault=createSearch(primaryPlaces)

function readRoute():RouteData {
  const [name='',query='']=location.hash.slice(1).replace(/^\//,'').split('?')
  const page=routes.includes(name as Route)?name as Route:'home'
  const params=new URLSearchParams(query)
  return {page,id:params.get('id') ?? '',filter:params.get('filter') ?? ''}
}
function href(page:Route,id='',filter='') {
  const params=new URLSearchParams()
  if(id)params.set('id',id)
  if(filter)params.set('filter',filter)
  return '#/'+page+(params.size?'?'+params.toString():'')
}
function readPref<T>(key:string,fallback:T):T {
  try {const value=localStorage.getItem('leonida-companion.'+key);return value ? JSON.parse(value) as T : fallback}
  catch{return fallback}
}
function writePref(key:string,value:unknown){
  try{localStorage.setItem('leonida-companion.'+key,JSON.stringify(value))}catch{/* optional preference */}
}
function usePreference<T>(key:string,fallback:T) {
  const [value,set]=useState(()=>readPref(key,fallback))
  return [value,(next:T)=>{set(next);writePref(key,next)}] as const
}
function pageFor(item:RecordItem):Route {
  if(item.kind==='place') return 'map'
  if(item.kind==='mission'||item.kind==='guide') return 'guide'
  if(item.kind==='cheat')return 'cheats'
  if(item.kind==='completion')return 'completion'
  return 'library'
}
function labelFor(item:RecordItem){return item.kind==='place'?item.subcategory:kindName[item.kind]}
function Chip({children,tone=''}:{children:ReactNode,tone?:string}){return <span className={`chip ${tone}`}>{children}</span>}
function Badge({item}:{item:RecordItem}){return <Chip tone={verified(item)?'verified':'uncertain'}>{confidenceNames[item.confidence]}</Chip>}
function External({url,children}:{url:string,children:ReactNode}){return <a href={url} target="_blank" rel="noreferrer">{children} <ExternalLink aria-hidden size={13}/></a>}
function Empty({children='暂无已核验条目'}:{children?:ReactNode}){return <p className="empty">{children}</p>}
function ProgressRing({done,total}:{done:number,total:number}){
  const pct=total?Math.round(done/total*100):0
  return <div className="ring" style={{'--pct':pct+'%'} as CSSProperties} aria-label={`探索进度 ${pct}%`}><span>{pct}<small>%</small></span></div>
}
function Row({item,open,spoiler=false}:{item:RecordItem,open:ItemHandler,spoiler?:boolean}){
  const hidden=item.spoiler&&!spoiler
  const color=item.kind==='place'?categoryColors[item.category]:'#caa7ff'
  return <button className="result-row" onClick={()=>open(item)}>
    <span className="row-icon" style={{'--marker-color':color} as CSSProperties}>{item.kind==='place'?<MapPin size={17}/>:<BookOpen size={17}/>}</span>
    <span className="result-name"><strong>{hidden?'剧透条目':item.zh}</strong><small>{hidden?labelFor(item):item.en}</small></span>
    <ChevronRight size={16} className="row-next"/>
  </button>
}
function GlobalSearch({open,spoiler,expanded,setExpanded}:{open:ItemHandler,spoiler:boolean,expanded:boolean,setExpanded:(value:boolean)=>void}) {
  const ref=useRef<HTMLInputElement>(null)
  const [query,setQuery]=useState('')
  const [history,setHistory]=usePreference<string[]>('history',[])
  const [region,setRegion]=useState('')
  const [type,setType]=useState('')
  const [confidence,setConfidence]=useState('')
  const source=confidence==='pending'||confidence==='disputed'?reviewSearch:search
  const results=query.trim()?source(query).filter(item=> (spoiler||!item.spoiler) && (!region||item.region===region) && (!type||item.kind===type) && (!confidence||item.confidence===confidence)).slice(0,16):[]
  useEffect(()=>{if(expanded)ref.current?.focus()},[expanded])
  function pick(item:RecordItem){
    const q=query.trim()
    if(q)setHistory([q,...history.filter(s=>s!==q)].slice(0,6))
    setExpanded(false)
    setQuery('')
    open(item)
  }
  if(!expanded)return null
  return <div className="veil search-veil" onClick={()=>setExpanded(false)}>
    <section className="search-box panel" role="dialog" aria-modal="true" aria-label="全站搜索" onClick={event=>event.stopPropagation()}
      onKeyDown={event=>{if(event.key==='Escape')setExpanded(false);if(event.key==='Enter'&&event.target===ref.current&&results[0])pick(results[0])}}>
      <div className="search-input dialog-input"><Search size={21}/><input ref={ref} value={query} onChange={e=>setQuery(e.target.value)} placeholder="地点、任务、载具、武器…" aria-label="全站关键词"/><button className="icon-button" aria-label="关闭搜索" onClick={()=>setExpanded(false)}><X size={20}/></button></div>
      <div className="search-filters">
        <select aria-label="搜索地区" value={region} onChange={e=>setRegion(e.target.value)}><option value="">全部地区</option>{regionIds.map(r=><option value={r} key={r}>{regionNames[r]}</option>)}</select>
        <select aria-label="搜索类型" value={type} onChange={e=>setType(e.target.value)}><option value="">全部类型</option><option value="place">地点</option>{Object.entries(kindName).map(([id,name])=><option value={id} key={id}>{name}</option>)}</select>
        <select aria-label="搜索可信度" value={confidence} onChange={e=>setConfidence(e.target.value)}><option value="">全部可信度</option>{confidenceIds.map(c=><option value={c} key={c}>{confidenceNames[c]}</option>)}</select>
      </div>
      {query.trim()?<div className="dialog-results">{results.length?results.map(item=><Row key={item.id} item={item} open={pick} spoiler={spoiler}/>):<Empty>没有找到符合条件的资料</Empty>}</div>:
        <div className="search-suggestions">
          {history.length>0&&<><h3>最近搜索</h3><div className="tabs">{history.map(term=><button type="button" key={term} onClick={()=>setQuery(term)}>{term}</button>)}</div></>}
          <h3>常用搜索</h3><div className="tabs">{['机场','罪恶城','收集品','载具','冥想'].map(term=><button type="button" key={term} onClick={()=>setQuery(term)}>{term}</button>)}</div>
        </div>}
    </section>
  </div>
}

function Home({profile,open,onSearch}:{profile:Profile,open:ItemHandler,onSearch:()=>void}){
  const ordered=[...primaryPlaces].sort((a,b)=>(profile.items[b.id]?.touched??0)-(profile.items[a.id]?.touched??0))
  const favorites=ordered.filter(item=>profile.items[item.id]?.favorite).slice(0,4)
  const visits=ordered.filter(item=>profile.items[item.id]?.visited).slice(0,4)
  const completed=primaryPlaces.filter(item=>profile.items[item.id]?.visited||profile.items[item.id]?.collected).length
  const shortcuts=[
    ['map','收集追踪','查看地图收集点',Target,'collectibles'],
    ['guide','任务攻略','默认无剧透',BookOpen,''],
    ['library','载具图鉴','车型与资料来源',CarFront,'vehicle'],
    ['completion','100% 清单','按游戏条件逐项勾选',Trophy,''],
  ] as const
  return <main className="page home-page">
    <section className="hero">
      <img className="hero-map" src={base+'map/cover.webp'} alt="" fetchPriority="high"/>
      <div className="hero-overlay"/>
      <div className="hero-content">
        <p className="eyebrow"><Compass size={16}/> LEONIDA COMPANION</p>
        <h1>GTA 6 中文<br/><span>全能助手</span></h1>
        <p className="hero-tagline">少看攻略，多玩一会儿。</p>
        <div className="hero-actions">
          <a className="button primary" href={href('map')}><MapIcon size={19}/>进入地图</a>
          <button className="button ghost" onClick={onSearch}><Search size={18}/>全站搜索</button>
        </div>
      </div>
      <span className="hero-credit">社区地图 · GTADB / Yanis · CC BY 4.0</span>
    </section>
    <div className="dashboard">
      <section className="panel overview">
        <div><h2>我的探索</h2><p>网站地点进度</p><strong>{completed} <small>/ {primaryPlaces.length} 处已记录</small></strong><a className="text-action" href={href('me')}>管理存档 <ChevronRight size={15}/></a></div>
        <ProgressRing done={completed} total={primaryPlaces.length}/>
      </section>
      <section className="panel data-overview">
        <div className="section-top"><h2>资料核验</h2><ShieldCheck size={20}/></div>
        <div className="stats"><div><strong>{stats.verified}</strong><small>已核验</small></div><div><strong>{stats.pending}</strong><small>待核验</small></div><div><strong>{stats.exact}</strong><small>精确点位</small></div></div>
        <a className="text-action" href={href('sources')}>最近审查 {stats.date} <ChevronRight size={15}/></a>
      </section>
    </div>
    <section className="home-section"><h2>常用工具</h2><div className="shortcuts">{shortcuts.map(([page,title,copy,Icon,filter])=>
      <a className="shortcut panel" href={href(page,'',filter)} key={title}><span className="shortcut-icon"><Icon size={21}/></span><div><strong>{title}</strong><small>{copy}</small></div><ChevronRight size={17}/></a>)}</div></section>
    <div className="dashboard history-panels">
      <section className="panel"><h2><Star size={20}/>最近收藏</h2>{favorites.length?favorites.map(item=><Row key={item.id} item={item} open={open}/>):<Empty>在地点详情中点「收藏」，方便下次继续找。</Empty>}</section>
      <section className="panel"><h2><Clock3 size={20}/>最近到达</h2>{visits.length?visits.map(item=><Row key={item.id} item={item} open={open}/>):<Empty>在地点详情中标记「已到达」，这里会显示探索记录。</Empty>}</section>
    </div>
  </main>
}

const fieldNames:Record<string,string>={name:'名称',position:'位置',function:'店铺或建筑功能',entry:'进入与使用条件',flow:'完整流程',reward:'奖励'}
const fieldLabels={verified:'已核验',community:'社区证据',pending:'待核实',disputed:'存在争议'}
function FieldEvidence({item}:{item:RecordItem}){
  if(!Object.keys(item.fieldReview).length)return null
  return <dl className="facts field-review">{Object.entries(item.fieldReview).map(([key,value])=><div key={key}><dt>{fieldNames[key]??key}</dt><dd>{value.source?<External url={value.source}>{fieldLabels[value.status]}</External>:fieldLabels[value.status]}</dd></div>)}</dl>
}
function Evidence({item}:{item:RecordItem}){
  return <>
    <section className="detail-block"><h3>证据与版本</h3>
      <dl className="facts"><div><dt>最近核验</dt><dd>{item.reviewed}</dd></div><div><dt>游戏版本</dt><dd>{item.version ?? '待核实'}</dd></div><div><dt>最近修改</dt><dd>{item.modified}</dd></div></dl>
      <FieldEvidence item={item}/><ul className="source-list">{item.sources.map(s=><li key={s.url}><External url={s.url}>{s.label}</External><small>{s.evidence}</small></li>)}</ul>
    </section>
    {item.media.length>0&&<section className="detail-block"><h3>相关画面</h3><ul className="source-list">{item.media.map(m=><li key={m.url}><External url={m.url}>{m.label}</External></li>)}</ul></section>}
  </>
}
function ShareButton({item,notify}:{item:RecordItem,notify:(s:string)=>void}) {
  const [fallback,setFallback]=useState('')
  async function copy(){
    const url=new URL(href(pageFor(item),item.id),location.href).href
    try {await navigator.clipboard.writeText(url);notify('链接已复制')}
    catch {setFallback(url)}
  }
  return <><button className="button secondary" onClick={copy}><Share2 size={16}/>复制位置链接</button>{fallback&&<input className="share-url" aria-label="分享链接" readOnly value={fallback} onFocus={e=>e.currentTarget.select()}/>}</>
}
function PlaceDetails({item,flag,close,focus,next,open,notify,spoiler}:{item:Place,flag:Flag,close:()=>void,focus:()=>void,next:Place|undefined,open:ItemHandler,notify:(s:string)=>void,spoiler:boolean}) {
  const hidden=item.spoiler&&!spoiler
  return <aside className="place-detail panel" aria-label="地点详情" data-testid="place-detail">
    <div className="sheet-handle"/><div className="detail-title"><div><div className="eyebrow"><MapPin size={15}/>{item.subcategory}</div><h2>{hidden?'剧透地点':item.zh}</h2>{!hidden&&<p lang="en">{item.en}</p>}</div><button className="icon-button" onClick={close} aria-label="关闭地点详情"><X size={21}/></button></div>
    <div className="detail-scroll">
      <div className="chips"><Badge item={item}/><Chip>{item.position?.precision==='exact'?'精确坐标':item.position?'大致区域':'坐标待核实'}</Chip></div>
      {hidden?<Empty>在「我的」关闭无剧透模式后可以查看详情。</Empty>:<>
        <p className="detail-summary">{item.summary}</p>
        <div className="detail-actions">
          <button className="button secondary" aria-pressed={flag.favorite} onClick={()=>updateFlag(item.id,{favorite:!flag.favorite})}><Star size={17}/>{flag.favorite?'已收藏':'收藏'}</button>
          <button className="button secondary" aria-pressed={flag.visited} onClick={()=>updateFlag(item.id,{visited:!flag.visited})}><FlagIcon size={17}/>{flag.visited?'已到达':'标记已到达'}</button>
          {item.category==='collectibles'&&<button className="button secondary" aria-pressed={flag.collected} onClick={()=>updateFlag(item.id,{collected:!flag.collected})}><Check size={17}/>{flag.collected?'已收集':'标记已收集'}</button>}
          {item.position&&<button className="button secondary" onClick={focus}><Navigation size={16}/>地图定位</button>}
        </div>
        <section className="detail-block"><h3>怎么找到</h3>
          <dl className="facts"><div><dt>地区</dt><dd>{item.region?regionNames[item.region]:'待核实'}</dd></div>{item.address&&<div><dt>城区／地址</dt><dd>{item.address}</dd></div>}{item.position?.precision==='exact'&&<div><dt>地图网格</dt><dd>{item.position.x}, {item.position.y}</dd></div>}<div><dt>前置条件</dt><dd>{item.prerequisites??'待核实'}</dd></div></dl>
          {item.directions.length?<ol>{item.directions.map(step=><li key={step}>{step}</li>)}</ol>:<p>入口与寻找步骤待核实。</p>}
        </section>
        <label className="notes-label">个人备注<textarea key={item.id} maxLength={2000} placeholder="记录你想下次再看的细节" value={flag.note} onChange={e=>updateFlag(item.id,{note:e.target.value})}/></label>
        <div className="detail-actions"><ShareButton item={item} notify={notify}/>{next&&<button className="button secondary" onClick={()=>open(next)}><ChevronRight size={17}/>下一处未完成</button>}</div>
        {!!item.related.length&&<section className="detail-block"><h3>关联资料</h3>{item.related.map(id=>{const ref=byId.get(id);return ref&&<Row key={id} item={ref} open={open} spoiler={spoiler}/>})}</section>}
        <Evidence item={item}/>
      </>}
    </div>
  </aside>
}

function MapPage({id,initial,profile,spoiler,open,notify}:{id:string,initial:string,profile:Profile,spoiler:boolean,open:ItemHandler,notify:(s:string)=>void}) {
  const [savedCategory,saveCategory]=usePreference('map-category','')
  const [category,setCategoryValue]=useState(categoryIds.includes(initial as Category)?initial:savedCategory)
  const setCategory=(value:string)=>{setCategoryValue(value);saveCategory(value)}
  const [sub,setSub]=usePreference('map-subcategory','')
  const [types,setTypes]=usePreference<PoiType[]>('map-types',[])
  const [listOnly,setListOnly]=useState(false)
  const [locatedOnly,setLocatedOnly]=useState(false)
  const [region,setRegion]=usePreference('map-region','')
  const [certainty,setCertainty]=useState('')
  const [query,setQuery]=useState('')
  const [pending,setPending]=useState(false)
  const [onlyIncomplete,setIncomplete]=useState(false)
  const [labels,setLabels]=usePreference('labels',true)
  const [style,setStyle]=usePreference('map-style','terrain')
  const [full,setFull]=useState(false)
  const [mobileFilters,setMobileFilters]=useState(false)
  const [focus,setFocus]=useState(0)
  useEffect(()=>{
    if(!full)return
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setFull(false)}
    addEventListener('keydown',escape)
    return ()=>removeEventListener('keydown',escape)
  },[full])
  const [count,setCount]=useState(45)
  const supplied=byId.get(id)
  const active=supplied?.kind==='place'?supplied:undefined
  const items=useMemo(()=>{
    const source=(pending?mapSearch:mapSearchDefault)(query)
    return source.filter(item=>item.kind==='place'
      && (spoiler||!item.spoiler) && (!category||item.category===category) && (!sub||item.subcategory===sub)
      && (!types.length||types.includes(poiType(item))) && (!locatedOnly||!!item.position)
      && (!region||item.region===region) && (!certainty||item.confidence===certainty)
      && (!onlyIncomplete||!(item.category==='collectibles'?profile.items[item.id]?.collected:profile.items[item.id]?.visited))) as Place[]
  },[pending,query,spoiler,category,sub,types,locatedOnly,region,certainty,onlyIncomplete,profile.items])
  const available=(pending?places:primaryPlaces).filter(item=>item.position&&(spoiler||!item.spoiler))
  const toggleType=(type:PoiType)=>{
    setTypes(types.includes(type)?types.filter(t=>t!==type):[...types,type])
    setCategory('')
    setSub('')
    setCount(45)
  }
  const mapped=items.filter(item=>item.position).length
  const activeVisible=active&&(spoiler||!active.spoiler)?active:undefined
  const positionItems=items.filter(item=>item.position)
  const next=active&&[...positionItems].sort((a,b)=>Number(b.region===active.region)-Number(a.region===active.region)).find(item=>
    verified(item)&&item.category===active.category&&item.id!==active.id&&
    !(item.category==='collectibles'?profile.items[item.id]?.collected:profile.items[item.id]?.visited))
  function pick(item:RecordItem){setMobileFilters(false);setListOnly(false);open(item)}
  return <main className={`map-page ${full?'map-full':''}`}>
    {!full&&<div className="map-page-toolbar">
      <div className="map-title"><span className="view-icon"><MapIcon size={19}/></span><div><h1>互动地图</h1><p>LEONIDA MAP</p></div></div>
      <form className="search-input map-search" onSubmit={e=>{e.preventDefault();if(items[0])pick(items[0])}}><Search size={18}/><input aria-label="搜索地图地点" value={query} placeholder="搜索地名、机场、收集品…" onChange={e=>{setQuery(e.target.value);setCount(45);setMobileFilters(true)}}/>{query&&<button className="icon-button" type="button" aria-label="清空地图搜索" onClick={()=>setQuery('')}><X size={17}/></button>}</form>
      <button className="button secondary mobile-filter-button" aria-expanded={mobileFilters} onClick={()=>setMobileFilters(!mobileFilters)}><ListFilter size={18}/>筛选</button>
      <button className="button secondary map-list-toggle" aria-pressed={listOnly} onClick={()=>{setListOnly(!listOnly);setMobileFilters(!listOnly)}}>{listOnly?'返回地图':'地点列表'}</button>
      <External url={officialMedia}>官方地图</External>
    </div>}
    {!full&&<div className="poi-toolbar" aria-label="快速地点类型">
      {quickTypes.map(type=><button key={type} className="poi-filter" aria-label={'类型：'+poiTypes[type].label} aria-pressed={types.includes(type)} onClick={()=>toggleType(type)} style={{'--poi':poiTypes[type].color} as CSSProperties}><span dangerouslySetInnerHTML={{__html:poiIcon(type)}}/>{poiTypes[type].label} <small>{available.filter(p=>poiType(p)===type).length}</small></button>)}
      {types.length>0&&<button className="poi-filter" onClick={()=>setTypes([])}>清除类型</button>}
    </div>}
    <div className={`map-layout ${listOnly?'map-list-only':''}`}>
      {!full&&<aside className={`map-filters panel ${mobileFilters?'show-filters':''}`} aria-label="地图筛选">
        <div className="filter-title"><h2><Layers3 size={19}/> 地图图层</h2><button className="icon-button mobile-dismiss" aria-label="关闭地图筛选" onClick={()=>{setMobileFilters(false);setListOnly(false)}}><X size={19}/></button></div>
        <div className="filter-fields">
          <div className="category-grid">
            <button aria-pressed={!category} onClick={()=>{setCategory('');setSub('');setTypes([]);setCount(45)}}>全部</button>
            {categoryIds.map(c=><button aria-pressed={category===c} key={c} onClick={()=>{setCategory(category===c?'':c);setSub('');setTypes([]);setCount(45)}}><i style={{background:categoryColors[c]}}/>{categoryNames[c]}</button>)}
          </div>
          {category&&<select aria-label="子分类" value={sub} onChange={e=>{setSub(e.target.value);setCount(45)}}><option value="">全部子分类</option>{categories[category as Category].map(s=><option key={s}>{s}</option>)}</select>}
          <select aria-label="按地区筛选" value={region} onChange={e=>{setRegion(e.target.value);setCount(45)}}><option value="">所有地区</option>{regionIds.map(r=><option key={r} value={r}>{regionNames[r]}</option>)}</select>
          <select aria-label="快速定位地区" value="" onChange={e=>{const item=byId.get(e.target.value);if(item)pick(item)}}><option value="">快速定位地区</option>{regionIds.slice(0,6).map(r=><option key={r} value={r} disabled={!byId.has(r)}>{regionNames[r]}</option>)}</select>
          <select aria-label="地图底图样式" value={style} onChange={e=>setStyle(e.target.value)}><option value="terrain">社区地形</option><option value="night">夜间地形</option></select>
          <label className="check-line"><input type="checkbox" checked={labels} onChange={e=>setLabels(e.target.checked)}/>显示地图标注</label>
          <label className="check-line"><input type="checkbox" checked={locatedOnly} onChange={e=>setLocatedOnly(e.target.checked)}/>只看可定位地点</label>
          <label className="check-line"><input type="checkbox" checked={onlyIncomplete} onChange={e=>setIncomplete(e.target.checked)}/>只看未完成</label>
          <label className="check-line"><input type="checkbox" checked={pending} onChange={e=>{setPending(e.target.checked);setCertainty('')}}/>显示待核验地点</label>
          {pending&&<small className="muted">社区位置可能与游戏存在偏差。</small>}
          <select aria-label="地图可信度" value={certainty} onChange={e=>setCertainty(e.target.value)}><option value="">全部可信度</option>{confidenceIds.filter(c=>pending||!['pending','disputed'].includes(c)).map(c=><option value={c} key={c}>{confidenceNames[c]}</option>)}</select>
        </div>
        <div className="results-head"><strong>地点</strong><span>{items.length} 项 · {mapped} 个可定位</span></div>
        <div className="map-results">{items.length?items.slice(0,count).map(item=><Row key={item.id} item={item} open={pick} spoiler={spoiler}/>):<Empty>{query?'没有找到符合条件的地点':'暂无已核验条目'}</Empty>}
          {items.length>count&&<button className="button secondary more" onClick={()=>setCount(count+45)}>加载更多</button>}
        </div>
      </aside>}
      <Suspense fallback={<div className="map-stage map-loading" role="status">加载互动地图…</div>}><MapView items={items} active={activeVisible} focus={focus} labels={labels} style={style} full={full} onFull={()=>{setFull(!full);setMobileFilters(false)}} onSelect={point=>{const item=byId.get(point);if(item){setFull(false);pick(item)}}}/></Suspense>
      {!full&&active&&<PlaceDetails item={active} flag={profile.items[active.id]??blankFlag} close={()=>{location.hash=href('map','',initial)}} focus={()=>setFocus(focus+1)} next={next} open={pick} notify={notify} spoiler={spoiler}/>}
      {id&&!active&&<p className="map-notice" role="status">此地点链接无效或已移除。</p>}
    </div>
  </main>
}

const libraryKinds=['vehicle','weapon','character','collection'] as const
const guideKinds=['mission','guide'] as const
function ArticleBody({article,item,profile,open,spoiler}:{article:Article,item:Entry,profile:Profile,open:ItemHandler,spoiler:boolean}){
  const key='reading.'+profile.id+'.'+item.id
  const [last,setLast]=usePreference(key,'')
  const here=(id:string)=>document.getElementById(id)?.scrollIntoView({block:'start'})
  const sections=[...(article.start?[['article-start','怎么开始']]:[]),
    ...(article.checkpoints.length?[['article-flow','分步流程']]:[]),
    ...article.sections.map(section=>[section.id,section.title]),
    ...(article.finish?[['article-finish','完成与奖励']]:[])]
  const done=article.checkpoints.filter(step=>profile.checks.includes(item.id+'-'+step.id)).length
  return <div className="article-body" data-quality={article.quality}>
    <p className="article-lede">{article.intro}</p>
    {(article.role||article.before)&&<dl className="facts"><div><dt>操作角色</dt><dd>{article.role??'待核实'}</dd></div>
      {article.before&&<div><dt>前置任务</dt><dd><a href={href('guide',article.before)}>{byId.get(article.before)?.zh}</a></dd></div>}</dl>}
    <nav className="article-toc" aria-label="文章目录">{sections.map(([id,title])=><button key={id} onClick={()=>{setLast(id);here(id)}}>{title}</button>)}
    {last&&sections.some(([id])=>id===last)&&<button onClick={()=>here(last)}>继续上次阅读</button>}</nav>
    {!!article.related.length&&<div className="article-related">{article.related.map(id=>{const ref=byId.get(id);return ref&&(!ref.spoiler||spoiler)&&<a className="button secondary" key={id} href={href(pageFor(ref),id)}>{ref.kind==='place'&&<MapPin size={16}/>} {ref.zh}</a>})}</div>}
    {article.start&&<section id="article-start"><h3>怎么开始</h3><p>{article.start}</p></section>}
    {!!article.checkpoints.length&&<section id="article-flow"><h3>分步流程</h3><p className="muted">{done} / {article.checkpoints.length} 步完成</p><progress aria-label="攻略步骤进度" value={done} max={article.checkpoints.length}/>
      <ol className="article-steps">{article.checkpoints.map((step,index)=><li key={step.id}>
        <h4>{index+1}. {step.title}</h4><p>{step.action}</p>
        <p><strong>做到哪算成功</strong> {step.check}</p>
        {step.note&&<p className="article-note"><strong>注意</strong> {step.note}</p>}
        <label className="check-line"><input type="checkbox" aria-label={`完成步骤 ${index+1}`} checked={profile.checks.includes(item.id+'-'+step.id)} onChange={()=>{toggleCheck(item.id+'-'+step.id);setLast('article-flow')}}/>完成这一步</label>
      </li>)}</ol></section>}
    {article.sections.map(section=><section id={section.id} key={section.id}><h3>{section.title}</h3>{section.paragraphs.map(paragraph=><p key={paragraph}>{paragraph}</p>)}</section>)}
    {article.finish&&<section id="article-finish"><h3>完成与奖励</h3><p>{article.finish}</p><p><strong>奖励</strong> {article.reward??'待核实'}</p></section>}
    <section className="detail-block"><h3>正文核对来源</h3><ul className="source-list">{article.sources.map(source=><li key={source.url}><External url={source.url}>{source.label}</External><small>{source.scope}</small></li>)}</ul></section>
    {article.quality==='complete'&&<nav className="article-related" aria-label="任务前后导航">{[-1,1].map(dir=>{
      const adjacent=Object.entries(articles).find(([,a])=>a.sequence===article.sequence!+dir)
      const entry=adjacent&&byId.get(adjacent[0])
      return entry&&<button className="button secondary" key={dir} onClick={()=>open(entry)}>{dir<0?'上一条攻略':'下一条攻略'}</button>
    })}</nav>}
  </div>
}
function guideStatus(item:Entry){
  return articles[item.id]?articleStatus[articles[item.id].quality]:item.steps.length?'部分攻略':verified(item)?'仅已确认任务信息':'待核验'
}
function ContentDetail({item,spoiler,open,close,profile}:{item:Entry,spoiler:boolean,open:ItemHandler,close:()=>void,profile:Profile}) {
  const [reveal,setReveal]=useState(false)
  const hidden=item.spoiler&&!spoiler&&!reveal
  const article=articles[item.id]
  const checks=profile.checks
  const done=checks.includes(item.id)
  return <article className="content-detail panel reading-panel">
    <div className="detail-title"><div><p className="eyebrow">{item.group}</p><h2>{hidden?'剧透条目':item.zh}</h2>{!hidden&&<p lang="en">{item.en}</p>}</div><button className="icon-button" onClick={close} aria-label="关闭条目详情"><X size={20}/></button></div>
    <div className="chips"><Badge item={item}/>{item.kind==='mission'&&<Chip>{guideStatus(item)}</Chip>}{item.spoiler&&<Chip>涉及剧透</Chip>}</div>
    {hidden?<button className="button secondary" onClick={()=>setReveal(true)}><Eye size={17}/>显示这条攻略</button>:<>
      <p className="detail-summary">{item.summary}</p>
      {Object.keys(item.facts).length>0&&<dl className="facts">{Object.entries(item.facts).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>}
      {article?<ArticleBody article={article} item={item} profile={profile} open={open} spoiler={spoiler||reveal}/>:item.kind==='mission'&&<p className="empty">详细任务流程待补充。下方只展示已收录的事实。</p>}
      {!article&&item.steps.length>0&&<section className="detail-block"><h3>操作步骤</h3><ol>{item.steps.map((step,i)=><li key={step}>{item.kind==='mission'&&<input type="checkbox" aria-label={`完成步骤 ${i+1}`} checked={checks.includes(`${item.id}-step-${i+1}`)} onChange={()=>toggleCheck(`${item.id}-step-${i+1}`)}/>} {step}</li>)}</ol></section>}
      {['mission','completion'].includes(item.kind)&&verified(item)&&<button className="button secondary" aria-pressed={done} onClick={()=>toggleCheck(item.id)}><Check size={17}/>{done?'已完成':'标记完成'}</button>}
      {!!item.related.length&&<section className="detail-block"><h3>关联资料</h3>{item.related.map(id=>{const ref=byId.get(id);return ref&&<Row key={id} item={ref} open={open} spoiler={spoiler}/>})}</section>}
      <Evidence item={item}/>
    </>}
  </article>
}

function EntryPage({page,id,initial,profile,spoiler,setSpoiler,open}:{
  page:Route,id:string,initial:string,profile:Profile,spoiler:boolean,setSpoiler:(s:boolean)=>void,open:ItemHandler,
}){
  const kinds:readonly Entry['kind'][]=page==='guide'?guideKinds:page==='library'?libraryKinds:page==='cheats'?['cheat']:['completion']
  const [kind,setKind]=useState(kinds.includes(initial as Entry['kind'])?initial:'')
  const [query,setQuery]=useState('')
  const [group,setGroup]=useState('')
  const [display,setDisplay]=usePreference('library-display','list')
  const supplied=byId.get(id)
  const item=supplied&&supplied.kind!=='place'&&kinds.includes(supplied.kind)?supplied:undefined
  const pool=entries.filter(entry=>kinds.includes(entry.kind)&&(!kind||entry.kind===kind)).sort((a,b)=>page==='guide'?(articles[a.id]?.sequence??999)-(articles[b.id]?.sequence??999):0)
  const groups=[...new Set(pool.map(item=>item.group))]
  const source=query?search(query):pool
  const list=source.filter((e):e is Entry=>e.kind!=='place'&&kinds.includes(e.kind)&&(!kind||kind===e.kind)&&(!group||group===e.group))
  const title=page==='guide'?'中文攻略':page==='library'?'游戏资料库':page==='cheats'?'秘籍查询':'100% 完成度'
  const done=pool.filter(entry=>profile.checks.includes(entry.id)&&verified(entry)).length
  const required=pool.filter(verified).length
  if(item&&(page==='guide'||page==='library'))return <main className="page reader-page">
    <a className="text-action article-return" href={href(page,'',initial)}>‹ 返回{title}</a>
    <ContentDetail key={item.id} item={item} spoiler={spoiler} open={open} close={()=>{location.hash=href(page,'',initial)}} profile={profile}/>
  </main>
  return <main className="page content-page">
    <div className="page-heading"><div><p className="eyebrow">LEONIDA COMPANION</p><h1>{title}</h1></div>{page==='guide'&&<button className="button secondary" onClick={()=>setSpoiler(!spoiler)}>{spoiler?<Eye size={17}/>:<EyeOff size={17}/>} {spoiler?'完整攻略模式':'无剧透模式'}</button>}</div>
    {page==='completion'&&<div className="panel summary-card"><ProgressRing done={done} total={required}/><div><h2>游戏完成条件核对清单</h2><p>已勾选 {done} / {required} 个已核验条件。游戏实际百分比请以游戏内统计为准。</p><p>未核实或来源冲突的条件在清单中标明，暂不计入。</p></div></div>}
    {page==='cheats'&&<div className="panel summary-card"><Gamepad2 size={26}/><p>解锁条件来自首发版公开攻略。平台按键与奖杯影响仅在证据支持时展示。</p></div>}
    {page==='library'&&<div className="tabs link-tabs"><a href={href('cheats')}><Gamepad2 size={17}/>秘籍查询</a><a href={href('completion')}><Trophy size={17}/>100% 完成度</a></div>}
    <div className="entry-tools">
      <div className="tabs"><button aria-pressed={!kind} onClick={()=>{setKind('');setGroup('')}}>全部</button>{kinds.length>1&&kinds.map(k=><button key={k} aria-pressed={kind===k} onClick={()=>{setKind(k);setGroup('')}}>{kindName[k]}</button>)}</div>
      <div className="entry-search"><label className="search-input"><Search size={17}/><input aria-label={title+'搜索'} placeholder="中文、英文或拼音" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <select aria-label="资料分组" value={group} onChange={e=>setGroup(e.target.value)}><option value="">全部分组</option>{groups.map(g=><option key={g}>{g}</option>)}</select></div>
    </div>
    <div className={`entry-layout ${item?'with-detail':''}`}>
      {page==='library'&&<div className="tabs library-layout"><button aria-pressed={display==='list'} onClick={()=>setDisplay('list')}>列表</button><button aria-pressed={display==='cards'} onClick={()=>setDisplay('cards')}>卡片</button></div>}
      <section className={`entry-list panel ${page==='library'&&display==='cards'?'entry-cards':''}`} aria-label="资料列表">
      {list.length?list.map((e,index)=><div className="entry-line" key={e.id}>
        {page==='completion'&&verified(e)&&<input type="checkbox" aria-label={e.zh+'已完成'} checked={profile.checks.includes(e.id)} onChange={()=>toggleCheck(e.id)}/>}
        <button className="entry-row" onClick={()=>open(e)}>
          <span><strong>{e.spoiler&&!spoiler?`任务 ${index+1}（剧透）`:e.zh}</strong><small>{e.spoiler&&!spoiler?e.group:e.en+' · '+e.group}</small></span>
          <span className="entry-status">{e.kind==='mission'?<Chip>{guideStatus(e)}</Chip>:<Badge item={e}/>}</span><ChevronRight className="row-next" size={16}/>
        </button>
      </div>):<Empty>{query?'没有找到符合条件的资料':'暂无已核验条目'}</Empty>}
      </section>
      {item&&<ContentDetail key={item.id} item={item} spoiler={spoiler} open={open} close={()=>{location.hash=href(page,'',initial)}} profile={profile}/>}
      {!!id&&!item&&<Empty>此资料链接无效或已移除。</Empty>}
    </div>
  </main>
}

function MyPage({profile,spoiler,setSpoiler,open,notify}:{profile:Profile,spoiler:boolean,setSpoiler:(v:boolean)=>void,open:ItemHandler,notify:(s:string)=>void}){
  const {data}=useProgress()
  const [name,setName]=useState('')
  const [imported,setImported]=useState<ReturnType<typeof parseBackup>|null>(null)
  const [status,setStatus]=useState('')
  const [reset,setReset]=useState<Category|null>(null)
  const download=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}))
    const a=document.createElement('a')
    a.href=url
    a.download='leonida-companion-backup.json'
    a.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  const save=(event:FormEvent)=>{event.preventDefault();if(name.trim()){addProfile(name);setName('')}}
  return <main className="page content-page">
    <div className="page-heading"><div><p className="eyebrow">我的存档</p><h1>我的探索</h1></div><button className="button secondary" onClick={()=>setSpoiler(!spoiler)}>{spoiler?<Eye size={17}/>:<EyeOff size={17}/>} {spoiler?'完整攻略模式':'无剧透模式'}</button></div>
    <div className="dashboard">
      <section className="panel account-card"><h2>存档管理</h2><p>进度保存在当前浏览器。换设备时，可以导出备份再导入。</p>
        <label className="field">当前存档<select aria-label="当前存档" value={profile.id} onChange={e=>selectProfile(e.target.value)}>{data.profiles.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
        <form className="inline-form" onSubmit={save}><input aria-label="新存档名称" maxLength={40} value={name} onChange={e=>setName(e.target.value)} placeholder="新存档名称"/><button className="button secondary" disabled={data.profiles.length>=24||!name.trim()}>新建存档</button></form>
        <div className="detail-actions"><button className="button secondary" onClick={download}><Download size={16}/>导出 JSON</button>
          <label className="button secondary file-button"><Upload size={16}/>导入 JSON<input type="file" accept="application/json,.json" aria-label="导入 JSON 备份" onChange={async e=>{
            const file=e.target.files?.[0]
            e.target.value=''
            setImported(null)
            if(!file)return
            try{
              if(file.size>4_000_000)throw new Error('too big')
              setImported(parseBackup(await file.text()))
              setStatus('备份已核验。应用备份将替换当前浏览器的全部存档。')
            }catch{setStatus('无法导入。文件不是有效备份或超过 4 MB。')}
          }}/></label>
        </div>
        {status&&<p role="status">{status}</p>}
        {imported&&<button className="button primary" onClick={()=>{try{replaceProgress(imported);setImported(null);setStatus('备份已恢复');notify('备份已恢复')}catch{setStatus('存档写入失败')}}}>确认恢复备份</button>}
      </section>
      <section className="panel account-card"><h2>分类进度</h2><p>按本站已核验地点统计。收集品使用「已收集」，其他地点使用「已到达」。</p>
        {categoryIds.map(c=>{
          const items=primaryPlaces.filter(item=>item.category===c)
          const n=items.filter(p=>c==='collectibles'?profile.items[p.id]?.collected:profile.items[p.id]?.visited).length
          return <div className="category-progress" key={c}><div><a href={href('map','',c)}>{categoryNames[c]}</a><span>{n}/{items.length}{items.length>0&&` · ${Math.round(n/items.length*100)}%`}</span></div><progress aria-label={categoryNames[c]+'进度'} max={items.length||1} value={n}/>{n>0&&<button className="text-action" onClick={()=>setReset(c)}>重置</button>}</div>
        })}
        {reset&&<div className="restore-confirm"><p>清除当前存档的「{categoryNames[reset]}」到达和收集状态？</p><button className="button secondary" onClick={()=>setReset(null)}>取消</button> <button className="button primary" onClick={()=>{resetCategory(primaryPlaces.filter(i=>i.category===reset).map(i=>i.id));setReset(null)}}>确认重置</button></div>}
      </section>
    </div>
    <section className="panel account-card saved"><h2>收藏与备注</h2>{places.some(p=>profile.items[p.id]?.favorite||profile.items[p.id]?.note)?
      places.filter(p=>profile.items[p.id]?.favorite||profile.items[p.id]?.note).map(p=><Row key={p.id} item={p} open={open} spoiler={spoiler}/>):<Empty>还没有收藏或备注。</Empty>}</section>
    <section className="panel account-card saved"><h2>添加到主屏幕</h2><p>iPhone Safari 中点「分享」，选「加入主屏幕」。首次联网加载后可离线打开已缓存的地图和资料。</p><External url={repo+'/issues/new/choose'}>反馈地点或资料错误</External></section>
  </main>
}
function Sources(){
  return <main className="page content-page"><div className="page-heading"><div><p className="eyebrow">LEONIDA COMPANION</p><h1>数据来源与审核</h1></div></div>
    <div className="panel account-card"><h2>数据统计</h2>
      <div className="stats audit-stats">{[['总条目',stats.all],['已核验',stats.verified],['待核验',stats.pending],['存在争议',stats.disputed],['精确坐标',stats.exact],['大致区域',stats.area],['无坐标',stats.noPosition],['已核验可定位',stats.verifiedMapped]].map(([label,n])=><div key={label}><strong>{n}</strong><small>{label}</small></div>)}</div>
      <p>最近审核 {stats.date}。地点存在的证据与坐标精度分别标注。社区点位可能与实际游戏画面有偏差。</p>
    </div>
    <div className="panel account-card saved"><h2>资料与授权</h2><ul className="source-list">
      <li><External url={officialMedia}>Rockstar 官方地图与截图</External><small>官方海报和画面通过原站查看。</small></li>
      <li><External url="https://github.com/rolux/gtadb.org">GTADB · Yanis 及制图贡献者</External><small>社区地形底图及部分点位，CC BY 4.0。原生瓦片原样发布；总览和封面做过裁切、缩放和调色。</small></li>
      <li><External url={repo+'/blob/main/docs/DATA-AUDIT.md'}>数据审核报告</External></li>
      <li><External url={repo+'/blob/main/docs/LICENSES.md'}>许可证与署名</External></li>
      <li><External url={repo+'/blob/main/CHANGELOG.md'}>更新日志</External></li>
    </ul></div>
  </main>
}
export default function App(){
  const [route,setRoute]=useState(readRoute)
  const [spoiler,setSpoiler]=usePreference('spoilers',false)
  const [searchOpen,setSearchOpen]=useState(false)
  const [menu,setMenu]=useState(false)
  const [notice,setNotice]=useState('')
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null)
  const {profile,error}=useProgress()
  useEffect(()=>{
    const handle=()=>{setRoute(readRoute());setMenu(false);window.scrollTo(0,0)}
    const shortcut=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setSearchOpen(true)}}
    addEventListener('hashchange',handle)
    addEventListener('keydown',shortcut)
    return ()=>{removeEventListener('hashchange',handle);removeEventListener('keydown',shortcut);if(timer.current)clearTimeout(timer.current)}
  },[])
  const open:ItemHandler=item=>{location.hash=href(pageFor(item),item.id,pageFor(item)===route.page?route.filter:'')}
  const notify=(message:string)=>{
    setNotice(message)
    if(timer.current)clearTimeout(timer.current)
    timer.current=setTimeout(()=>setNotice(''),2800)
  }
  const {page,id,filter}=route
  return <>
    <header className="site-header"><div className="header-inner">
      <a className="brand" href={href('home')} aria-label="Leonida Companion 首页"><img src={base+'icon.svg'} width="39" height="39" alt=""/><span><strong><b>LEONIDA</b> COMPANION</strong><small>GTA 6 中文全能助手</small></span></a>
      <nav className="desktop-nav" aria-label="主导航">{nav.map(([name,label,Icon])=><a className={page===name?'active':''} key={name} href={href(name)} aria-current={page===name?'page':undefined}><Icon size={17}/>{label}</a>)}</nav>
      <div className="header-actions"><button className="header-search" aria-label="打开全站搜索" onClick={()=>setSearchOpen(true)}><Search size={17}/><span>搜索资料</span><kbd>⌘ K</kbd></button>
      <button className="icon-button menu-toggle" aria-label="更多导航" aria-expanded={menu} onClick={()=>setMenu(!menu)}><Menu size={20}/></button></div>
      {menu&&<div className="menu panel"><a href={href('cheats')}>秘籍查询</a><a href={href('completion')}>100% 完成度</a><a href={href('sources')}>数据来源</a></div>}
    </div></header>
    {error&&<p role="alert" className="error-banner">{error}</p>}
    {page==='home'&&<Home profile={profile} open={open} onSearch={()=>setSearchOpen(true)}/>}
    {page==='map'&&<MapPage key={filter} id={id} initial={filter} profile={profile} spoiler={spoiler} open={open} notify={notify}/>}
    {['guide','library','cheats','completion'].includes(page)&&<EntryPage key={page+filter} page={page} id={id} initial={filter} profile={profile} spoiler={spoiler} setSpoiler={setSpoiler} open={open}/>}
    {page==='me'&&<MyPage profile={profile} spoiler={spoiler} setSpoiler={setSpoiler} open={open} notify={notify}/>}
    {page==='sources'&&<Sources/>}
    {page!=='map'&&<footer className="site-footer"><span>Leonida Companion · 非官方玩家工具</span><a href={href('sources')}><CircleHelp size={15}/>数据与授权</a></footer>}
    <nav className="mobile-nav" aria-label="手机导航">{nav.map(([name,label,Icon])=><a className={page===name?'active':''} key={name} href={href(name)} aria-current={page===name?'page':undefined}><Icon size={21}/><span>{label}</span></a>)}</nav>
    <GlobalSearch open={open} spoiler={spoiler} expanded={searchOpen} setExpanded={setSearchOpen}/>
    {notice&&<div role="status" className="toast">{notice}</div>}
  </>
}
