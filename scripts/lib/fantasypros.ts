const FP_BASE = 'https://api.fantasypros.com/public/v2/json'

export type FpPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST'

export interface FpProjectionPlayer {
  fpid: number
  name: string
  position_id: string
  team_id: string
  stats: Record<string, number>
}

export interface FpRankingPlayer {
  player_id: number
  player_name: string
  player_team_id: string
  player_position_id: string
  player_bye_week?: string
  tier?: number
  rank_ecr?: number
  pos_rank?: string
}

async function fpGet<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${FP_BASE}${path}`, {
    headers: { 'x-api-key': apiKey },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`FantasyPros ${res.status} ${path}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

export async function fetchProjections(
  season: number,
  position: FpPosition,
  apiKey: string,
): Promise<FpProjectionPlayer[]> {
  // week=0 is more reliably available on limited public keys than week=draft for all positions
  const data = await fpGet<{ players: FpProjectionPlayer[] }>(
    `/nfl/${season}/projections?position=${position}&week=0`,
    apiKey,
  )
  return data.players ?? []
}

export async function fetchConsensusRankings(
  season: number,
  position: FpPosition,
  apiKey: string,
): Promise<FpRankingPlayer[]> {
  const data = await fpGet<{ players: FpRankingPlayer[] }>(
    `/nfl/${season}/consensus-rankings?position=${position}`,
    apiKey,
  )
  return data.players ?? []
}

export async function fetchAllProjections(
  season: number,
  apiKey: string,
): Promise<FpProjectionPlayer[]> {
  const positions: FpPosition[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DST']
  const chunks = await Promise.all(
    positions.map((pos) => fetchProjections(season, pos, apiKey)),
  )
  return chunks.flat()
}

export async function fetchByeMap(
  season: number,
  apiKey: string,
): Promise<Map<string, { bye: number | null; tier: string }>> {
  const positions: FpPosition[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DST']
  const map = new Map<string, { bye: number | null; tier: string }>()
  for (const pos of positions) {
    try {
      const players = await fetchConsensusRankings(season, pos, apiKey)
      for (const p of players) {
        const key = normalizeNameKey(p.player_name)
        const byeRaw = p.player_bye_week
        const bye =
          byeRaw && byeRaw !== '' && byeRaw !== 'N/A' ? Number(byeRaw) : null
        const tier =
          p.pos_rank ||
          (p.tier != null ? `${pos}${p.tier}` : '')
        map.set(key, {
          bye: Number.isFinite(bye) ? bye : null,
          tier,
        })
      }
    } catch (err) {
      console.warn(`Rankings fetch failed for ${pos}:`, err)
    }
  }
  return map
}

export function normalizeNameKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export function halfPprPoints(stats: Record<string, number>): number {
  if (typeof stats.points_half === 'number') return stats.points_half
  if (typeof stats.points_ppr === 'number' && typeof stats.rec_rec === 'number') {
    return stats.points_ppr - 0.5 * stats.rec_rec
  }
  return stats.points ?? 0
}
