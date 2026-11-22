import {readFileSync} from 'node:fs'
import {validateContent} from '../src/data/schema'
import {records,places,entries,stats} from '../src/data/content'
import {verified} from '../src/data/schema'
import {toLeaflet,toPixel} from '../src/geometry'
import map from '../src/data/map.json'

if (process.argv[2] === '--candidate') {
  const [, , , kind, path] = process.argv
  if (!path || !['places', 'entries'].includes(kind ?? '')) throw new Error('用法：npm run data -- --candidate places|entries 文件.json')
  const newRows: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (!Array.isArray(newRows)) throw new Error('候选文件必须是数组')
  validateContent(kind === 'places' ? [...places, ...newRows] : places, kind === 'entries' ? [...entries, ...newRows] : entries)
  console.log(`候选文件校验通过：${newRows.length} 条。目录尚未改写。`)
}
for(const point of places){
  if(!point.position)continue
  const {x,y}=point.position
  const [lat,lng]=toLeaflet(x,y)
  const [px,py]=toPixel(lat,lng)
  if (Math.abs(px-x)>0.0001||Math.abs(py-y)>0.0001) throw new Error('坐标转换失败：'+point.id)
}
if(map.tileSize!==256||map.maxTileZoom!==map.upstreamRanges.length||map.coverage[2]>map.width||map.coverage[3]>map.height) throw new Error('地图配置或裁切尺寸错误')
if(!places.some(p=>p.position&&verified(p))||!entries.some(p=>p.kind==='mission'&&verified(p)))throw new Error('发布缺少已核验地图点或任务')
const counts=Object.fromEntries([...new Set(records.map(r=>r.kind))].map(kind=>[kind,records.filter(r=>r.kind===kind).length]))
console.log(JSON.stringify({counts,...stats,sourceUrls:new Set(records.flatMap(r=>r.sources.map(s=>s.url))).size},null,2))
