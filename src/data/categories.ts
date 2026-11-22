export const categories = {
  explore: ['城市与城区','地标','海滩','公园与自然区域','山区','湿地','小岛','景点','特殊建筑'],
  services: ['武器商店','服装商店','汽车相关设施','餐饮与便利店','医院','警察局','交通设施','住宿与安全屋','其他设施'],
  missions: ['主线任务','支线任务','随机事件','特殊活动','NPC 关联地点','任务触发位置'],
  collectibles: ['收藏卡','特技跳跃','隐藏物品','WAiNK','冥想地点','其他收集品'],
  vehicles: ['汽车','摩托车','船只','飞机','直升机','特殊载具','稀有载具','其他载具'],
  weapons: ['武器获取位置','特殊物品','补给地点','其他物品'],
  activities: ['比赛','运动项目','休闲活动','可互动小游戏','其他活动'],
  secrets: ['彩蛋','特殊场景','隐藏事件','拍照地点'],
} as const

export type Category = keyof typeof categories
export const categoryIds = Object.keys(categories) as [Category, ...Category[]]
export const categoryNames: Record<Category, string> = {
  explore: '探索地点', services: '游戏设施', missions: '任务地点', collectibles: '收集品',
  vehicles: '载具', weapons: '武器与物品', activities: '娱乐活动', secrets: '隐藏内容',
}
export const categoryColors: Record<Category, string> = {
  explore:'#8ce2d4', services:'#a4b3ff', missions:'#fb94be', collectibles:'#ffcc82',
  vehicles:'#86d0ff', weapons:'#ffa493', activities:'#c7a3ff', secrets:'#a8dd95',
}
export const confidenceNames = {
  official:'官方确认', gameplay:'实机核验', corroborated:'多来源核验',
  pending:'社区待核验', disputed:'已失效或存在争议',
} as const
export const confidenceIds = ['official','gameplay','corroborated','pending','disputed'] as const
export const regionIds = ['vice-city','keys','grassrivers','gellhorn','ambrosia','kalaga','other'] as const
export const regionNames = {
  'vice-city':'罪恶城', keys:'雷奥奈达群岛', grassrivers:'草泽地', gellhorn:'盖尔霍恩港',
  ambrosia:'安布罗西亚', kalaga:'卡拉加山', other:'其他地区／待核实',
} as const
