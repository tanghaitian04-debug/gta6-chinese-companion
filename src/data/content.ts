import rawPlaces from './places.json'
import rawFacilities from './facilities.json'
import rawEntries from './entries.json'
import { validateContent, verified } from './schema'

export const {places, entries} = validateContent([...rawPlaces,...rawFacilities], rawEntries)
export const records = [...places, ...entries]
export const byId = new Map(records.map(item => [item.id,item]))
export const stats = {
  all: records.length, verified: records.filter(verified).length,
  pending: records.filter(item => item.confidence === 'pending').length,
  disputed: records.filter(item => item.confidence === 'disputed').length,
  exact: places.filter(p => p.position?.precision === 'exact').length,
  noPosition: places.filter(p=>!p.position).length,
  verifiedMapped:places.filter(p=>p.position&&verified(p)).length,
  area: places.filter(p => p.position?.precision === 'area').length,
  date: records.map(p => p.reviewed).sort().at(-1) ?? '待核实',
}
