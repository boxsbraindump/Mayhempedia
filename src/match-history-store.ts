import Store from 'electron-store'
import {
  buildMatchHistoryResult,
  type Achievement,
  type MatchFullDetail,
  type MatchHistoryResult,
  type MatchSummary,
} from './match-history.js'

const MAX_STORED_MATCHES = 500
const MAX_STORED_DETAILS = 100

interface AccountMatchHistory {
  puuid: string
  gameName?: string
  tagLine?: string
  updatedAt: string
  matches: MatchSummary[]
  achievements: Achievement[]
  details: Record<string, MatchFullDetail>
}

interface MatchHistoryStoreSchema {
  accounts: Record<string, AccountMatchHistory>
}

export interface PersistedAccountSummary {
  puuid: string
  gameName?: string
  tagLine?: string
  updatedAt: string
  matchCount: number
  detailCount: number
  latestGameCreationDate?: string
  isCurrent: boolean
}

let store: Store<MatchHistoryStoreSchema> | null = null

function getStore(): Store<MatchHistoryStoreSchema> {
  if (!store) {
    store = new Store<MatchHistoryStoreSchema>({
      name: 'match-history',
      defaults: { accounts: {} },
    })
  }
  return store
}

function emptyAccount(puuid: string): AccountMatchHistory {
  return {
    puuid,
    updatedAt: new Date().toISOString(),
    matches: [],
    achievements: [],
    details: {},
  }
}

function readAccount(puuid: string): AccountMatchHistory {
  return getStore().store.accounts?.[puuid] ?? emptyAccount(puuid)
}

function writeAccount(account: AccountMatchHistory): void {
  const accounts = { ...(getStore().store.accounts ?? {}) }
  accounts[account.puuid] = account
  getStore().set('accounts', accounts)
}

function mergeMatches(stored: MatchSummary[], fresh: MatchSummary[]): MatchSummary[] {
  const byId = new Map<number, MatchSummary>()
  for (const match of stored) byId.set(match.gameId, match)
  for (const match of fresh) byId.set(match.gameId, match)
  return [...byId.values()]
    .sort((a, b) => b.gameCreationDate.localeCompare(a.gameCreationDate))
    .slice(0, MAX_STORED_MATCHES)
}

function mergeAchievements(stored: Achievement[], fresh: Achievement[]): Achievement[] {
  const byKey = new Map<string, Achievement>()
  for (const achievement of stored) byKey.set(`${achievement.key}:${achievement.gameId}`, achievement)
  for (const achievement of fresh) byKey.set(`${achievement.key}:${achievement.gameId}`, achievement)
  return [...byKey.values()].sort((a, b) => b.gameCreationDate.localeCompare(a.gameCreationDate))
}

function pruneDetails(
  details: Record<string, MatchFullDetail>,
  matches: MatchSummary[],
): Record<string, MatchFullDetail> {
  const keepIds = new Set(matches.slice(0, MAX_STORED_DETAILS).map((m) => String(m.gameId)))
  const pruned: Record<string, MatchFullDetail> = {}
  for (const id of keepIds) {
    const detail = details[id]
    if (detail) pruned[id] = detail
  }
  return pruned
}

export function loadPersistedMatchHistory(puuid: string): MatchHistoryResult | null {
  const account = readAccount(puuid)
  return buildMatchHistoryResult(account.matches, account.achievements)
}

export function listPersistedAccounts(currentPuuid: string | null): PersistedAccountSummary[] {
  return Object.values(getStore().store.accounts ?? {})
    .map((account) => ({
      puuid: account.puuid,
      gameName: account.gameName,
      tagLine: account.tagLine,
      updatedAt: account.updatedAt,
      matchCount: account.matches.length,
      detailCount: Object.keys(account.details ?? {}).length,
      latestGameCreationDate: account.matches[0]?.gameCreationDate,
      isCurrent: account.puuid === currentPuuid,
    }))
    .sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
      return b.updatedAt.localeCompare(a.updatedAt)
    })
}

export function forgetPersistedAccount(puuid: string): void {
  const accounts = { ...(getStore().store.accounts ?? {}) }
  delete accounts[puuid]
  getStore().set('accounts', accounts)
}

export function mergePersistedMatchHistory(
  puuid: string,
  summoner: { gameName?: string; tagLine?: string },
  fresh: MatchHistoryResult,
): MatchHistoryResult {
  const account = readAccount(puuid)
  const matches = mergeMatches(account.matches, fresh.matches)
  const achievements = mergeAchievements(account.achievements, fresh.achievements)
  const updated: AccountMatchHistory = {
    ...account,
    gameName: summoner.gameName,
    tagLine: summoner.tagLine,
    updatedAt: new Date().toISOString(),
    matches,
    achievements,
    details: pruneDetails(account.details ?? {}, matches),
  }
  writeAccount(updated)
  return buildMatchHistoryResult(matches, achievements) ?? fresh
}

export function loadPersistedMatchDetail(puuid: string, gameId: number): MatchFullDetail | null {
  return readAccount(puuid).details?.[String(gameId)] ?? null
}

export function savePersistedMatchDetail(puuid: string, detail: MatchFullDetail): void {
  const account = readAccount(puuid)
  const details = pruneDetails({ ...(account.details ?? {}), [String(detail.gameId)]: detail }, account.matches)
  writeAccount({
    ...account,
    updatedAt: new Date().toISOString(),
    details,
  })
}
