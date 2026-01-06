import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MusicStyle, MusicStyleInsert } from "@shared/schema";
import { useToast } from "@/hooks/useToast";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Button
} from "@/components/ui/button";
import {
  Badge
} from "@/components/ui/badge";
import {
  Textarea
} from "@/components/ui/textarea";
import { Edit3, Music2 } from "lucide-react";

// Music Style Prompt Manager Component
function MusicStylePromptManager() {
  const [editingStyle, setEditingStyle] = useState<MusicStyle | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch music styles
  const { data: musicStyles = [], isLoading, error } = useQuery({
    queryKey: ["/api/admin/music-styles"],
  });

  // Update mutation (프롬프트만 수정)
  const updatePromptMutation = useMutation({
    mutationFn: ({ id, prompt }: { id: number; prompt: string }) => 
      apiRequest(`/api/admin/music-styles/${id}`, {
        method: "PUT",
        body: JSON.stringify({ prompt }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/music-styles"] });
      setIsEditDialogOpen(false);
      setEditingStyle(null);
      toast({
        title: "성공",
        description: "스타일 프롬프트가 업데이트되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "프롬프트 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleEditPrompt = (style: MusicStyle) => {
    setEditingStyle(style);
    setIsEditDialogOpen(true);
  };

  if (isLoading) {
    return <div className="text-center py-10">음악 스타일을 불러오는 중...</div>;
  }

  if (error) {
    return <div className="text-center py-10 text-red-500">오류가 발생했습니다. 페이지를 새로고침해주세요.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">음악 스타일 프롬프트 관리</h3>
          <p className="text-gray-600 mt-1">각 음악 스타일의 AI 생성 프롬프트를 관리합니다</p>
        </div>
      </div>

      {Array.isArray(musicStyles) && musicStyles.length > 0 ? (
        <div className="grid gap-4">
          {musicStyles.map((style: MusicStyle) => (
            <Card key={style.id} className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <Badge variant={style.isActive ? "default" : "secondary"}>
                      {style.name}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {style.isActive ? "활성" : "비활성"}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">현재 프롬프트:</h4>
                    <div className="bg-gray-50 p-3 rounded-md border">
                      <p className="text-sm font-mono text-gray-700">
                        {style.prompt || "프롬프트가 설정되지 않았습니다"}
                      </p>
                    </div>
                    {style.prompt && (
                      <p className="text-xs text-gray-500">
                        {style.prompt.length} 글자
                      </p>
                    )}
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditPrompt(style)}
                  className="ml-4"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  수정
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <div className="text-gray-500">
            <Music2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">음악 스타일이 없습니다</h3>
            <p>먼저 음악 스타일을 생성해주세요.</p>
          </div>
        </Card>
      )}

      {/* 프롬프트 수정 다이얼로그 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              "{editingStyle?.name}" 프롬프트 수정
            </DialogTitle>
          </DialogHeader>
          {editingStyle && (
            <PromptEditForm
              style={editingStyle}
              onSave={(prompt) => updatePromptMutation.mutate({ id: editingStyle.id, prompt })}
              onCancel={() => setIsEditDialogOpen(false)}
              isLoading={updatePromptMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 프롬프트 수정 폼 컴포넌트
function PromptEditForm({ 
  style, 
  onSave, 
  onCancel, 
  isLoading 
}: {
  style: MusicStyle;
  onSave: (prompt: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [prompt, setPrompt] = useState(style.prompt ?? "");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim().length < 10) {
      toast({
        title: "오류",
        description: "프롬프트는 최소 10자 이상이어야 합니다.",
        variant: "destructive",
      });
      return;
    }
    onSave(prompt.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">음악 생성 프롬프트</label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="예: gentle lullaby with soft piano melody, peaceful and calming"
          className="min-h-32 font-mono text-sm"
          disabled={isLoading}
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>{prompt.length} 글자</span>
          <span>최소 10글자 필요</span>
        </div>
      </div>
      
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-2">프롬프트 작성 가이드</h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• 영문으로 작성해주세요 (TopMediai API 호환성)</li>
          <li>• 장르, 악기, 분위기를 명확히 표현해주세요</li>
          <li>• 예: "soft classical piano, gentle melody, peaceful atmosphere"</li>
        </ul>
      </div>
      
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          취소
        </Button>
        <Button
          type="submit"
          disabled={isLoading || prompt.trim().length < 10}
        >
          {isLoading ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}

export default function AdminSafePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">관리자 페이지</h1>
        <p className="text-gray-600 mt-2">플랫폼 설정 및 콘텐츠를 관리할 수 있습니다</p>
      </div>

      <Tabs defaultValue="music-prompts" className="space-y-6">
        <TabsList className="grid w-full grid-cols-1 lg:grid-cols-4">
          <TabsTrigger value="music-prompts">음악 프롬프트</TabsTrigger>
        </TabsList>

        <TabsContent value="music-prompts" className="space-y-6">
          <MusicStylePromptManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}