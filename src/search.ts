import Fuse from 'fuse.js'
import { pinyin } from 'pinyin-pro'
import { categoryNames, regionNames } from './data/categories'
import type { RecordItem } from './data/schema'

export function createSearch(items: RecordItem[]) {
  const data = items.map(item => {
    const name = [item.zh,item.en,...item.aliases].join(' ')
    const roman = pinyin(item.zh,{toneType:'none',type:'array'})
    const type = item.kind === 'place' ? categoryNames[item.category] + ' ' + item.subcategory : item.group
    const region = item.region ? regionNames[item.region] : ''
    return {item, label:name.toLowerCase(), roman:roman.join(''), spaced:roman.join(' '), type, region}
  })
  const fuse = new Fuse(data,{keys:[{name:'label',weight:5},'roman','spaced','type','region'],threshold:0.32,ignoreLocation:true})
  return (query: string) => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    const tokens = q.split(/\s+/)
    const exact = data.filter(row => tokens.every(t => [row.label,row.roman,row.spaced,row.type,row.region].some(value => value.includes(t))))
    const fuzzy = fuse.search(q).map(result => result.item)
    return [...new Map([...exact,...fuzzy].map(row => [row.item.id,row.item])).values()]
  }
}
