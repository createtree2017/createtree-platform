import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";

export default function PushSend() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [targetType, setTargetType] = useState("all");
  const [targetIds, setTargetIds] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const sendMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("/api/admin/push-send", { method: "POST", data });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "푸시 발송 완료",
        description: `성공: ${data.result?.successCount || 0}건, 실패: ${data.result?.failureCount || 0}건`,
      });
      // 폼 초기화
      setTitle("");
      setBody("");
      setActionUrl("");
      setImageUrl("");
      // 로그 목록 갱신
      queryClient.invalidateQueries({ queryKey: ["/api/admin/push-logs"] });
    },
    onError: (error) => {
      toast({
        title: "푸시 발송 실패",
        description: error.message || "발송 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !body.trim()) {
      toast({
        title: "입력 오류",
        description: "제목과 본문을 입력해주세요.",
        variant: "destructive"
      });
      return;
    }

    let parsedTargetIds: number[] = [];
    if (targetType === "specific_users") {
      parsedTargetIds = targetIds.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (parsedTargetIds.length === 0) {
        toast({
          title: "입력 오류",
          description: "유효한 대상 유저 ID를 입력해주세요.",
          variant: "destructive"
        });
        return;
      }
    }

    sendMutation.mutate({
      targetType,
      targetIds: parsedTargetIds,
      title,
      body,
      actionUrl: actionUrl || undefined,
      imageUrl: imageUrl || undefined,
    });
  };

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>수동 푸시 발송</CardTitle>
        <CardDescription>전체 회원 또는 특정 회원에게 푸시 알림을 발송합니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>발송 대상</Label>
            <Select value={targetType} onValueChange={setTargetType}>
              <SelectTrigger>
                <SelectValue placeholder="발송 대상 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 앱 사용자</SelectItem>
                <SelectItem value="specific_users">특정 사용자(ID)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {targetType === "specific_users" && (
            <div className="space-y-2">
              <Label>대상 유저 ID (쉼표로 구분)</Label>
              <Input 
                placeholder="예: 1, 2, 3" 
                value={targetIds} 
                onChange={(e) => setTargetIds(e.target.value)} 
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>푸시 제목 <span className="text-red-500">*</span></Label>
            <Input 
              placeholder="알림 제목을 입력하세요" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              required
            />
          </div>

          <div className="space-y-2">
            <Label>푸시 본문 (내용) <span className="text-red-500">*</span></Label>
            <Textarea 
              placeholder="알림 내용을 입력하세요" 
              value={body} 
              onChange={(e) => setBody(e.target.value)} 
              rows={4}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>이동할 딥링크 / URL (선택)</Label>
            <Input 
              placeholder="예: /mymissions 또는 https://example.com" 
              value={actionUrl} 
              onChange={(e) => setActionUrl(e.target.value)} 
            />
            <p className="text-xs text-muted-foreground">앱 내 경로 또는 전체 URL을 입력하세요. 클릭 시 해당 페이지로 이동합니다.</p>
          </div>

          <div className="space-y-2">
            <Label>이미지 URL (선택)</Label>
            <Input 
              placeholder="https://..." 
              value={imageUrl} 
              onChange={(e) => setImageUrl(e.target.value)} 
            />
            <p className="text-xs text-muted-foreground">Android에서 큰 여백 이미지, iOS에서 리치 푸시로 표시될 이미지 링크입니다.</p>
          </div>

          <Button type="submit" className="w-full" disabled={sendMutation.isPending}>
            {sendMutation.isPending ? "발송 중..." : "푸시 알림 발송하기"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
