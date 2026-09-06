import { normalizeNameKey } from './fantasypros'

export type AavProvider = 'yahoo' | 'espn' | 'none'

export interface AavEntry {
  name: string
  aav: number
}

/**
 * Best-effort AAV pull. Yahoo/ESPN pages change often; failures are non-fatal.
 */
export async function fetchAav(provider: AavProvider): Promise<Map<string, number>> {
  if (provider === 'none') return new Map()
  try {
    if (provider === 'yahoo') return await fetchYahooAav()
    if (provider === 'espn') return await fetchEspnAav()
  } catch (err) {
    console.warn(`AAV fetch (${provider}) failed:`, err)
  }
  return new Map()
}

async function fetchYahooAav(): Promise<Map<string, number>> {
  // Yahoo salary-cap draft analysis (sheet source). Often requires cookies / returns SPA shell.
  const url =
    'https://football.fantasysports.yahoo.com/f1/draftanalysis?type=salcap&tab=AD&pos=ALL'
  const res = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (compatible; fantasy-auction-draft-tool/1.0; +local-refresh)',
      accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`)
  const html = await res.text()
  return parseLooseNamePriceMap(html)
}

async function fetchEspnAav(): Promise<Map<string, number>> {
  const url = 'https://fantasy.espn.com/football/livedraftresults'
  const res = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (compatible; fantasy-auction-draft-tool/1.0; +local-refresh)',
      accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) throw new Error(`ESPN HTTP ${res.status}`)
  const html = await res.text()
  return parseLooseNamePriceMap(html)
}

/** Extract name→price pairs from embedded JSON or HTML text when possible. */
function parseLooseNamePriceMap(html: string): Map<string, number> {
  const map = new Map<string, number>()

  // Try JSON blobs with averageAuctionValue / avgSalary / auctionValue fields
  const jsonChunks = html.match(/\{[^{}]{0,200}"(?:averageAuctionValue|avgSalary|auctionValue|aav)"[^{}]{0,200}\}/g) ?? []
  for (const chunk of jsonChunks) {
    try {
      const obj = JSON.parse(chunk) as Record<string, unknown>
      const name = String(obj.playerName ?? obj.name ?? obj.fullName ?? '')
      const price = Number(
        obj.averageAuctionValue ?? obj.avgSalary ?? obj.auctionValue ?? obj.aav,
      )
      if (name && Number.isFinite(price) && price > 0) {
        map.set(normalizeNameKey(name), price)
      }
    } catch {
      // ignore
    }
  }

  // Fallback: "Player Name",$12.3 or Player Name</td><td>$12
  const re =
    /([A-Z][a-zA-Z.''\-\s]{2,40}),?\s*\$?\s*(\d{1,3}(?:\.\d+)?)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const name = m[1].trim()
    const price = Number(m[2])
    if (price >= 1 && price <= 100) {
      map.set(normalizeNameKey(name), price)
    }
  }

  return map
}

export function applyAav<T extends { name: string; aav: number }>(
  players: T[],
  aavMap: Map<string, number>,
): { players: T[]; matched: number } {
  let matched = 0
  const next = players.map((p) => {
    const hit = aavMap.get(normalizeNameKey(p.name))
    if (hit != null) {
      matched += 1
      return { ...p, aav: Math.round(hit * 100) / 100 }
    }
    return p
  })
  return { players: next, matched }
}
