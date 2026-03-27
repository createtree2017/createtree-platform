import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import PushUserSelector from "./PushUserSelector";

interface PushUser {
  id: number;
  username: string;
  email: string | null;
  fullName: string | null;
  phoneNumber: string | null;
  hospitalId: number | null;
  memberType: string | null;
}

interface Hospital {
  id: number;
  name: string;
  isActive: boolean;
}

interface PushTemplate {
  id: number;
  name: string;
  title: string;
  body: string;
  actionUrl: string | null;
  imageUrl: string | null;
  category: string | null;
}

export default function PushSend() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [targetType, setTargetType] = useState("all");
  const [selectedUsers, setSelectedUsers] = useState<PushUser[]>([]);
  const [hospitalId, setHospitalId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // 병원 목록 조회
  const { data: hospitalsData } = useQuery<{ hospitals: Hospital[] }>({
    queryKey: ["/api/admin/push-hospitals"],
    queryFn: async () => {
      const res = await fetch("/api/admin/push-hospitals");
      if (!res.ok) throw new Error("병원 목록 조회 실패");
      return res.json();
    },
    enabled: targetType === "hospital",
  });

  // 템플릿 목록 조회
  const { data: templatesData } = useQuery<{ templates: PushTemplate[] }>({
    queryKey: ["/api/admin/push-templates"],
    queryFn: async () => {
      const res = await fetch("/api/admin/push-templates");
      if (!res.ok) throw new Error("템플릿 조회 실패");
      return res.json();
    },
  });

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
      setSelectedUsers([]);
      setHospitalId("");
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

  // 템플릿 선택 시 자동 채움
  const handleTemplateSelect = (templateId: string) => {
    if (templateId === "none") {
      return;
    }
    const template = templatesData?.templates?.find((t) => String(t.id) === templateId);
    if (template) {
      setTitle(template.title);
      setBody(template.body);
      if (template.actionUrl) setActionUrl(template.actionUrl);
      if (template.imageUrl) setImageUrl(template.imageUrl);
      toast({
        title: "템플릿 적용",
        description: `"${template.name}" 템플릿이 적용되었습니다.`,
      });
    }
  };

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

    // 대상 유효성 검증
    if (targetType === "specific_users" && selectedUsers.length === 0) {
      toast({
        title: "입력 오류",
        description: "발송 대상 회원을 선택해주세요.",
        variant: "destructive"
      });
      return;
    }

    if (targetType === "hospital" && !hospitalId) {
      toast({
        title: "입력 오류",
        description: "발송 대상 병원을 선택해주세요.",
        variant: "destructive"
      });
      return;
    }

    const payload: any = {
      targetType,
      title,
      body,
      actionUrl: actionUrl || undefined,
      imageUrl: imageUrl || undefined,
    };

    if (targetType === "specific_users") {
      payload.targetIds = selectedUsers.map((u) => u.id);
    }

    if (targetType === "hospital") {
      payload.hospitalId = parseInt(hospitalId);
    }

    sendMutation.mutate(payload);
  };

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>수동 푸시 발송</CardTitle>
        <CardDescription>전체 회원, 특정 회원, 또는 병원별 회원에게 푸시 알림을 발송합니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 템플릿 선택 */}
          {templatesData?.templates && templatesData.templates.length > 0 && (
            <div className="space-y-2">
              <Label>알림 템플릿 (선택)</Label>
              <Select onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="템플릿을 선택하면 제목/본문이 자동 입력됩니다" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">직접 입력</SelectItem>
                  {templatesData.templates.map((template) => (
                    <SelectItem key={template.id} value={String(template.id)}>
                      {template.name} — {template.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 발송 대상 */}
          <div className="space-y-2">
            <Label>발송 대상</Label>
            <Select value={targetType} onValueChange={(val) => {
              setTargetType(val);
              setSelectedUsers([]);
              setHospitalId("");
            }}>
              <SelectTrigger>
                <SelectValue placeholder="발송 대상 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 앱 사용자</SelectItem>
                <SelectItem value="specific_users">특정 사용자(ID)</SelectItem>
                <SelectItem value="hospital">지정 병원(거래처)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 특정 사용자 선택 */}
          {targetType === "specific_users" && (
            <PushUserSelector
              selectedUsers={selectedUsers}
              onSelectionChange={setSelectedUsers}
            />
          )}

          {/* 병원 선택 */}
          {targetType === "hospital" && (
            <div className="space-y-2">
              <Label>발송 대상 병원</Label>
              <Select value={hospitalId} onValueChange={setHospitalId}>
                <SelectTrigger>
                  <SelectValue placeholder="병원을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {hospitalsData?.hospitals?.map((h) => (
                    <SelectItem key={h.id} value={String(h.id)}>
                      {h.name} {!h.isActive && "(비활성)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                선택한 병원(거래처)에 소속된 모든 앱 사용자에게 발송됩니다.
              </p>
            </div>
          )}

          {/* 푸시 제목 */}
          <div className="space-y-2">
            <Label>푸시 제목 <span className="text-red-500">*</span></Label>
            <Input 
              placeholder="알림 제목을 입력하세요" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              required
            />
          </div>

          {/* 푸시 본문 */}
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

          {/* 딥링크 */}
          <div className="space-y-2">
            <Label>이동할 딥링크 / URL (선택)</Label>
            <Input 
              placeholder="예: /mymissions 또는 https://example.com" 
              value={actionUrl} 
              onChange={(e) => setActionUrl(e.target.value)} 
            />
            <p className="text-xs text-muted-foreground">앱 내 경로 또는 전체 URL을 입력하세요. 클릭 시 해당 페이지로 이동합니다.</p>
          </div>

          {/* 이미지 URL */}
          <div className="space-y-2">
            <Label>이미지 URL (선택)</Label>
            <Input 
              placeholder="https://..." 
              value={imageUrl} 
              onChange={(e) => setImageUrl(e.target.value)} 
            />
            <p className="text-xs text-muted-foreground">Android에서 큰 이미지, iOS에서 리치 푸시로 표시될 이미지 링크입니다.</p>
          </div>

          <Button type="submit" className="w-full" disabled={sendMutation.isPending}>
            {sendMutation.isPending ? "발송 중..." : "푸시 알림 발송하기"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
