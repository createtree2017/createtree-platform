import { useInfiniteQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Calendar, Download, Eye } from 'lucide-react';
import { useModalContext } from '@/contexts/ModalContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import {
  MODE_OPTIONS,
  STYLE_OPTIONS,
  type SnapshotMode,
  type SnapshotStyle
} from '@/constants/snapshot';

interface GeneratedImage {
  id: number;
  url: string;
  thumbnailUrl: string;
  promptId: number;
  createdAt: string;
}

interface Generation {
  timestamp: number;
  mode: SnapshotMode;
  style: SnapshotStyle;
  createdAt: string;
  images: GeneratedImage[];
}

interface HistoryResponse {
  success: boolean;
  generations: Generation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export default function SnapshotHistoryPage() {
  const modal = useModalContext();
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery<HistoryResponse>({
    queryKey: ['/api/snapshot/history'],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await fetch(`/api/snapshot/history?page=${pageParam}&limit=20`);
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    },
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasMore
        ? lastPage.pagination.page + 1
        : undefined;
    },
    initialPageParam: 1
  });

  // Flatten all generations from all pages
  const allGenerations = data?.pages.flatMap(page => page.generations) || [];

  // Get mode label
  const getModeLabel = (mode: SnapshotMode) => {
    return MODE_OPTIONS.find(opt => opt.value === mode)?.label || mode;
  };

  // Get style label
  const getStyleLabel = (style: SnapshotStyle) => {
    return STYLE_OPTIONS.find(opt => opt.value === style)?.label || style;
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-6">
        <div className="w-full">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">로딩 중...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="w-full space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              스냅샷 이력
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              지금까지 생성한 AI 스냅샷을 확인하세요
            </p>
          </div>
          <Button
            onClick={() => window.location.href = '/snapshot'}
            className="bg-purple-600 hover:bg-purple-700"
          >
            새로 생성하기
          </Button>
        </div>

        {/* History Grid */}
        {allGenerations.length > 0 ? (
          <div className="space-y-8">
            {allGenerations.map((generation, idx) => (
              <Card key={idx}>
                <CardContent className="p-6 space-y-4">
                  {/* Generation Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Calendar className="w-5 h-5 text-purple-600" />
                      <div>
                        <h3 className="font-semibold text-lg">
                          {getModeLabel(generation.mode)} - {getStyleLabel(generation.style)}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(generation.createdAt)}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => modal.openModal('snapshotGeneration', { generation })}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      전체보기
                    </Button>
                  </div>

                  {/* Image Grid */}
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {generation.images.map((image) => (
                      <div
                        key={image.id}
                        className="relative group cursor-pointer"
                        onClick={() => modal.openModal('imageViewer', {
                          imageUrl: image.url,
                          alt: `Generated snapshot ${image.id}`
                        })}
                      >
                        <div className="relative w-full h-32 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                          <img
                            src={image.thumbnailUrl || image.url}
                            alt="Generated snapshot"
                            className="w-full h-full object-cover shadow-md hover:shadow-xl transition-shadow"
                            loading="lazy"
                            onLoad={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.parentElement?.classList.remove('bg-gray-200', 'dark:bg-gray-700');
                            }}
                            onError={(e) => {
                              console.error('이미지 로드 실패:', {
                                id: image.id,
                                thumbnailUrl: image.thumbnailUrl,
                                url: image.url
                              });
                              const target = e.target as HTMLImageElement;
                              if (image.url && target.src !== image.url) {
                                console.log('썸네일 실패, 원본 이미지로 전환');
                                target.src = image.url;
                              } else {
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent && !parent.querySelector('.error-msg')) {
                                  const errorDiv = document.createElement('div');
                                  errorDiv.className = 'error-msg absolute inset-0 flex items-center justify-center text-xs text-gray-500';
                                  errorDiv.textContent = '이미지 로드 실패';
                                  parent.appendChild(errorDiv);
                                }
                              }
                            }}
                          />
                        </div>
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center">
                          <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="space-y-4">
                <div className="w-24 h-24 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto">
                  <Calendar className="w-12 h-12 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
                  아직 생성한 스냅샷이 없습니다
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  첫 번째 AI 스냅샷을 생성해보세요!
                </p>
                <Button
                  onClick={() => window.location.href = '/snapshot'}
                  className="bg-purple-600 hover:bg-purple-700 mt-4"
                >
                  스냅샷 생성하기
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {hasNextPage && (
          <div className="flex justify-center">
            <Button
              onClick={() => fetchNextPage()}
              variant="outline"
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? '로딩 중...' : '더 보기'}
            </Button>
          </div>
        )}
      </div>


    </div>
  );
}
