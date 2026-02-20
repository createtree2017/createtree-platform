import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, RefreshCw, Settings, CheckCircle, AlertCircle, Info, Cpu, Zap, Activity, Server } from "lucide-react";
import { AI_MODELS, type AiModel, type SystemSettingsUpdate } from "@shared/schema";

// Type definitions for API responses
interface SystemSettingsAdmin {
  id: number;
  defaultAiModel: AiModel;
  supportedAiModels: AiModel[];
  clientDefaultModel: AiModel;
  milestoneEnabled?: boolean;
  bgRemovalQuality?: string;
  bgRemovalModel?: string;
  updatedAt: string;
}

interface SystemSettingsHealthStatus {
  isInitialized: boolean;
  cacheStatus: 'hit' | 'miss' | 'expired';
  settings?: SystemSettingsAdmin;
}

interface SystemSettingsHealthResponse {
  success: boolean;
  health: SystemSettingsHealthStatus;
}

export default function SystemSettings() {
  const [localSettings, setLocalSettings] = useState<SystemSettingsUpdate | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for system settings (admin endpoint with full data)
  const {
    data: systemSettings,
    isLoading: isLoadingSettings,
    error: settingsError,
    refetch: refetchSettings
  } = useQuery<SystemSettingsAdmin>({
    queryKey: ['/api/admin/system-settings'],
    queryFn: async () => {
      const response = await fetch('/api/admin/system-settings');
      const data = await response.json();
      return data;
    },
    staleTime: 30 * 1000, // 30 seconds - settings change infrequently
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });

  // Query for health status
  const {
    data: healthStatus,
    isLoading: isLoadingHealth,
    refetch: refetchHealth
  } = useQuery<SystemSettingsHealthResponse>({
    queryKey: ['/api/admin/system-settings/health'],
    queryFn: async () => {
      const response = await fetch('/api/admin/system-settings/health');
      const data = await response.json();
      return data;
    },
    staleTime: 10 * 1000, // 10 seconds
    retry: 2
  });

  // Initialize local settings when system settings load
  useEffect(() => {
    if (systemSettings && !localSettings) {
      setLocalSettings({
        defaultAiModel: systemSettings.defaultAiModel,
        supportedAiModels: [...systemSettings.supportedAiModels],
        clientDefaultModel: systemSettings.clientDefaultModel,
        milestoneEnabled: systemSettings.milestoneEnabled ?? true
      });
    }
  }, [systemSettings, localSettings]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: SystemSettingsUpdate) => {
      return apiRequest('/api/admin/system-settings', {
        method: 'PUT',
        data: updates
      });
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system-settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings'] }); // Public endpoint
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system-settings/health'] });

      setHasUnsavedChanges(false);
      toast({
        title: "시스템 설정 업데이트 완료",
        description: "AI 모델 설정이 성공적으로 저장되었습니다.",
      });
    },
    onError: (error: any) => {
      console.error("시스템 설정 업데이트 오류:", error);
      toast({
        title: "설정 저장 실패",
        description: error?.message || "시스템 설정을 저장하는 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  });

  // Refresh cache mutation
  const refreshCacheMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/system-settings/refresh-cache', {
        method: 'POST'
      });
    },
    onSuccess: () => {
      // Refresh all queries after cache refresh
      refetchSettings();
      refetchHealth();
      toast({
        title: "캐시 새로고침 완료",
        description: "시스템 설정 캐시가 새로고침되었습니다.",
      });
    },
    onError: (error: any) => {
      console.error("캐시 새로고침 오류:", error);
      toast({
        title: "캐시 새로고침 실패",
        description: "캐시를 새로고침하는 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  });

  // Handle supported models toggle
  const handleSupportedModelToggle = (model: AiModel) => {
    if (!localSettings) return;

    const currentModels = localSettings.supportedAiModels;
    let newSupportedModels: AiModel[];

    if (currentModels.includes(model)) {
      // Remove model (but ensure at least one remains)
      if (currentModels.length > 1) {
        newSupportedModels = currentModels.filter(m => m !== model);
      } else {
        toast({
          title: "모델 제거 불가",
          description: "최소 1개 이상의 AI 모델은 지원되어야 합니다.",
          variant: "destructive"
        });
        return;
      }
    } else {
      // Add model
      newSupportedModels = [...currentModels, model];
    }

    // Auto-adjust other settings if needed
    let newDefaultModel = localSettings.defaultAiModel;
    let newClientDefault = localSettings.clientDefaultModel;

    // If removed model was the default, switch to first available
    if (!newSupportedModels.includes(localSettings.defaultAiModel)) {
      newDefaultModel = newSupportedModels[0];
    }

    if (!newSupportedModels.includes(localSettings.clientDefaultModel)) {
      newClientDefault = newSupportedModels[0];
    }

    setLocalSettings({
      ...localSettings,
      supportedAiModels: newSupportedModels,
      defaultAiModel: newDefaultModel,
      clientDefaultModel: newClientDefault
    });
    setHasUnsavedChanges(true);
  };

  // Handle default model change
  const handleDefaultModelChange = (model: AiModel) => {
    if (!localSettings) return;

    setLocalSettings({
      ...localSettings,
      defaultAiModel: model
    });
    setHasUnsavedChanges(true);
  };

  // Handle client default model change
  const handleClientDefaultModelChange = (model: AiModel) => {
    if (!localSettings) return;

    setLocalSettings({
      ...localSettings,
      clientDefaultModel: model
    });
    setHasUnsavedChanges(true);
  };

  // Handle save changes
  const handleSaveChanges = () => {
    if (!localSettings) return;
    updateSettingsMutation.mutate(localSettings);
  };

  // Handle milestone enabled toggle
  const handleMilestoneEnabledToggle = (enabled: boolean) => {
    if (!localSettings) return;

    setLocalSettings({
      ...localSettings,
      milestoneEnabled: enabled
    });
    setHasUnsavedChanges(true);
  };

  // Handle reset changes
  const handleResetChanges = () => {
    if (!systemSettings) return;

    setLocalSettings({
      defaultAiModel: systemSettings.defaultAiModel,
      supportedAiModels: [...systemSettings.supportedAiModels],
      clientDefaultModel: systemSettings.clientDefaultModel,
      milestoneEnabled: systemSettings.milestoneEnabled ?? true
    });
    setHasUnsavedChanges(false);
  };

  // Helper function to get model display info
  const getModelDisplayInfo = (model: AiModel) => {
    const modelInfo: Record<AiModel, { name: string; description: string; icon: React.ReactNode; color: string }> = {
      [AI_MODELS.OPENAI]: {
        name: "OpenAI GPT",
        description: "OpenAI의 최신 모델 (GPT-4o, DALL-E 3)",
        icon: <Cpu className="w-4 h-4" />,
        color: "bg-blue-500"
      },
      [AI_MODELS.GEMINI]: {
        name: "Google Gemini",
        description: "Google의 멀티모달 AI 모델 (2.5 Flash)",
        icon: <Zap className="w-4 h-4" />,
        color: "bg-purple-500"
      },
      [AI_MODELS.GEMINI_3]: {
        name: "Gemini 3.0 Pro",
        description: "Google의 고해상도 AI 모델 (3.0 Pro Preview)",
        icon: <Zap className="w-4 h-4" />,
        color: "bg-pink-500"
      }
    };
    return modelInfo[model];
  };

  if (isLoadingSettings) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>시스템 설정 로딩 중...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (settingsError) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>설정 로딩 오류</AlertTitle>
            <AlertDescription>
              시스템 설정을 불러오는 중 오류가 발생했습니다. 페이지를 새로고침하거나 관리자에게 문의하세요.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!systemSettings || !localSettings) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>설정 없음</AlertTitle>
            <AlertDescription>
              시스템 설정이 아직 초기화되지 않았습니다.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Settings className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">시스템 설정</h2>
            <p className="text-muted-foreground">AI 모델 및 시스템 동작 설정을 관리합니다</p>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchHealth()}
            disabled={isLoadingHealth}
          >
            <Activity className="h-4 w-4 mr-2" />
            상태 확인
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshCacheMutation.mutate()}
            disabled={refreshCacheMutation.isPending}
          >
            {refreshCacheMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            캐시 새로고침
          </Button>
        </div>
      </div>

      {/* Health Status Card */}
      {healthStatus?.health && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Server className="h-5 w-5" />
              <span>시스템 상태</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${healthStatus.health.isInitialized ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                <div>
                  <div className="font-medium">초기화 상태</div>
                  <div className="text-sm text-muted-foreground">
                    {healthStatus.health.isInitialized ? '정상' : '미초기화'}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${healthStatus.health.cacheStatus === 'hit' ? 'bg-green-500' :
                    healthStatus.health.cacheStatus === 'expired' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                <div>
                  <div className="font-medium">캐시 상태</div>
                  <div className="text-sm text-muted-foreground">
                    {healthStatus.health.cacheStatus === 'hit' ? '유효' :
                      healthStatus.health.cacheStatus === 'expired' ? '만료됨' : '없음'}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <div>
                  <div className="font-medium">마지막 업데이트</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(systemSettings.updatedAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Models Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>AI 모델 설정</CardTitle>
          <CardDescription>
            시스템에서 지원할 AI 모델을 선택하고 기본값을 설정합니다.
            변경사항은 전체 시스템에 즉시 적용됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Supported Models */}
          <div>
            <Label className="text-base font-medium">지원 AI 모델</Label>
            <p className="text-sm text-muted-foreground mb-4">
              시스템에서 사용할 수 있는 AI 모델을 선택하세요. 최소 1개 이상은 선택되어야 합니다.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.values(AI_MODELS).map((model) => {
                const modelInfo = getModelDisplayInfo(model);
                const isSupported = localSettings.supportedAiModels.includes(model);

                return (
                  <div
                    key={model}
                    className={`border rounded-lg p-4 transition-all ${isSupported
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${modelInfo.color}`}>
                          {modelInfo.icon}
                        </div>
                        <div>
                          <div className="font-medium">{modelInfo.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {modelInfo.description}
                          </div>
                        </div>
                      </div>

                      <Switch
                        checked={isSupported}
                        onCheckedChange={() => handleSupportedModelToggle(model)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Default Models */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* System Default Model */}
            <div>
              <Label className="text-base font-medium">시스템 기본 모델</Label>
              <p className="text-sm text-muted-foreground mb-3">
                서버 사이드에서 사용할 기본 AI 모델입니다.
              </p>

              <Select
                value={localSettings.defaultAiModel}
                onValueChange={handleDefaultModelChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="기본 모델을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {localSettings.supportedAiModels.map((model) => {
                    const modelInfo = getModelDisplayInfo(model);
                    return (
                      <SelectItem key={model} value={model}>
                        <div className="flex items-center space-x-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-xs ${modelInfo.color}`}>
                            {modelInfo.icon}
                          </div>
                          <span>{modelInfo.name}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Client Default Model */}
            <div>
              <Label className="text-base font-medium">클라이언트 기본 모델</Label>
              <p className="text-sm text-muted-foreground mb-3">
                사용자 인터페이스에서 기본으로 선택될 AI 모델입니다.
              </p>

              <Select
                value={localSettings.clientDefaultModel}
                onValueChange={handleClientDefaultModelChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="클라이언트 기본 모델을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {localSettings.supportedAiModels.map((model) => {
                    const modelInfo = getModelDisplayInfo(model);
                    return (
                      <SelectItem key={model} value={model}>
                        <div className="flex items-center space-x-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-xs ${modelInfo.color}`}>
                            {modelInfo.icon}
                          </div>
                          <span>{modelInfo.name}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Current Settings Display */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium mb-3">현재 설정 요약</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">지원 모델:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {localSettings.supportedAiModels.map(model => (
                    <Badge key={model} variant="secondary" className="text-xs">
                      {getModelDisplayInfo(model).name}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">시스템 기본:</span>
                <div className="mt-1">
                  <Badge variant="outline">
                    {getModelDisplayInfo(localSettings.defaultAiModel).name}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">클라이언트 기본:</span>
                <div className="mt-1">
                  <Badge variant="outline">
                    {getModelDisplayInfo(localSettings.clientDefaultModel).name}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Unsaved Changes Alert */}
          {hasUnsavedChanges && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>저장되지 않은 변경사항</AlertTitle>
              <AlertDescription>
                설정을 변경했습니다. 저장 버튼을 눌러 변경사항을 적용하세요.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={handleResetChanges}
              disabled={!hasUnsavedChanges || updateSettingsMutation.isPending}
            >
              되돌리기
            </Button>
          </div>

          <Button
            onClick={handleSaveChanges}
            disabled={!hasUnsavedChanges || updateSettingsMutation.isPending}
            className="min-w-[120px]"
          >
            {updateSettingsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                설정 저장
              </>
            )}
          </Button>
        </CardFooter>
      </Card>



    </div>
  );
}