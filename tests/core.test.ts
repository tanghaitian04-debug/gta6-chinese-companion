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
    expect(toLeaflet(320,640)).toEqual([-20,10])
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
