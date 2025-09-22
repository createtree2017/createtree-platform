import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// UI 컴포넌트
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { PlusCircle, Book, Loader2, AlertCircle, Trash2, CheckSquare, X } from 'lucide-react';
import { useAuthContext } from '@/lib/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export default function DreamBookList() {
  const [, navigate] = useLocation();
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // 선택 모드와 선택된 항목들 상태
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  // 태몽동화 목록 조회
  const { 
    data: dreamBooks, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['/api/dream-books'],
    queryFn: async () => {
      const response = await fetch('/api/dream-books');
      if (!response.ok) {
        throw new Error('태몽동화 목록을 불러오는데 실패했습니다');
      }
      return response.json();
    },
    enabled: !!user,
  });

  // 태몽동화 삭제 뮤테이션
  const deleteDreamBookMutation = useMutation({
    mutationFn: async (dreamBookId: number) => {
      return await apiRequest(`/api/dream-books/${dreamBookId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      // 캐시 무효화하여 목록 새로고침
      queryClient.invalidateQueries({ queryKey: ['/api/dream-books'] });
      toast({
        title: '삭제 완료',
        description: '태몽동화가 성공적으로 삭제되었습니다.',
      });
    },
    onError: (error) => {
      console.error('태몽동화 삭제 오류:', error);
      toast({
        title: '삭제 실패',
        description: '태몽동화 삭제 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    }
  });

  // 대량 삭제 뮤테이션
  const bulkDeleteDreamBookMutation = useMutation({
    mutationFn: async (dreamBookIds: number[]) => {
      // 병렬로 모든 삭제 요청 실행
      const deletePromises = dreamBookIds.map(id => 
        apiRequest(`/api/dream-books/${id}`, { method: 'DELETE' })
      );
      return await Promise.all(deletePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dream-books'] });
      setSelectedIds([]);
      setIsSelectionMode(false);
      toast({
        title: '삭제 완료',
        description: `${selectedIds.length}개의 태몽동화가 성공적으로 삭제되었습니다.`,
      });
    },
    onError: (error) => {
      console.error('대량 삭제 오류:', error);
      toast({
        title: '삭제 실패',
        description: '일부 태몽동화 삭제 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    }
  });

  // 개별 삭제 핸들러
  const handleDelete = (e: React.MouseEvent, dreamBookId: number) => {
    e.stopPropagation();
    
    if (window.confirm('정말로 이 태몽동화를 삭제하시겠습니까?\n삭제된 태몽동화는 복구할 수 없습니다.')) {
      deleteDreamBookMutation.mutate(dreamBookId);
    }
  };

  // 선택 모드 토글
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds([]);
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedIds.length === dreamBooks?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(dreamBooks?.map((book: any) => book.id) || []);
    }
  };

  // 개별 항목 선택/해제
  const toggleSelectItem = (id: number) => {
    console.log('toggleSelectItem 호출됨, id:', id);
    console.log('현재 selectedIds:', selectedIds);
    
    setSelectedIds(prev => {
      const newIds = prev.includes(id) 
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id];
      console.log('새로운 selectedIds:', newIds);
      return newIds;
    });
  };

  // 선택된 항목들 삭제
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    
    if (window.confirm(`정말로 선택된 ${selectedIds.length}개의 태몽동화를 삭제하시겠습니까?\n삭제된 태몽동화는 복구할 수 없습니다.`)) {
      bulkDeleteDreamBookMutation.mutate(selectedIds);
    }
  };

  // 로그인 확인
  if (!user) {
    return (
      <div className="container mx-auto py-10 px-4">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-2xl font-bold mb-4">로그인이 필요합니다</h2>
            <p className="text-gray-500 mb-6">태몽동화 목록을 보기 위해서는 로그인이 필요합니다.</p>
            <Button onClick={() => navigate('/auth')}>로그인 페이지로 이동</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="container mx-auto py-10 px-4 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p>태몽동화 목록을 불러오는 중...</p>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="container mx-auto py-10 px-4">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-2xl font-bold mb-4">오류가 발생했습니다</h2>
            <p className="text-gray-500 mb-6">
              태몽동화 목록을 불러오는 중 오류가 발생했습니다.
            </p>
            <Button onClick={() => navigate('/')}>홈으로 돌아가기</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 데이터가 없는 경우
  if (!dreamBooks || dreamBooks.length === 0) {
    return (
      <div className="container mx-auto py-10 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">내 태몽동화</h1>
            <p className="text-gray-500 mt-2">태몽으로 만든 특별한 아기 이야기</p>
          </div>
          <Button onClick={() => navigate('/dream-book/create')}>
            <PlusCircle className="h-5 w-5 mr-2" />
            새 태몽동화 만들기
          </Button>
        </div>
        
        <Card className="text-center p-8">
          <CardContent className="pt-6 pb-8 flex flex-col items-center">
            <Book className="h-16 w-16 text-gray-300 mb-4" />
            <h2 className="text-xl font-medium mb-2">아직 생성한 태몽동화가 없습니다</h2>
            <p className="text-gray-500">
              새로운 태몽동화를 만들어 특별한 이야기를 시작해보세요.
            </p>
          </CardContent>
          <CardFooter className="justify-center pt-0">
            <Button onClick={() => navigate('/dream-book/create')}>
              태몽동화 만들기
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">내 태몽동화</h1>
          <p className="text-gray-500 mt-2">태몽으로 만든 특별한 아기 이야기</p>
        </div>
        <div className="flex gap-3">
          {/* 선택 모드가 아닐 때만 보이는 버튼들 */}
          {!isSelectionMode && (
            <>
              <Button variant="outline" onClick={toggleSelectionMode}>
                <CheckSquare className="h-4 w-4 mr-2" />
                선택 삭제
              </Button>
              <Button onClick={() => navigate('/dream-book/create')}>
                <PlusCircle className="h-5 w-5 mr-2" />
                새 태몽동화 만들기
              </Button>
            </>
          )}
          
          {/* 선택 모드일 때 보이는 컨트롤들 */}
          {isSelectionMode && (
            <>
              <Button variant="outline" onClick={toggleSelectAll}>
                {selectedIds.length === dreamBooks?.length ? '전체 해제' : '전체 선택'}
              </Button>
              {selectedIds.length > 0 && (
                <Button 
                  variant="destructive" 
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteDreamBookMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  선택된 {selectedIds.length}개 삭제
                </Button>
              )}
              <Button variant="ghost" onClick={toggleSelectionMode}>
                <X className="h-4 w-4 mr-2" />
                취소
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dreamBooks.map((dreamBook: any) => (
          <Card 
            key={dreamBook.id} 
            className={`overflow-hidden transition-shadow relative ${
              isSelectionMode 
                ? 'cursor-default border-2' + (selectedIds.includes(dreamBook.id) ? ' border-blue-500 bg-blue-50' : ' border-gray-200')
                : 'cursor-pointer hover:shadow-md'
            }`}
            onClick={() => {
              if (isSelectionMode) {
                toggleSelectItem(dreamBook.id);
              } else {
                navigate(`/dream-book/${dreamBook.id}`);
              }
            }}
          >
            <div className="aspect-[4/3] relative">
              <img
                src={(() => {
                  const imageUrl = dreamBook.coverImage || 
                    (dreamBook.images && dreamBook.images[0] && dreamBook.images[0].imageUrl);
                  const isValidImage = imageUrl?.startsWith('/static/uploads/dream-books/');
                  return isValidImage ? imageUrl : '/static/uploads/dream-books/error.png';
                })()}
                alt={`${dreamBook.babyName}의 태몽동화`}
                className="object-cover w-full h-full"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/static/uploads/dream-books/error.png';
                }}
              />
              
              {/* 선택 모드일 때 체크박스 */}
              {isSelectionMode && (
                <div 
                  className="absolute top-2 left-2 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Checkbox
                    checked={selectedIds.includes(dreamBook.id)}
                    onCheckedChange={() => {
                      toggleSelectItem(dreamBook.id);
                    }}
                    className="h-5 w-5 bg-white shadow-md"
                  />
                </div>
              )}
              
              {/* 개별 삭제 버튼 (선택 모드가 아닐 때만) */}
              {!isSelectionMode && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2 h-8 w-8 p-0 rounded-full shadow-lg opacity-80 hover:opacity-100"
                  onClick={(e) => handleDelete(e, dreamBook.id)}
                  disabled={deleteDreamBookMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold truncate mb-1">
                {dreamBook.babyName}의 태몽동화
              </h3>
              <p className="text-gray-500 text-sm mb-2 truncate">
                {dreamBook.dreamer}님의 꿈
              </p>
              {dreamBook.createdAt && (
                <p className="text-xs text-gray-400">
                  {format(
                    new Date(dreamBook.createdAt), 
                    'yyyy년 M월 d일 HH:mm', 
                    { locale: ko }
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}