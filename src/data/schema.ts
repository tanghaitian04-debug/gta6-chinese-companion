import { z } from 'zod'
import { categories, categoryIds, confidenceIds, regionIds } from './categories'
import mapConfig from './map.json'

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(96)
const date = z.iso.date()
export const httpsUrl = z.url({protocol: /^https$/})
const source = z.object({
  label: z.string().min(1), url: httpsUrl, type: z.enum(['official','gameplay','community']),
  publisher: z.string().min(1), evidence: z.string().min(1), accessed: date,
})
const fieldReview = z.object({
  status:z.enum(['verified','community','pending','disputed']), source:httpsUrl.optional(),
}).refine(field=>field.status==='pending'||!!field.source,'核验状态需要相应证据')
const base = z.object({
  id, zh: z.string().min(1), en: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  summary: z.string().min(1), confidence: z.enum(confidenceIds),
  sources: z.array(source).min(1), reviewed: date, modified: date,
  version: z.string().nullable().default(null), spoiler: z.boolean().default(false),
  fieldReview: z.record(z.string(),fieldReview).default({}),
  region: z.enum(regionIds).nullable().default(null),
})
export const positionSchema = z.object({
  x: z.number().min(0).max(mapConfig.width), y: z.number().min(0).max(mapConfig.height),
  precision: z.enum(['exact','area']),
  radius: z.number().min(0).max(mapConfig.height).optional(),
  source: httpsUrl,
}).refine(p => p.precision === 'exact' ? !p.radius : !!p.radius, '范围点需提供展示半径')
export const placeSchema = base.extend({
  kind: z.literal('place'), category: z.enum(categoryIds), subcategory: z.string(),
  address:z.string().optional(), position: positionSchema.nullable(), directions: z.array(z.string()).default([]),
  prerequisites: z.string().nullable().default(null), related: z.array(id).default([]),
  media: z.array(z.object({label:z.string(), url:httpsUrl})).default([]),
}).superRefine((p,ctx) => {
  if (!(categories[p.category] as readonly string[]).includes(p.subcategory)) {
    ctx.addIssue({code:'custom',path:['subcategory'],message:'主分类和子分类不匹配'})
  }
  if (p.position?.precision === 'exact' && !p.sources.some(s => s.url === p.position?.source && (s.type === 'gameplay' || s.type === 'official'))) {
    ctx.addIssue({code:'custom',path:['position'],message:'精确坐标需要官方或实机证据'})
  }
  if (p.position && !p.sources.some(s => s.url === p.position?.source)) {
    ctx.addIssue({code:'custom',path:['position'],message:'缺少地图位置证据'})
  }
})
export const entryKinds = ['mission','character','vehicle','weapon','cheat','completion','guide','collection'] as const
export const entrySchema = base.extend({
  kind: z.enum(entryKinds), group: z.string().min(1),
  steps: z.array(z.string()).default([]), related: z.array(id).default([]),
  facts: z.record(z.string(), z.string()).default({}),
  media: z.array(z.object({label:z.string(), url:httpsUrl})).default([]),
})
export const verified = (entry: {confidence: string}) => ['official','gameplay','corroborated'].includes(entry.confidence)
export type Place = z.infer<typeof placeSchema>
export type Entry = z.infer<typeof entrySchema>
export type RecordItem = Place | Entry

export function validateContent(rawPlaces: unknown, rawEntries: unknown) {
  const places = z.array(placeSchema).parse(rawPlaces)
  const entries = z.array(entrySchema).parse(rawEntries)
  const ids = new Set<string>()
  const locations = new Set<string>()
  for (const item of [...places, ...entries]) {
    if (ids.has(item.id)) throw new Error(`重复 ID：${item.id}`)
    ids.add(item.id)
    if (item.modified < item.reviewed) throw new Error(`修改日期早于核验日期：${item.id}`)
    for (const field of Object.values(item.fieldReview)) {
      if (field.source&&!item.sources.some(s=>s.url===field.source)) throw new Error(`无效字段证据：${item.id}`)
    }
    if (item.confidence === 'official' && !item.sources.some(s => s.type === 'official')) throw new Error(`无官方证据：${item.id}`)
    if (item.confidence === 'gameplay' && !item.sources.some(s => s.type === 'gameplay')) throw new Error(`无实机证据：${item.id}`)
    if (item.confidence === 'corroborated' && new Set(item.sources.map(s => s.publisher)).size < 2) throw new Error(`来源不足：${item.id}`)
    if (item.kind === 'place') {
      const p = item.position
      if (!p) continue
      const name = item.en.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'')
      const signature = [name, Math.round(p.x / 8), Math.round(p.y / 8)].join(':')
      if (locations.has(signature)) throw new Error(`疑似重复地点：${item.id}`)
      locations.add(signature)
    }
  }
  for (const item of [...places, ...entries]) {
    if (item.related.some(ref => !ids.has(ref))) throw new Error(`无效关联条目：${item.id}`)
  }
  return {places, entries}
}
