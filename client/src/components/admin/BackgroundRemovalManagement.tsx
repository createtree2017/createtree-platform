import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Eraser } from "lucide-react";
import { BG_REMOVAL_QUALITY, BG_REMOVAL_MODEL } from "@shared/schema";

interface SystemSettingsAdmin {
  id: number;
  bgRemovalQuality?: string;
  bgRemovalModel?: string;
  updatedAt: string;
}

interface BgRemovalSettings {
  bgRemovalQuality: typeof BG_REMOVAL_QUALITY[number];
  bgRemovalModel: typeof BG_REMOVAL_MODEL[number];
}

export default function BackgroundRemovalManagement() {
  const [localSettings, setLocalSettings] = useState<BgRemovalSettings | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { 
    data: systemSettings, 
    isLoading: isLoadingSettings
  } = useQuery<SystemSettingsAdmin>({
    queryKey: ['/api/admin/system-settings'],
    queryFn: async () => {
      const response = await fetch('/api/admin/system-settings');
      const data = await response.json();
      return data;
    },
    staleTime: 30 * 1000,
    retry: 3
  });

  useEffect(() => {
    if (systemSettings && !localSettings) {
      setLocalSettings({
        bgRemovalQuality: (systemSettings.bgRemovalQuality ?? "1.0") as typeof BG_REMOVAL_QUALITY[number],
        bgRemovalModel: (systemSettings.bgRemovalModel ?? "medium") as typeof BG_REMOVAL_MODEL[number]
      });
    }
  }, [systemSettings, localSettings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: BgRemovalSettings) => {
      return apiRequest('/api/admin/system-settings', { 
        method: 'PUT', 
        data: updates 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system-settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings'] });
      
      setHasUnsavedChanges(false);
      toast({
        title: "배경제거 설정 저장 완료",
        description: "설정이 성공적으로 저장되었습니다.",
      });
    },
    onError: (error: any) => {
      console.error("배경제거 설정 저장 오류:", error);
      toast({
        title: "설정 저장 실패",
        description: error?.message || "설정을 저장하는 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  });

  const handleQualityChange = (value: typeof BG_REMOVAL_QUALITY[number]) => {
    if (!localSettings) return;
    setLocalSettings({ ...localSettings, bgRemovalQuality: value });
    setHasUnsavedChanges(true);
  };

  const handleModelChange = (value: typeof BG_REMOVAL_MODEL[number]) => {
    if (!localSettings) return;
    setLocalSettings({ ...localSettings, bgRemovalModel: value });
    setHasUnsavedChanges(true);
  };

  const handleSaveChanges = () => {
    if (!localSettings) return;
    updateSettingsMutation.mutate(localSettings);
  };

  if (isLoadingSettings) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">설정을 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Eraser className="h-6 w-6" />
            배경제거 설정
          </h2>
          <p className="text-muted-foreground mt-1">
            이미지 배경제거 처리에 사용되는 전역 설정입니다.
            컨셉별 배경제거 사용 여부는 이미지 컨셉 관리에서 설정합니다.
          </p>
        </div>
        <Button 
          onClick={handleSaveChanges} 
          disabled={!hasUnsavedChanges || updateSettingsMutation.isPending}
        >
          {updateSettingsMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              저장 중...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              변경사항 저장
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>처리 옵션</CardTitle>
          <CardDescription>
            배경제거 AI의 품질과 모델을 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-base font-medium">출력 품질</Label>
              <p className="text-sm text-muted-foreground mb-3">
                배경제거 결과 이미지의 품질을 설정합니다.
              </p>
              
              <Select 
                value={localSettings?.bgRemovalQuality ?? "1.0"} 
                onValueChange={(value) => handleQualityChange(value as typeof BG_REMOVAL_QUALITY[number])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="품질 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">낮음 (0.5) - 빠른 처리</SelectItem>
                  <SelectItem value="0.8">중간 (0.8) - 균형</SelectItem>
                  <SelectItem value="1.0">최고 (1.0) - 최상 품질</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-base font-medium">AI 모델</Label>
              <p className="text-sm text-muted-foreground mb-3">
                배경제거에 사용할 AI 모델 크기입니다.
              </p>
              
              <Select 
                value={localSettings?.bgRemovalModel ?? "medium"} 
                onValueChange={(value) => handleModelChange(value as typeof BG_REMOVAL_MODEL[number])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="모델 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small - 빠르지만 낮은 정확도</SelectItem>
                  <SelectItem value="medium">Medium - 권장 (높은 정확도)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium mb-3">현재 배경제거 설정</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">포맷:</span>
                <div className="mt-1">
                  <Badge variant="secondary">PNG (투명 배경)</Badge>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">품질:</span>
                <div className="mt-1">
                  <Badge variant="outline">
                    {localSettings?.bgRemovalQuality === "1.0" ? "최고 (1.0)" : 
                     localSettings?.bgRemovalQuality === "0.8" ? "중간 (0.8)" : "낮음 (0.5)"}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">모델:</span>
                <div className="mt-1">
                  <Badge variant="outline">
                    {localSettings?.bgRemovalModel === "medium" ? "Medium (권장)" : "Small"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
