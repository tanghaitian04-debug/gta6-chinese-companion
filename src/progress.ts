import { useSyncExternalStore } from 'react'
import { z } from 'zod'

const flag = z.object({
  favorite:z.boolean().default(false), visited:z.boolean().default(false),
  collected:z.boolean().default(false), note:z.string().max(2000).default(''),
  touched:z.number().nonnegative().default(0),
}).strict()
const recordID = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(96).refine(value => value !== 'constructor' && value !== 'prototype')
const profileSchema = z.object({
  id:recordID, name:z.string().trim().min(1).max(40),
  items:z.record(recordID,flag), checks:z.array(recordID).max(2000),
}).strict()
export const backupSchema = z.object({
  version:z.literal(1), active:recordID, profiles:z.array(profileSchema).min(1).max(24),
}).strict().superRefine((state,ctx) => {
  const ids = new Set(state.profiles.map(p => p.id))
  if (ids.size !== state.profiles.length || !ids.has(state.active)) {
    ctx.addIssue({code:'custom',message:'存档编号重复或当前存档不存在'})
  }
})
export type Flag = z.infer<typeof flag>
export type Backup = z.infer<typeof backupSchema>
export const blankFlag: Flag = {favorite:false,visited:false,collected:false,note:'',touched:0}
export const blankBackup: Backup = {version:1,active:'default',profiles:[{id:'default',name:'默认存档',items:{},checks:[]}]}
const storageKey = 'leonida-companion.progress.v1'
type Snapshot = {data:Backup, error:string}
const listeners = new Set<() => void>()

export function parseBackup(text: string): Backup {
  if (text.length > 4_000_000) throw new Error('备份超过 4 MB')
  return backupSchema.parse(JSON.parse(text))
}
function read(): Snapshot {
  try {
    const value = localStorage.getItem(storageKey)
    return {data:value ? parseBackup(value) : blankBackup,error:''}
  } catch {
    return {data:blankBackup,error:'无法读取本地存档。请检查浏览器储存权限或恢复备份。'}
  }
}
let snapshot: Snapshot = typeof window === 'undefined' ? {data:blankBackup,error:''} : read()
function emit() { for (const listener of listeners) listener() }
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
if (typeof window !== 'undefined') window.addEventListener('storage',event => {
  if (event.key !== storageKey) return
  snapshot = read()
  emit()
})
export function replaceProgress(next: Backup) {
  const checked = backupSchema.parse(next)
  try {
    localStorage.setItem(storageKey,JSON.stringify(checked))
    snapshot = {data:checked,error:''}
    emit()
  } catch {
    snapshot = {...snapshot,error:'存档写入失败。请检查浏览器储存是否已满。'}
    emit()
    throw new Error(snapshot.error)
  }
}
function change(update: (state: Backup) => Backup) {
  const next = update(read().data)
  try { replaceProgress(next) } catch { /* error is displayed by the app */ }
}
export function updateFlag(id: string, next: Partial<Flag>) {
  change(state => ({...state,profiles:state.profiles.map(profile => profile.id !== state.active ? profile : ({
    ...profile,items:{...profile.items,[id]:{...blankFlag,...profile.items[id],...next,touched:Date.now()}},
  }))}))
}
export function toggleCheck(id: string) {
  change(state => ({...state,profiles:state.profiles.map(profile => profile.id !== state.active ? profile : ({
    ...profile,checks:profile.checks.includes(id) ? profile.checks.filter(ref => ref !== id) : [...profile.checks,id],
  }))}))
}
export function addProfile(name: string) {
  change(state => {
    if (state.profiles.length >= 24 || !name.trim()) return state
    const id = crypto.randomUUID()
    return {...state,active:id,profiles:[...state.profiles,{id,name:name.trim(),items:{},checks:[]}]}
  })
}
export function selectProfile(id: string) {
  change(state => state.profiles.some(p => p.id === id) ? {...state,active:id} : state)
}
export function resetCategory(ids: string[]) {
  change(state => ({...state,profiles:state.profiles.map(p => {
    if (p.id !== state.active) return p
    const items = {...p.items}
    for (const id of ids) if (items[id]) items[id] = {...items[id],collected:false,visited:false}
    return {...p,items}
  })}))
}
export function useProgress() {
  const {data,error} = useSyncExternalStore(subscribe,() => snapshot)
  return {data,error,profile:data.profiles.find(p => p.id === data.active)!}
}
