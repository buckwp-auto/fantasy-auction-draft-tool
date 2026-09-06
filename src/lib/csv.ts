import type { Player, Position } from '../types'
import { POSITIONS } from '../types'
import { playerIdFromName } from './storage'

const POS_SET = new Set<string>(POSITIONS)

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_]+/g, '')
}

const HEADER_MAP: Record<string, keyof CsvRow> = {
  name: 'name',
  player: 'name',
  pos: 'pos',
  position: 'pos',
  team: 'team',
  nflteam: 'team',
  bye: 'bye',
  tier: 'tier',
  'projected$': 'projected',
  projected: 'projected',
  projecteddollars: 'projected',
  project$: 'projected',
  dollars: 'projected',
  vbd: 'vbd',
  aav: 'aav',
  yahoo$: 'aav',
  yahoo: 'aav',
}

interface CsvRow {
  name: string
  pos: string
  team: string
  bye: string
  tier: string
  projected: string
  vbd: string
  aav: string
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cells.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur)
  return cells
}

function parseNumber(raw: string): number {
  if (!raw || raw.trim() === '') return 0
  const n = Number(String(raw).replace(/[$,]/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

function parseBye(raw: string): number | null {
  if (!raw || raw.trim() === '' || raw.trim().toUpperCase() === 'N/A') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function normalizePos(raw: string): Position | null {
  const p = raw.trim().toUpperCase()
  if (p === 'DST' || p === 'D/ST' || p === 'DEFENSE') return 'DEF'
  if (POS_SET.has(p)) return p as Position
  return null
}

export interface CsvParseResult {
  players: Player[]
  errors: string[]
}

export function parsePlayersCsv(text: string): CsvParseResult {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)

  if (lines.length < 2) {
    return { players: [], errors: ['CSV needs a header row and at least one player.'] }
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader)
  const index: Partial<Record<keyof CsvRow, number>> = {}
  headers.forEach((h, i) => {
    const key = HEADER_MAP[h]
    if (key) index[key] = i
  })

  if (index.name === undefined || index.pos === undefined) {
    return {
      players: [],
      errors: ['CSV must include name and pos columns.'],
    }
  }

  const players: Player[] = []
  const errors: string[] = []
  const seen = new Set<string>()

  for (let r = 1; r < lines.length; r++) {
    const cells = parseCsvLine(lines[r])
    const get = (key: keyof CsvRow) =>
      index[key] !== undefined ? (cells[index[key]!] ?? '').trim() : ''

    const name = get('name')
    if (!name) continue
    const pos = normalizePos(get('pos'))
    if (!pos) {
      errors.push(`Row ${r + 1}: unknown position "${get('pos')}" for ${name}`)
      continue
    }

    const id = playerIdFromName(name, pos)
    if (seen.has(id)) {
      errors.push(`Row ${r + 1}: duplicate ${name} (${pos}) skipped`)
      continue
    }
    seen.add(id)

    players.push({
      id,
      name,
      pos,
      nflTeam: get('team'),
      bye: parseBye(get('bye')),
      tier: get('tier'),
      projectedDollars: parseNumber(get('projected')),
      vbd: parseNumber(get('vbd')),
      aav: parseNumber(get('aav')),
      mark: 'none',
    })
  }

  players.sort((a, b) => b.projectedDollars - a.projectedDollars || b.vbd - a.vbd)
  return { players, errors }
}

export const CSV_TEMPLATE = `name,pos,team,bye,tier,projected$,vbd,aav
Jahmyr Gibbs,RB,DET,6,RB1,83.52,218.59,72.7
Josh Allen,QB,BUF,7,QB1,33.17,86.98,30
`

export function playersFromSampleJson(
  data: Array<{
    name: string
    pos: string
    nflTeam: string
    bye: number | string | null
    tier: string
    projectedDollars: number
    vbd: number
    aav: number
    mark?: string
    target?: boolean
  }>,
): Player[] {
  const players: Player[] = []
  for (const row of data) {
    const pos = normalizePos(row.pos)
    if (!pos) continue
    const mark =
      row.mark === 'target' || row.mark === 'avoid' || row.mark === 'none'
        ? row.mark
        : row.target
          ? 'target'
          : 'none'
    players.push({
      id: playerIdFromName(row.name, pos),
      name: row.name,
      pos,
      nflTeam: row.nflTeam,
      bye:
        row.bye === null || row.bye === ''
          ? null
          : typeof row.bye === 'number'
            ? row.bye
            : parseBye(String(row.bye)),
      tier: row.tier ?? '',
      projectedDollars: row.projectedDollars ?? 0,
      vbd: row.vbd ?? 0,
      aav: row.aav ?? 0,
      mark,
    })
  }
  players.sort((a, b) => b.projectedDollars - a.projectedDollars || b.vbd - a.vbd)
  return players
}
