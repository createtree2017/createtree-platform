/**
 * 나의 알림 — 사용자 알림함 페이지
 * 
 * 기능:
 * - 알림 목록 무한스크롤 (useInfiniteQuery)
 * - 읽음/안읽음 구분 (좌측 보라색 점)
 * - 알림 클릭 → 읽음 처리 + 딥링크 이동
 * - 모두 읽음 버튼
 * - 알림 유형별 아이콘 (승인/반려/공지/선물 등)
 */

import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose
} from '@/components/ui/drawer';
import {
  CheckCircle2, XCircle, Bell, Gift, Megaphone, CheckCheck, ExternalLink, ArrowRight
} from 'lucide-react';

interface NotificationItem {
  id: number;
  userId: string;
  type: string;
  title: string;
  message: string;
  data: any;
  actionUrl: string | null;
  imageUrl: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 알림 유형별 아이콘 + 색상
function getNotificationIcon(type: string) {
  switch (type) {
    case 'application_approved':
    case 'mission_approved':
      return { icon: CheckCircle2, color: 'text-green-500' };
    case 'application_rejected':
    case 'mission_rejected':
      return { icon: XCircle, color: 'text-red-500' };
    case 'gift_received':
      return { icon: Gift, color: 'text-purple-500' };
    case 'system_notice':
    case 'grade_up':
    case 'admin_push':
      return { icon: Megaphone, color: 'text-blue-500' };
    default:
      return { icon: Bell, color: 'text-muted-foreground' };
  }
}

// 상대 시간 포맷
function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;

  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export default function NotificationsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);

  // 무한스크롤 쿼리
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<NotificationsResponse>({
    queryKey: ['/api/notifications'],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await fetch(`/api/notifications?page=${pageParam}&limit=20`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('알림 조회 실패');
      return res.json();
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage?.pagination) return undefined;
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
    retry: 1, // 1회만 재시도 (무한 로딩 방지)
  });

  // 단건 읽음 처리
  const readMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/notifications/read/${id}`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  // 전체 읽음 처리
  const readAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('/api/notifications/read-all', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
      toast({ title: '모든 알림을 읽음 처리했습니다.' });
    },
  });

  // 알림 클릭 핸들러 → 바텀 모달 열기
  const handleNotificationClick = (notification: NotificationItem) => {
    // 읽지 않은 알림이면 읽음 처리
    if (!notification.isRead) {
      readMutation.mutate(notification.id);
    }
    setSelectedNotification(notification);
  };

  // 링크 이동 핸들러
  const handleNavigate = (url: string) => {
    setSelectedNotification(null);
    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url, '_blank');
    } else {
      setLocation(url);
    }
  };

  // 전체 알림 목록 (모든 페이지 합산)
  const allNotifications = data?.pages.flatMap((page) => page.notifications) || [];
  const unreadCount = data?.pages[0]?.unreadCount || 0;

  // 로딩 상태 (최초 1회만)
  if (isLoading) {
    return (
      <div className="p-5 animate-fadeIn">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">알림을 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  // 에러 상태 — 무한 로딩 대신 빈 상태로 폴백
  if (isError) {
    return (
      <div className="p-5 animate-fadeIn">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg font-bold text-foreground">나의 알림</h1>
        </div>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">아직 알림이 없습니다.</p>
          <p className="text-xs text-muted-foreground mt-1">미션 참여 후 알림을 받아보세요!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 animate-fadeIn">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-foreground">
          나의 알림
          {unreadCount > 0 && (
            <span className="ml-2 text-sm font-medium text-purple-500">
              {unreadCount}개 안읽음
            </span>
          )}
        </h1>

        {/* 모두 읽음 버튼 */}
        {unreadCount > 0 && (
          <button
            onClick={() => readAllMutation.mutate()}
            disabled={readAllMutation.isPending}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            <span>모두 읽음</span>
          </button>
        )}
      </div>

      {/* 알림 목록 */}
      {allNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">아직 알림이 없습니다.</p>
          <p className="text-xs text-muted-foreground mt-1">미션 참여 후 알림을 받아보세요!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {allNotifications.map((notification) => {
            const { icon: IconComponent, color } = getNotificationIcon(notification.type);
            const isUnread = !notification.isRead;

            return (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  isUnread
                    ? 'bg-card border-border hover:bg-muted/50'
                    : 'bg-muted/30 border-transparent hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* 읽지않음 인디케이터 + 아이콘 */}
                  <div className="relative flex-shrink-0 mt-0.5">
                    <IconComponent className={`w-5 h-5 ${isUnread ? color : 'text-muted-foreground/50'}`} />
                    {isUnread && (
                      <span className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-purple-500 rounded-full border-2 border-card" />
                    )}
                  </div>

                  {/* 본문 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3
                        className={`text-sm font-medium truncate ${
                          isUnread ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {notification.title}
                      </h3>
                      <span className="text-[11px] text-muted-foreground flex-shrink-0">
                        {formatRelativeTime(notification.createdAt)}
                      </span>
                    </div>
                    <p
                      className={`text-xs mt-1 line-clamp-2 ${
                        isUnread ? 'text-muted-foreground' : 'text-muted-foreground/60'
                      }`}
                    >
                      {notification.message}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

          {/* 더 보기 / 무한 스크롤 */}
          {hasNextPage && (
            <div className="flex justify-center pt-3 pb-2">
              <Button
                onClick={() => fetchNextPage()}
                variant="outline"
                size="sm"
                disabled={isFetchingNextPage}
                className="rounded-xl"
              >
                {isFetchingNextPage ? '로딩 중...' : '이전 알림 더 보기'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 알림 상세 바텀 모달 */}
      <Drawer open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
        <DrawerContent className="max-h-[70vh]">
          {selectedNotification && (() => {
            const { icon: ModalIcon, color: modalColor } = getNotificationIcon(selectedNotification.type);
            return (
              <>
                <DrawerHeader className="text-left">
                  <div className="flex items-center gap-3 mb-1">
                    <div className={`p-2 rounded-full bg-muted`}>
                      <ModalIcon className={`w-5 h-5 ${modalColor}`} />
                    </div>
                    <div>
                      <DrawerTitle className="text-base">{selectedNotification.title}</DrawerTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(selectedNotification.createdAt).toLocaleString('ko-KR', {
                          year: 'numeric', month: 'long', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </DrawerHeader>
                <div className="px-4 pb-4">
                  <DrawerDescription className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {selectedNotification.message}
                  </DrawerDescription>

                  {/* 딥링크 버튼 */}
                  {selectedNotification.actionUrl && (
                    <button
                      onClick={() => handleNavigate(selectedNotification.actionUrl!)}
                      className="mt-4 w-full flex items-center justify-between p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {selectedNotification.actionUrl.startsWith('http') ? (
                          <ExternalLink className="w-4 h-4" />
                        ) : (
                          <ArrowRight className="w-4 h-4" />
                        )}
                        <span className="text-sm font-medium">바로가기</span>
                      </div>
                      <span className="text-xs text-purple-400/70 truncate max-w-[200px]">
                        {selectedNotification.actionUrl}
                      </span>
                    </button>
                  )}
                </div>
                <DrawerFooter className="pt-0">
                  <DrawerClose asChild>
                    <Button variant="outline" className="w-full rounded-xl">
                      닫기
                    </Button>
                  </DrawerClose>
                </DrawerFooter>
              </>
            );
          })()}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
