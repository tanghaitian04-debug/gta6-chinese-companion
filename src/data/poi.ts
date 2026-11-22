import {categoryColors} from './categories'
import type {Place} from './schema'

export const poiTypes = {
  repair:{label:'修车与改装',color:'#fbb56b',path:'<path d="M20 7a5 5 0 0 1-6.4 6.4L7 20l-3-3 6.6-6.6A5 5 0 0 1 17 4l-3 3 3 3z"/>'},
  convenience:{label:'便利店与超市',color:'#65d9af',path:'<path d="M4 8h16l1 13H3zM8 9V6a4 4 0 0 1 8 0v3"/>'},
  police:{label:'警察局',color:'#9dbfff',path:'<path d="m12 2 8 4v6c0 4-3 7-8 10-5-3-8-6-8-10V6z"/><path d="m12 8 1.2 2.5 2.8.4-2 2 .5 2.9-2.5-1.4-2.5 1.4.5-2.9-2-2 2.8-.4z"/>'},
  medical:{label:'医院',color:'#ff9eb1',path:'<path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5z"/>'},
  gunshop:{label:'武器商店',color:'#ffa493',path:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>'},
  clothes:{label:'服装店',color:'#e1a4ff',path:'<path d="M10 6a2 2 0 1 1 3 1.7L12 9v2l9 6a1.7 1.7 0 0 1-1 3H4a1.7 1.7 0 0 1-1-3l9-6"/>'},
  transport:{label:'机场与交通',color:'#83dcff',path:'<path d="M17 21v-8l-5-4V4a1 1 0 0 0-2 0v5l-5 4v8l6-3z"/><path d="M5 13h12"/>'},
  home:{label:'安全屋',color:'#b7e2a4',path:'<path d="m3 11 9-8 9 8v9H3zM9 20v-6h6v6"/>'},
  mission:{label:'任务',color:'#fb9abd',path:'<path d="M6 3v18m0-17c4-4 8 4 13 0v10c-5 3-9-4-13 0"/>'},
  collection:{label:'收集品',color:'#ffcd82',path:'<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>'},
  vehicle:{label:'载具',color:'#77d0ff',path:'<path d="M3 10l2-5h14l2 5v8H3zm0 0h18M6 15h1m10 0h1M6 18v3m12-3v3"/>'},
  landmark:{label:'地标',color:'#8ce2d4',path:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>'},
  food:{label:'餐饮与酒吧',color:'#e4c080',path:'<path d="M5 3v7a3 3 0 0 0 6 0V3M8 3v18m9 0V3c-2 3-3 7-3 11h3"/>'},
} as const

export type PoiType=keyof typeof poiTypes
export const quickTypes=['repair','convenience','police','medical','gunshop','clothes','transport','mission','collection','home'] as const

export function poiType(item:Place):PoiType {
  if(item.category==='collectibles')return 'collection'
  if(item.category==='missions')return 'mission'
  if(item.category==='vehicles')return 'vehicle'
  switch(item.subcategory){
    case '汽车相关设施':case '维修与改装设施':return 'repair'
    case '便利店与超市':return 'convenience'
    case '车辆扣押场':case '警察局':return 'police'
    case '医院':return 'medical'
    case '武器商店':return 'gunshop'
    case '服装商店':return 'clothes'
    case '交通设施':return 'transport'
    case '住宿与安全屋':return 'home'
    case '餐饮与便利店':case '餐饮与酒吧':return 'food'
    default:return 'landmark'
  }
}

export function poiColor(item:Place) {
  const type=poiType(item)
  return type==='landmark'?categoryColors[item.category]:poiTypes[type].color
}

export function poiIcon(type:PoiType) {
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${poiTypes[type].path}</svg>`
}
