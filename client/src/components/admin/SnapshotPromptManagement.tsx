import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useModal } from '@/hooks/useModal';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { PlusCircle, Edit, Trash2, Loader2 } from 'lucide-react';

// Validation schema
const snapshotPromptSchema = z.object({
  category: z.enum(['individual', 'couple', 'family'], {
    required_error: 'Category is required',
  }),
  type: z.enum(['daily', 'travel', 'film'], {
    required_error: 'Type is required',
  }),
  gender: z.enum(['male', 'female', 'all']).optional(),
  region: z.enum(['domestic', 'international', 'all']).optional(),
  season: z.enum(['spring', 'summer', 'fall', 'winter', 'all']).optional(),
  prompt: z.string().min(10, 'Prompt must be at least 10 characters'),
  isActive: z.boolean().default(true),
});

type SnapshotPromptFormData = z.infer<typeof snapshotPromptSchema>;

interface SnapshotPrompt {
  id: number;
  category: string;
  type: string;
  gender?: string | null;
  region?: string | null;
  season?: string | null;
  prompt: string;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function SnapshotPromptManagement() {
  const queryClient = useQueryClient();
  const modal = useModal();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Build query string for API call
  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (categoryFilter !== 'all') {
      params.append('category', categoryFilter);
    }
    params.append('page', currentPage.toString());
    params.append('limit', '200');
    return params.toString();
  };

  // Fetch prompts with filters and pagination
  const { data: promptsResponse, isLoading } = useQuery<{
    success: boolean;
    prompts: SnapshotPrompt[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  }>({
    queryKey: ['/api/admin/snapshot-prompts', categoryFilter, currentPage],
    queryFn: async () => {
      const queryString = buildQueryString();
      const response = await fetch(`/api/admin/snapshot-prompts?${queryString}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch prompts');
      }
      return response.json();
    },
  });

  const prompts = promptsResponse?.prompts || [];
  const pagination = promptsResponse?.pagination;

  const createMutation = useMutation({
    mutationFn: async (data: SnapshotPromptFormData) => {
      // Clean up "all" values to null
      const cleanData = {
        ...data,
        gender: data.gender === 'all' ? null : data.gender,
        region: data.region === 'all' ? null : data.region,
        season: data.season === 'all' ? null : data.season,
      };

      return apiRequest('/api/admin/snapshot-prompts', {
        method: 'POST',
        body: JSON.stringify(cleanData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/snapshot-prompts'] });
      toast({
        title: '성공',
        description: '프롬프트가 추가되었습니다.',
      });
    },
    onError: (error: any) => {
      toast({
        title: '오류',
        description: error.message || '프롬프트 추가에 실패했습니다.',
        variant: 'destructive',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: SnapshotPromptFormData & { id: number }) => {
      const cleanData = {
        ...data,
        gender: data.gender === 'all' ? null : data.gender,
        region: data.region === 'all' ? null : data.region,
        season: data.season === 'all' ? null : data.season,
      };

      return apiRequest(`/api/admin/snapshot-prompts/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(cleanData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/snapshot-prompts'] });
      toast({
        title: '성공',
        description: '프롬프트가 수정되었습니다.',
      });
    },
    onError: (error: any) => {
      toast({
        title: '오류',
        description: error.message || '프롬프트 수정에 실패했습니다.',
        variant: 'destructive',
      });
    },
  });

  // Handle create
  const handleCreate = () => {
    modal.open('snapshotPrompt', {
      prompt: null,
      onSave: (data: any) => {
        createMutation.mutate(data);
      },
      isPending: createMutation.isPending
    });
  };

  // Handle edit
  const handleEdit = (prompt: SnapshotPrompt) => {
    modal.open('snapshotPrompt', {
      prompt,
      onSave: (data: any) => {
        updateMutation.mutate({ ...data, id: prompt.id });
      },
      isPending: updateMutation.isPending
    });
  };

  // Handle category filter change
  const handleCategoryChange = (category: string) => {
    setCategoryFilter(category);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">스냅샷 프롬프트 관리</h3>
          <p className="text-sm text-muted-foreground">
            AI 스냅샷 생성에 사용되는 프롬프트를 관리합니다. 총 {pagination?.total || 0}개
          </p>
        </div>

        <Button onClick={handleCreate}>
          <PlusCircle className="w-4 h-4 mr-2" />
          프롬프트 추가
        </Button>
      </div>

      {/* Category Filter Buttons */}
      <div className="flex gap-2">
        <Button
          variant={categoryFilter === 'all' ? 'default' : 'outline'}
          onClick={() => handleCategoryChange('all')}
          size="sm"
        >
          전체 {pagination && `(${pagination.total})`}
        </Button>
        <Button
          variant={categoryFilter === 'individual' ? 'default' : 'outline'}
          onClick={() => handleCategoryChange('individual')}
          size="sm"
        >
          개인
        </Button>
        <Button
          variant={categoryFilter === 'couple' ? 'default' : 'outline'}
          onClick={() => handleCategoryChange('couple')}
          size="sm"
        >
          커플
        </Button>
        <Button
          variant={categoryFilter === 'family' ? 'default' : 'outline'}
          onClick={() => handleCategoryChange('family')}
          size="sm"
        >
          가족
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">ID</TableHead>
              <TableHead>카테고리</TableHead>
              <TableHead>스타일</TableHead>
              <TableHead>필터</TableHead>
              <TableHead>프롬프트</TableHead>
              <TableHead className="w-[100px]">사용 횟수</TableHead>
              <TableHead className="w-[80px]">상태</TableHead>
              <TableHead className="w-[120px]">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prompts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  프롬프트가 없습니다
                </TableCell>
              </TableRow>
            ) : (
              prompts?.map((prompt) => (
                <TableRow key={prompt.id}>
                  <TableCell className="font-medium">{prompt.id}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {prompt.category === 'individual' ? '개인' :
                        prompt.category === 'couple' ? '커플' : '가족'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {prompt.type === 'mix' ? '믹스' :
                        prompt.type === 'daily' ? '일상' :
                          prompt.type === 'travel' ? '여행' : '필름'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {prompt.gender && (
                        <Badge variant="outline" className="text-xs">
                          {prompt.gender === 'male' ? '남성' : '여성'}
                        </Badge>
                      )}
                      {prompt.region && (
                        <Badge variant="outline" className="text-xs">
                          {prompt.region === 'domestic' ? '국내' : '해외'}
                        </Badge>
                      )}
                      {prompt.season && (
                        <Badge variant="outline" className="text-xs">
                          {prompt.season === 'spring' ? '봄' :
                            prompt.season === 'summer' ? '여름' :
                              prompt.season === 'fall' ? '가을' : '겨울'}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {prompt.prompt}
                  </TableCell>
                  <TableCell className="text-center">{prompt.usageCount}</TableCell>
                  <TableCell>
                    <Badge variant={prompt.isActive ? 'default' : 'secondary'}>
                      {prompt.isActive ? '활성' : '비활성'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(prompt)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            이전
          </Button>

          {/* Page Numbers */}
          <div className="flex gap-1">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(pageNum => (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentPage(pageNum)}
                className="min-w-[40px]"
              >
                {pageNum}
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
            disabled={currentPage === pagination.totalPages}
          >
            다음
          </Button>
        </div>
      )}

      {/* Edit Dialog - Now managed by global ModalContext */}
    </div>
  );
}
