import { mkdirSync, writeFileSync } from 'node:fs'
import { articles } from '../src/data/articles'
import { byId, entries, places, records } from '../src/data/content'
import { verified } from '../src/data/schema'

const routeLinks=records.map(item=>item.id)
const references=records.flatMap(item=>item.related)
const articleLinks=Object.values(articles).flatMap(article=>[...article.related,...(article.before?[article.before]:[])])
const internal=[...routeLinks,...references,...articleLinks]
const mentions=[
  ...records.flatMap(item=>[...item.sources,...item.media].map(source=>source.url)),
  ...Object.values(articles).flatMap(article=>article.sources.map(source=>source.url)),
]
const urlList=[...new Set(mentions)].sort()
const empty=entries.filter(entry=>!entry.summary.trim()&&!entry.steps.length&&!articles[entry.id]).map(x=>x.id)
const externalOnly=entries.filter(entry=>!entry.summary.trim()&&!entry.steps.length&&!articles[entry.id]&&entry.sources.length>0).map(x=>x.id)
const broken=internal.filter(id=>!byId.has(id))
const invalidExternal=urlList.filter(url=>{try{return new URL(url).protocol!=='https:'}catch{return true}})
const unchecked=places.filter(point=>!point.position).length
const missions=entries.filter(entry=>entry.kind==='mission')
const full=missions.filter(entry=>articles[entry.id]?.quality==='complete').length
const summary={
  internal:internal.length, internalRoutes:routeLinks.length, brokenInternal:[...new Set(broken)],
  external:urlList.length, externalReferences:mentions.length, invalidExternal, empty,externalOnly,
  missions:missions.length, completeGuides:full, incompleteMissions:missions.length-full,
  indexedWithoutSteps:missions.filter(entry=>!articles[entry.id]?.checkpoints.length&&!entry.steps.length).length,
  encyclopedia:entries.filter(entry=>['vehicle','weapon','character','collection'].includes(entry.kind)&&articles[entry.id]?.quality==='reference').length,
  places:places.length, unlocated:unchecked,
  placeGroups:Object.fromEntries(['维修与改装设施','汽车相关设施','便利店与超市','警察局','车辆扣押场','医院','武器商店','交通设施','服装商店'].map(name=>{
    const items=places.filter(place=>place.subcategory===name)
    return [name,{all:items.length,mapped:items.filter(item=>item.position).length,verifiedMapped:items.filter(item=>item.position&&verified(item)).length}]
  })),
}
if(broken.length||invalidExternal.length||empty.length||externalOnly.length)throw new Error(JSON.stringify(summary))
let reachability
if(process.argv.includes('--network')){
  const outcomes:{url:string,status:number|null}[]=[]
  const pending=[...urlList]
  await Promise.all(Array.from({length:5},async()=>{
    while(pending.length){
      const url=pending.shift()!
      try{
        const response=await fetch(url,{method:'GET',redirect:'follow',signal:AbortSignal.timeout(10000),headers:{'user-agent':'LeonidaCompanionLinkAudit/2.0'}})
        outcomes.push({url,status:response.status})
        await response.body?.cancel()
      }catch{outcomes.push({url,status:null})}
    }
  }))
  reachability={
    accessible:outcomes.filter(o=>o.status&&o.status>=200&&o.status<400).length,
    missing:outcomes.filter(o=>o.status===404||o.status===410),
    accessUnconfirmed:outcomes.filter(o=>o.status===null||o.status>=400&&o.status!==404&&o.status!==410),
  }
}
const report={...summary,...(reachability?{reachability}:{})}
if(process.argv.includes('--network')){
  mkdirSync('test-results/map-evidence',{recursive:true})
  writeFileSync('test-results/map-evidence/link-audit.json',JSON.stringify(report,null,2)+'\n')
}
console.log(JSON.stringify(report,null,2))
