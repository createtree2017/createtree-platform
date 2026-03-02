import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MusicStyle, MusicStyleInsert } from "@shared/schema";
import { useToast } from "@/hooks/useToast";
import { useModalContext } from "@/contexts/ModalContext";
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const modal = useModalContext();

  // Fetch music styles
  const { data: musicStyles = [], isLoading, error } = useQuery({
    queryKey: ["/api/admin/music-styles"],
  });

  const handleEditPrompt = (style: MusicStyle) => {
    modal.openModal('musicPrompt', { style });
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

    </div>
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