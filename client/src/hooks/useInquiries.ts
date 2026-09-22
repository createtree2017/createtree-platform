import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { inquiryDetailSchema, inquiryListSchema, inquiryUnreadSchema, inquiryReadResultSchema, type InquiryCreate, type InquiryFilter } from '@shared/inquiries';

export const inquiryKeys = {
  all: ['inquiries'] as const,
  unread: (userId: number) => ['inquiries', userId, 'mine', 'unread-count'] as const,
  list: (userId: number, admin: boolean, filter: InquiryFilter = 'all', page = 1) => ['inquiries', userId, admin ? 'admin' : 'mine', 'list', filter, page] as const,
  detail: (userId: number, admin: boolean, id: number) => ['inquiries', userId, admin ? 'admin' : 'mine', 'detail', id] as const,
};
export async function inquiryRequest<T>(url: string, schema: z.ZodType<T>, options: Parameters<typeof apiRequest>[1] = {}) {
  const response = await apiRequest(url, options);
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) throw new Error('문의 응답을 확인하지 못했습니다. 다시 시도해주세요.');
  return parsed.data;
}
export const inquiryRetry = (count: number, error: unknown) => {
  if (error instanceof Error && error.name === 'AbortError') return false;
  const status = (error as { status?: number })?.status;
  return count < 1 && (!status || status >= 500);
};
export function mayShowInquiryData(error: unknown) {
  return ![401, 403, 404].includes((error as { status?: number })?.status ?? 0);
}
const queryOptions = { staleTime: 0, refetchOnWindowFocus: true, refetchOnReconnect: true, retry: inquiryRetry };

export function useUnreadInquiryCount(userId: number) {
  return useQuery({ ...queryOptions, queryKey: inquiryKeys.unread(userId), enabled: userId > 0,
    queryFn: ({ signal }) => inquiryRequest('/api/inquiries/unread-count', inquiryUnreadSchema, { signal }), refetchInterval: 30000,
  });
}
export function useMarkInquiryRead(id: number) {
  const cache = useQueryClient();
  return useMutation({ retry: false,
    mutationFn: (answerRevision: number) => inquiryRequest(`/api/inquiries/${id}/read`, inquiryReadResultSchema, { method: 'PUT', data: { answerRevision } }),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: inquiryKeys.all }); },
  });
}

export function useMyInquiries(userId: number) {
  return useInfiniteQuery({
    ...queryOptions, queryKey: inquiryKeys.list(userId, false), enabled: userId > 0, initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => inquiryRequest('/api/inquiries', inquiryListSchema, { params: { page: pageParam, limit: 20 }, signal }),
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
  });
}
export function useAdminInquiries(userId: number, filter: InquiryFilter, page: number) {
  return useQuery({ ...queryOptions, queryKey: inquiryKeys.list(userId, true, filter, page), enabled: userId > 0,
    queryFn: ({ signal }) => inquiryRequest('/api/admin/inquiries', inquiryListSchema, { params: { status: filter, page, limit: 20 }, signal }),
  });
}
export function useInquiryDetail(userId: number, id: number, admin = false) {
  return useQuery({ ...queryOptions, queryKey: inquiryKeys.detail(userId, admin, id), enabled: userId > 0 && id > 0,
    queryFn: ({ signal }) => inquiryRequest(`${admin ? '/api/admin' : '/api'}/inquiries/${id}`, inquiryDetailSchema, { signal }),
  });
}
export function useCreateInquiry() {
  const cache = useQueryClient();
  return useMutation({ retry: false,
    mutationFn: (data: InquiryCreate) => inquiryRequest('/api/inquiries', inquiryDetailSchema, { method: 'POST', data }),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: inquiryKeys.all }); },
  });
}
export function useAnswerInquiry(id: number) {
  const cache = useQueryClient();
  return useMutation({ retry: false,
    mutationFn: (answer: string) => inquiryRequest(`/api/admin/inquiries/${id}/answer`, inquiryDetailSchema, { method: 'PUT', data: { answer } }),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: inquiryKeys.all }); },
  });
}
