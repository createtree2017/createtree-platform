import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface PushTemplate {
  id: number;
  name: string;
  title: string;
  body: string;
  actionUrl: string | null;
  imageUrl: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TemplateFormData {
  name: string;
  title: string;
  body: string;
  actionUrl: string;
  imageUrl: string;
  category: string;
}

const EMPTY_FORM: TemplateFormData = {
  name: "", title: "", body: "", actionUrl: "", imageUrl: "", category: "general",
};

export default function PushTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<PushTemplate | null>(null);
  const [form, setForm] = useState<TemplateFormData>(EMPTY_FORM);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data, isLoading } = useQuery<{ templates: PushTemplate[] }>({
    queryKey: ["/api/admin/push-templates"],
    queryFn: async () => {
      const res = await fetch("/api/admin/push-templates");
      if (!res.ok) throw new Error("템플릿 조회 실패");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      return apiRequest("/api/admin/push-templates", { method: "POST", data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/push-templates"] });
      toast({ title: "템플릿 생성 완료" });
      closeDialog();
    },
    onError: () => toast({ title: "템플릿 생성 실패", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TemplateFormData }) => {
      return apiRequest(`/api/admin/push-templates/${id}`, { method: "PATCH", data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/push-templates"] });
      toast({ title: "템플릿 수정 완료" });
      closeDialog();
    },
    onError: () => toast({ title: "템플릿 수정 실패", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/admin/push-templates/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/push-templates"] });
      toast({ title: "템플릿 삭제 완료" });
    },
    onError: () => toast({ title: "템플릿 삭제 실패", variant: "destructive" }),
  });

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setForm(EMPTY_FORM);
    setIsDialogOpen(true);
  };

  const openEditDialog = (template: PushTemplate) => {
    setEditingTemplate(template);
    setForm({
      name: template.name,
      title: template.title,
      body: template.body,
      actionUrl: template.actionUrl || "",
      imageUrl: template.imageUrl || "",
      category: template.category || "general",
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.title.trim() || !form.body.trim()) {
      toast({ title: "입력 오류", description: "이름, 제목, 본문은 필수입니다.", variant: "destructive" });
      return;
    }

    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`"${name}" 템플릿을 삭제하시겠습니까?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          자주 사용하는 알림 내용을 템플릿으로 저장하여 빠르게 재사용할 수 있습니다.
        </p>
        <Button onClick={openCreateDialog} size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> 템플릿 추가
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
      ) : !data?.templates?.length ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            등록된 템플릿이 없습니다. "템플릿 추가" 버튼으로 첫 번째 템플릿을 만들어보세요.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {data.templates.map((template) => (
            <Card key={template.id}>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{template.name}</span>
                      <Badge variant={template.isActive ? "default" : "secondary"} className="text-xs">
                        {template.isActive ? "활성" : "비활성"}
                      </Badge>
                      {template.category && (
                        <Badge variant="outline" className="text-xs">{template.category}</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">{template.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{template.body}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(template)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => handleDelete(template.id, template.name)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 생성/수정 다이얼로그 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "템플릿 수정" : "새 템플릿 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>템플릿 이름 <span className="text-red-500">*</span></Label>
              <Input
                placeholder="예: 미션 승인 알림"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>알림 제목 <span className="text-red-500">*</span></Label>
              <Input
                placeholder="푸시 알림에 표시될 제목"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>알림 본문 <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="푸시 알림에 표시될 내용"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>딥링크 URL (선택)</Label>
              <Input
                placeholder="예: /mymissions"
                value={form.actionUrl}
                onChange={(e) => setForm({ ...form, actionUrl: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>이미지 URL (선택)</Label>
              <Input
                placeholder="https://..."
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>카테고리</Label>
              <Input
                placeholder="general"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>취소</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingTemplate ? "수정" : "생성"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
