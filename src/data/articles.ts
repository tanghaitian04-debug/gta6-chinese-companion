import {z} from 'zod'
import {byId} from './content'
import {httpsUrl,verified} from './schema'
import rawArticles from './articles.json'

const step=z.object({
  id:z.string().regex(/^[a-z0-9-]+$/),
  title:z.string().min(2),
  action:z.string().min(18),
  check:z.string().min(5),
  note:z.string().optional(),
})
const articleSchema=z.object({
  quality:z.enum(['complete','partial','reference']),
  intro:z.string().min(12),
  start:z.string().min(12).optional(),
  finish:z.string().min(12).optional(),
  reward:z.string().optional(),
  role:z.string().optional(),
  before:z.string().optional(),
  sequence:z.number().int().nonnegative().optional(),
  checkpoints:z.array(step).default([]),
  sections:z.array(z.object({
    id:z.string().regex(/^[a-z0-9-]+$/),
    title:z.string().min(2),
    paragraphs:z.array(z.string().min(14)).min(1),
  })).default([]),
  related:z.array(z.string()).default([]),
  sources:z.array(z.object({url:httpsUrl,label:z.string().min(1),scope:z.string().min(1)})).min(1),
})

export type Article=z.infer<typeof articleSchema>
export const articleStatus={complete:'完整攻略',partial:'部分攻略',reference:'站内百科'} as const
export const articles=validateArticles(rawArticles)

export function validateArticles(input:unknown) {
  const data=z.record(z.string(),articleSchema).parse(input)
  for (const [id,article] of Object.entries(data)) {
    const entry=byId.get(id)
    if(!entry||entry.kind==='place')throw new Error(`文章缺少条目 ${id}`)
    if(article.quality==='complete'&&(
      entry.kind!=='mission'||!verified(entry)||!article.role||!article.start||!article.finish
      ||article.checkpoints.length<2||article.sequence===undefined||!article.reward
    ))throw new Error(`完整攻略缺少开始、实机流程或结束条件 ${id}`)
    if(article.quality==='reference'&&article.sections.length<2)throw new Error(`百科正文不足 ${id}`)
    if(new Set(article.checkpoints.map(s=>s.id)).size!==article.checkpoints.length
      ||new Set(article.sections.map(s=>s.id)).size!==article.sections.length)throw new Error(`文章锚点重复 ${id}`)
    for(const related of [...article.related,...(article.before?[article.before]:[])]) {
      if(!byId.has(related))throw new Error(`文章关联失效 ${id} → ${related}`)
    }
  }
  return data
}
