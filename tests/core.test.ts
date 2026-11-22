import {describe,expect,it} from 'vitest'
import {entries,places,records,stats} from '../src/data/content'
import {placeSchema,validateContent,verified} from '../src/data/schema'
import {toLeaflet,toPixel} from '../src/geometry'
import {createSearch} from '../src/search'
import {blankBackup,parseBackup} from '../src/progress'

describe('公开目录',()=>{
  it('每条记录都可追溯且编号不重复',()=>{
    expect(new Set(records.map(r=>r.id)).size).toBe(records.length)
    expect(records.every(r=>r.sources.length&&r.sources.every(s=>s.url.startsWith('https://')))).toBe(true)
    expect(stats.verified+stats.pending+stats.disputed).toBe(stats.all)
  })
  it('防止错误分类、越界坐标和无证据精度',()=>{
    const place=places.find(r=>r.position)!
    expect(placeSchema.safeParse({...place,subcategory:'错误分类'}).success).toBe(false)
    expect(placeSchema.safeParse({...place,position:{...place.position,x:-1}}).success).toBe(false)
    expect(placeSchema.safeParse({...place,position:{x:20,y:10,precision:'exact',source:'https://example.org'}}).success).toBe(false)
    expect(()=>validateContent([place,place],entries)).toThrow('重复 ID')
    expect(()=>validateContent(places,[...entries, {...entries[0],id:'duplicate-evidence',confidence:'corroborated',sources:[entries[0].sources[0]]}])).toThrow('来源不足')
  })
  it('社区候选不会进入正式默认地点',()=>{
    expect(places.some(r=>!verified(r))).toBe(true)
    expect(places.filter(verified).every(r=>r.confidence!=='pending')).toBe(true)
  })
  it('支持中文、英文、拼音与混合查询',()=>{
    const lookup=createSearch(places.filter(verified))
    for(const query of ['机场','Vice City International Airport','jichang','罪恶城 Airport','Vcie City Airport']){
      expect(lookup(query).some(item=>item.id==='vice-city-airport')).toBe(true)
    }
  })
  it('可往返转换地图像素和 Leaflet 坐标',()=>{
    expect(toLeaflet(320,640)).toEqual([-10,5])
    expect(toPixel(...toLeaflet(3622.25,5890))).toEqual([3622.25,5890])
    expect(toLeaflet(0,0)).toEqual([-0,0])
  })
})

describe('存档备份',()=>{
  it('空白备份可以往返读取',()=>expect(parseBackup(JSON.stringify(blankBackup))).toEqual(blankBackup))
  it('拒绝损坏文件、无效活动存档和重复档案',()=>{
    expect(()=>parseBackup('{bad')).toThrow()
    expect(()=>parseBackup(JSON.stringify({...blankBackup,active:'missing'}))).toThrow()
    expect(()=>parseBackup(JSON.stringify({...blankBackup,profiles:[...blankBackup.profiles,...blankBackup.profiles]}))).toThrow()
    expect(()=>parseBackup(JSON.stringify({...blankBackup,profiles:[{...blankBackup.profiles[0],items:{constructor:{note:'x'}}}]}))).toThrow()
  })
})

describe('V3 多分类、秘籍与部分攻略',()=>{
  it('秘籍只新增两条已交叉核对的方向键组合',async()=>{
    const cheats=entries.filter(entry=>entry.kind==='cheat')
    expect(cheats.length).toBe(10)
    const attack=cheats.find(entry=>entry.id==='cheat-attack-force')
    const wanted=cheats.find(entry=>entry.id==='cheat-raise-wanted')
    expect(attack?.facts['PS5 方向键']).toBe('↓ ↑ ← ← → ↓ ↓ ↑ ↓')
    expect(wanted?.facts['PS5 方向键']).toBe('← ↓ → ↓ ↑ → ↑')
    expect(attack?.facts['解锁要求']).toContain('通关解锁')
    expect(wanted?.facts['解锁要求']).toContain('50 次')
    expect(stats.all).toBe(333)
    expect(stats.verified).toBe(305)
  })
  it('14 篇缺文任务现在是部分攻略且不编造流程',async()=>{
    const {articles}=await import('../src/data/articles')
    const missing=['mission-clear-skies','mission-day-release','mission-swamped','mission-recalibration','mission-tourist-trap','mission-home-sweet-home','mission-discharge-time','mission-whats-in-the-bag','mission-ambulance-chaser','mission-girls-trip','mission-moses','mission-daily-driver','mission-afternoon-delight','mission-thrillbillies']
    for(const id of missing){
      expect(articles[id]?.quality).toBe('partial')
      expect(articles[id]?.checkpoints.length).toBe(0)
      expect(articles[id]?.start).toBeUndefined()
      expect(articles[id]?.finish).toBeUndefined()
    }
    expect(Object.values(articles).filter(a=>a.quality==='complete').length).toBe(23)
    expect(Object.values(articles).filter(a=>a.quality==='partial').length).toBe(16)
  })
  it('所有文章关联与前置任务都解析到已收录的稳定 ID',async()=>{
    const {articles}=await import('../src/data/articles')
    const {byId}=await import('../src/data/content')
    for(const [id,article] of Object.entries(articles)){
      for(const ref of [...article.related,...(article.before?[article.before]:[])]){
        expect(byId.has(ref),`${id} → ${ref}`).toBe(true)
      }
    }
    for(const item of records){
      for(const ref of item.related){
        expect(byId.has(ref),`${item.id} → ${ref}`).toBe(true)
      }
    }
  })
  it('无坐标地点仍可计数且不被当成精确图钉',()=>{
    expect(stats.noPosition).toBe(145)
    expect(stats.exact).toBe(0)
    expect(places.filter(p=>!p.position).length).toBe(145)
    expect(places.filter(p=>p.position?.precision==='area').length).toBe(72)
  })
})

describe('V2 地图与文章',()=>{
  it('在三种 DPR 使用原生像素并保持网格方向',async()=>{
    const {gameToPixel,rasterQuality}=await import('../src/geometry')
    expect(gameToPixel(100,200)).toEqual([16484,16184])
    for(const ratio of [1,2,3]){
      const raster=rasterQuality(ratio)
      expect(256/raster.tileSize).toBeGreaterThanOrEqual(ratio)
      expect(raster.maxZoom).toBeLessThanOrEqual(6-Math.log2(ratio))
      expect(raster.maxZoom).toBe(3.75)
    }
  })
  it('文章数据声明完整时需要首尾和实际阶段',async()=>{
    const {articles,validateArticles}=await import('../src/data/articles')
    const original=articles['mission-gone-fishing']
    expect(original.quality).toBe('complete')
    expect(()=>validateArticles({'mission-gone-fishing':{...original,checkpoints:[]}})).toThrow('完整攻略')
    expect(()=>validateArticles({'mission-gone-fishing':{...original,related:['missing']}})).toThrow('关联失效')
  })
})
