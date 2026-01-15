import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, RefreshCw, Settings2, ZoomIn, Image } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface CategoryUpscaleConfig {
  id: number;
  slug: string;
  name: string;
  isActive: boolean;
  upscaleEnabled: boolean;
  upscaleMaxFactor: 'x2' | 'x3' | 'x4';
  upscaleTargetDpi: number;
  upscaleMode: 'auto' | 'fixed';
}

interface UpscaleStatusResponse {
  success: boolean;
  data: {
    available: boolean;
    supportedFactors: string[];
    projectId: string | null;
    region: string;
    notes: string;
  };
}

export default function UpscaleSettingsManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editedConfigs, setEditedConfigs] = useState<Record<number, Partial<CategoryUpscaleConfig>>>({});
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());

  const { data: statusData, isLoading: statusLoading } = useQuery<UpscaleStatusResponse>({
    queryKey: ['/api/upscale/status'],
  });

  const { data: categoriesData, isLoading: categoriesLoading, refetch } = useQuery<{
    success: boolean;
    data: CategoryUpscaleConfig[];
  }>({
    queryKey: ['/api/upscale/admin/categories'],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ categoryId, settings }: { categoryId: number; settings: Partial<CategoryUpscaleConfig> }) => {
      return apiRequest(`/api/upscale/admin/categories/${categoryId}`, {
        method: 'PATCH',
        body: JSON.stringify(settings),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/upscale/admin/categories'] });
      setEditedConfigs(prev => {
        const next = { ...prev };
        delete next[variables.categoryId];
        return next;
      });
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(variables.categoryId);
        return next;
      });
      toast({
        title: '설정 저장 완료',
        description: '업스케일 설정이 저장되었습니다.',
      });
    },
    onError: (error: any, variables) => {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(variables.categoryId);
        return next;
      });
      toast({
        title: '저장 실패',
        description: error.message || '설정 저장 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    },
  });

  const handleChange = (categoryId: number, field: keyof CategoryUpscaleConfig, value: any) => {
    setEditedConfigs(prev => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [field]: value,
      },
    }));
  };

  const handleSave = (categoryId: number) => {
    const edits = editedConfigs[categoryId];
    if (!edits) return;
    
    setSavingIds(prev => new Set(prev).add(categoryId));
    updateMutation.mutate({ categoryId, settings: edits });
  };

  const getConfigValue = (category: CategoryUpscaleConfig, field: keyof CategoryUpscaleConfig) => {
    const edits = editedConfigs[category.id];
    if (edits && field in edits) {
      return edits[field as keyof typeof edits];
    }
    return category[field];
  };

  const hasChanges = (categoryId: number) => {
    return editedConfigs[categoryId] && Object.keys(editedConfigs[categoryId]).length > 0;
  };

  if (statusLoading || categoriesLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>로딩 중...</span>
      </div>
    );
  }

  const categories = categoriesData?.data || [];
  const upscaleStatus = statusData?.data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ZoomIn className="w-5 h-5" />
            AI 업스케일 서비스 상태
          </CardTitle>
          <CardDescription>
            Google Vertex AI Imagen API를 사용한 이미지 업스케일링 서비스 상태입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant={upscaleStatus?.available ? 'default' : 'destructive'}>
              {upscaleStatus?.available ? '서비스 활성화' : '서비스 비활성화'}
            </Badge>
            {upscaleStatus?.available && (
              <>
                <span className="text-sm text-muted-foreground">
                  지원 배율: {upscaleStatus.supportedFactors?.join(', ')}
                </span>
                <span className="text-sm text-muted-foreground">
                  리전: {upscaleStatus.region}
                </span>
              </>
            )}
            {!upscaleStatus?.available && (
              <span className="text-sm text-muted-foreground">
                {upscaleStatus?.notes || 'GOOGLE_UPSCALE_JSON_KEY 시크릿이 설정되지 않았습니다.'}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              제품 카테고리별 업스케일 설정
            </CardTitle>
            <CardDescription>
              각 제품 카테고리에 대한 업스케일 설정을 관리합니다.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categories.map((category) => (
              <div 
                key={category.id} 
                className="border rounded-lg p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Image className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <h4 className="font-medium">{category.name}</h4>
                      <p className="text-sm text-muted-foreground">{category.slug}</p>
                    </div>
                    {!category.isActive && (
                      <Badge variant="secondary">비활성화</Badge>
                    )}
                  </div>
                  {hasChanges(category.id) && (
                    <Button 
                      size="sm" 
                      onClick={() => handleSave(category.id)}
                      disabled={savingIds.has(category.id)}
                    >
                      {savingIds.has(category.id) ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      저장
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`upscale-enabled-${category.id}`}
                      checked={getConfigValue(category, 'upscaleEnabled') as boolean}
                      onCheckedChange={(checked) => handleChange(category.id, 'upscaleEnabled', checked)}
                    />
                    <Label htmlFor={`upscale-enabled-${category.id}`}>
                      업스케일 활성화
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <Label>최대 배율</Label>
                    <Select
                      value={getConfigValue(category, 'upscaleMaxFactor') as string}
                      onValueChange={(value) => handleChange(category.id, 'upscaleMaxFactor', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="배율 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="x2">x2 (2배)</SelectItem>
                        <SelectItem value="x3">x3 (3배)</SelectItem>
                        <SelectItem value="x4">x4 (4배)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>목표 DPI</Label>
                    <Input
                      type="number"
                      min={72}
                      max={600}
                      value={getConfigValue(category, 'upscaleTargetDpi') as number}
                      onChange={(e) => handleChange(category.id, 'upscaleTargetDpi', parseInt(e.target.value) || 300)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>업스케일 모드</Label>
                    <Select
                      value={getConfigValue(category, 'upscaleMode') as string}
                      onValueChange={(value) => handleChange(category.id, 'upscaleMode', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="모드 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">자동 (필요시만)</SelectItem>
                        <SelectItem value="fixed">고정 (항상 최대)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                  <strong>현재 설정:</strong> 
                  {getConfigValue(category, 'upscaleEnabled') 
                    ? ` ${getConfigValue(category, 'upscaleMode') === 'auto' ? '자동 모드' : '고정 모드'}로 
                       최대 ${getConfigValue(category, 'upscaleMaxFactor')} 배율, 
                       목표 ${getConfigValue(category, 'upscaleTargetDpi')} DPI`
                    : ' 업스케일 비활성화됨'
                  }
                </div>
              </div>
            ))}

            {categories.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                등록된 제품 카테고리가 없습니다.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
