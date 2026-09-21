import { useQuery } from '@tanstack/react-query';
import { retryMissionRead, HttpError } from '@/lib/authenticated-fetch';
import { apiRequest } from '@/lib/queryClient';

export interface ThemeMission {
  id: number;
  missionId: string;
  title: string;
  description: string;
  categoryId?: string;
  headerImageUrl?: string;
  visibilityType: string;
  hospitalId?: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  order: number;
  category?: {
    categoryId: string;
    name: string;
  };
  hospital?: {
    id: number;
    name: string;
  };
  userProgress?: {
    status: string;
    progressPercent: number;
    completedSubMissions: number;
    totalSubMissions: number;
  };
  hasChildMissions?: boolean;
  childMissionCount?: number;
  totalMissionCount?: number;
  isApprovedForChildAccess?: boolean;
  hasGift?: boolean;
  capacity?: number | null;
  currentApplicants?: number;
  waitlistCount?: number;
  isFirstCome?: boolean;
  applicationPeriod?: {
    startDate?: string;
    endDate?: string;
  } | null;
  eventDate?: string | null;
  eventEndTime?: string | null;
}

async function readMissionList(url: string, signal: AbortSignal): Promise<ThemeMission[]> {
  const response = await apiRequest(url, { signal });
  const data: unknown = await response.json();
  if (!Array.isArray(data) || !data.every(item => item && typeof item === 'object' &&
      Number.isInteger(item.id) && typeof item.missionId === 'string' && typeof item.title === 'string')) {
    throw new HttpError(502, '목록 응답을 확인하지 못했습니다. 다시 시도해주세요.');
  }
  return data;
}

export function missionQueryOptions(user: { id: number; hospitalId?: number | null; memberType?: string | null } | null | undefined, filter: string, showHistory: boolean) {
  const scope = { userId: user?.id, hospitalId: user?.hospitalId, memberType: user?.memberType };
  const options = {
    enabled: !!user,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retryOnMount: true,
    retry: retryMissionRead,
    retryDelay: 1000,
    staleTime: 30_000,
  };
  const missions = {
    ...options,
    queryKey: ['/api/missions', filter, scope],
    queryFn: ({ signal }: { signal: AbortSignal }) => readMissionList(
      `/api/missions${filter && filter !== 'all' ? `?filter=${encodeURIComponent(filter)}` : ''}`, signal),
  };
  const history = {
    ...options,
    queryKey: ['/api/missions/history', scope],
    enabled: !!user && showHistory,
    queryFn: ({ signal }: { signal: AbortSignal }) => readMissionList('/api/missions/history', signal),
  };
  return { missions, history };
}

export function useMissionQueries(...args: Parameters<typeof missionQueryOptions>) {
  const options = missionQueryOptions(...args);
  return { missions: useQuery(options.missions), history: useQuery(options.history) };
}
