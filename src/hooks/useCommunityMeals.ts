import { useState, useEffect } from 'react';
import type { CommunityMeal } from '../lib/types';
import { readCommunityCache, writeCommunityCache } from '../lib/localCache';

export function useCommunityMeals() {
  const [communityMeals, setCommunityMeals] = useState<CommunityMeal[]>(() => readCommunityCache() ?? []);
  const [communityLoading, setCommunityLoading] = useState(false);

  // Persist to cache whenever the list changes (after network load, publish, or unpublish)
  useEffect(() => {
    if (communityMeals.length > 0) writeCommunityCache(communityMeals);
  }, [communityMeals]);

  return { communityMeals, communityLoading, setCommunityMeals, setCommunityLoading };
}
