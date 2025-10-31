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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<SnapshotPrompt | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

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
    queryKey: [
      '/api/admin/snapshot-prompts',
      { category: categoryFilter !== 'all' ? categoryFilter : undefined, page: currentPage, limit: 200 }
    ],
  });

  const prompts = promptsResponse?.prompts || [];
  const pagination = promptsResponse?.pagination;

  // Create form
  const createForm = useForm<SnapshotPromptFormData>({
    resolver: zodResolver(snapshotPromptSchema),
    defaultValues: {
      category: 'individual',
      type: 'daily',
      gender: 'all',
      region: 'all',
      season: 'all',
      prompt: '',
      isActive: true,
    },
  });

  // Edit form
  const editForm = useForm<SnapshotPromptFormData>({
    resolver: zodResolver(snapshotPromptSchema),
  });

  // Create mutation
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
      setIsCreateDialogOpen(false);
      createForm.reset();
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
      setIsEditDialogOpen(false);
      setSelectedPrompt(null);
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

  // Handle edit
  const handleEdit = (prompt: SnapshotPrompt) => {
    setSelectedPrompt(prompt);
    editForm.reset({
      category: prompt.category as any,
      type: prompt.type as any,
      gender: (prompt.gender || 'all') as any,
      region: (prompt.region || 'all') as any,
      season: (prompt.season || 'all') as any,
      prompt: prompt.prompt,
      isActive: prompt.isActive,
    });
    setIsEditDialogOpen(true);
  };

  // Handle create submit
  const onCreateSubmit = (data: SnapshotPromptFormData) => {
    createMutation.mutate(data);
  };

  // Handle edit submit
  const onEditSubmit = (data: SnapshotPromptFormData) => {
    if (!selectedPrompt) return;
    updateMutation.mutate({ ...data, id: selectedPrompt.id });
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
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              프롬프트 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>새 프롬프트 추가</DialogTitle>
              <DialogDescription>
                스냅샷 생성에 사용될 새 프롬프트를 추가합니다
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>카테고리 *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="선택하세요" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="individual">Individual (개인)</SelectItem>
                            <SelectItem value="couple">Couple (커플)</SelectItem>
                            <SelectItem value="family">Family (가족)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>스타일 *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="선택하세요" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="daily">Daily (일상)</SelectItem>
                            <SelectItem value="travel">Travel (여행)</SelectItem>
                            <SelectItem value="film">Film (필름)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs text-muted-foreground">
                          Mix는 사용자 UI에서만 선택 가능합니다
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>성별 (선택)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="모두" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="all">모두</SelectItem>
                            <SelectItem value="male">Male (남성)</SelectItem>
                            <SelectItem value="female">Female (여성)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>지역 (선택)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="모두" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="all">모두</SelectItem>
                            <SelectItem value="domestic">Domestic (국내)</SelectItem>
                            <SelectItem value="international">International (해외)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="season"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>계절 (선택)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="모두" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="all">모두</SelectItem>
                            <SelectItem value="spring">Spring (봄)</SelectItem>
                            <SelectItem value="summer">Summer (여름)</SelectItem>
                            <SelectItem value="fall">Fall (가을)</SelectItem>
                            <SelectItem value="winter">Winter (겨울)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={createForm.control}
                  name="prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>프롬프트 *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="AI 이미지 생성에 사용될 프롬프트를 입력하세요..."
                          className="min-h-[150px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        최소 10자 이상 입력해주세요
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">활성화</FormLabel>
                        <FormDescription>
                          비활성화하면 프롬프트 선택에서 제외됩니다
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    취소
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    추가
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
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

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>프롬프트 수정</DialogTitle>
            <DialogDescription>
              프롬프트 정보를 수정합니다 (ID: {selectedPrompt?.id})
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>카테고리 *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="individual">Individual (개인)</SelectItem>
                          <SelectItem value="couple">Couple (커플)</SelectItem>
                          <SelectItem value="family">Family (가족)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>스타일 *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Daily (일상)</SelectItem>
                          <SelectItem value="travel">Travel (여행)</SelectItem>
                          <SelectItem value="film">Film (필름)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs text-muted-foreground">
                        Mix는 사용자 UI에서만 선택 가능합니다
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>성별 (선택)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">모두</SelectItem>
                          <SelectItem value="male">Male (남성)</SelectItem>
                          <SelectItem value="female">Female (여성)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>지역 (선택)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">모두</SelectItem>
                          <SelectItem value="domestic">Domestic (국내)</SelectItem>
                          <SelectItem value="international">International (해외)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="season"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>계절 (선택)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">모두</SelectItem>
                          <SelectItem value="spring">Spring (봄)</SelectItem>
                          <SelectItem value="summer">Summer (여름)</SelectItem>
                          <SelectItem value="fall">Fall (가을)</SelectItem>
                          <SelectItem value="winter">Winter (겨울)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>프롬프트 *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="AI 이미지 생성에 사용될 프롬프트를 입력하세요..."
                        className="min-h-[150px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">활성화</FormLabel>
                      <FormDescription>
                        비활성화하면 프롬프트 선택에서 제외됩니다
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  취소
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  수정
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
