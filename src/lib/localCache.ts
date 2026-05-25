import type { HouseholdState, CommunityMeal } from './types';

const HS_VERSION = 1;
const HS_KEY_PREFIX = 'mp2_hs_';
const COMMUNITY_KEY = 'mp2_community_meals';
const COMMUNITY_TTL_MS = 10 * 60 * 1000;

interface HouseholdCacheEntry {
  v: number;
  householdId: string;
  cachedAt: number;
  state: HouseholdState;
}

interface CommunityCacheEntry {
  v: number;
  cachedAt: number;
  meals: CommunityMeal[];
}

export function readHouseholdCache(householdId: string): HouseholdState | null {
  try {
    const raw = localStorage.getItem(HS_KEY_PREFIX + householdId);
    if (!raw) return null;
    const entry: HouseholdCacheEntry = JSON.parse(raw);
    if (entry.v !== HS_VERSION || entry.householdId !== householdId) {
      localStorage.removeItem(HS_KEY_PREFIX + householdId);
      return null;
    }
    return entry.state;
  } catch {
    return null;
  }
}

export function writeHouseholdCache(householdId: string, state: HouseholdState): void {
  try {
    const entry: HouseholdCacheEntry = { v: HS_VERSION, householdId, cachedAt: Date.now(), state };
    localStorage.setItem(HS_KEY_PREFIX + householdId, JSON.stringify(entry));
  } catch {
    // QuotaExceededError or other storage errors — ignore silently
  }
}

export function clearHouseholdCache(householdId: string): void {
  try {
    localStorage.removeItem(HS_KEY_PREFIX + householdId);
  } catch {
    // ignore
  }
}

export function readCommunityCache(): CommunityMeal[] | null {
  try {
    const raw = localStorage.getItem(COMMUNITY_KEY);
    if (!raw) return null;
    const entry: CommunityCacheEntry = JSON.parse(raw);
    if (entry.v !== 1) {
      localStorage.removeItem(COMMUNITY_KEY);
      return null;
    }
    if (Date.now() - entry.cachedAt > COMMUNITY_TTL_MS) {
      localStorage.removeItem(COMMUNITY_KEY);
      return null;
    }
    return entry.meals;
  } catch {
    return null;
  }
}

export function writeCommunityCache(meals: CommunityMeal[]): void {
  try {
    const entry: CommunityCacheEntry = { v: 1, cachedAt: Date.now(), meals };
    localStorage.setItem(COMMUNITY_KEY, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

export function clearCommunityCache(): void {
  try {
    localStorage.removeItem(COMMUNITY_KEY);
  } catch {
    // ignore
  }
}
