import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Zap } from "lucide-react";

interface AutoPushRule {
  id: number;
  eventType: string;
  hospitalId: number | null;
  titleTemplate: string;
  bodyTemplate: string;
  actionUrlTemplate: string | null;
  category: string;
  isActive: boolean;
  priority: number;
  sentCount: number;
  lastSentAt: string | null;
}

interface Hospital {
  id: number;
  name: string;
}

const EVENT_TYPES = [
  { value: "mission_approve", label: "[미션] 승인 시" },
  { value: "mission_reject", label: "[미션] 반려 시" },
  { value: "mission_status_changed", label: "[미션] 상태 변경 시" },
];

const CATEGORIES = [
  { value: "system", label: "시스템 알림 (필수)" },
  { value: "mission", label: "활동/미션 알림" },
  { value: "marketing", label: "혜택/이벤트 (마케팅)" },
];

const CHIP_VARIABLES = ["userName", "missionTitle", "rejectReason", "submissionId"];

export default function PushAutomation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoPushRule | null>(null);

  const [form, setForm] = useState<Partial<AutoPushRule>>({
    eventType: "mission_approve",
    hospitalId: null,
    titleTemplate: "",
    bodyTemplate: "",
    actionUrlTemplate: "/mymissions",
    category: "mission",
    isActive: true,
    priority: 0,
  });

  const { data: rules = [], isLoading } = useQuery<AutoPushRule[]>({
    queryKey: ["/api/admin/push-automation"],
  });

  const { data: hospitals = [] } = useQuery<Hospital[]>({
    queryKey: ["/api/hospitals"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<AutoPushRule>) => {
      // JSON payload converts undefined/null rules correctly
      const payload = { ...data, hospitalId: data.hospitalId === -1 ? null : data.hospitalId };
      return apiRequest("/api/admin/push-automation", { method: "POST", data: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/push-automation"] });
      toast({ title: "자동 발송 규칙이 생성되었습니다." });
      setIsDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<AutoPushRule> }) => {
      const payload = { ...data, hospitalId: data.hospitalId === -1 ? null : data.hospitalId };
      return apiRequest(`/api/admin/push-automation/${id}`, { method: "PATCH", data: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/push-automation"] });
      toast({ title: "규칙이 수정되었습니다." });
      setIsDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/admin/push-automation/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/push-automation"] });
      toast({ title: "규칙이 삭제되었습니다." });
    },
  });

  const handleToggle = (rule: AutoPushRule, checked: boolean) => {
    updateMutation.mutate({ id: rule.id, data: { isActive: checked } });
  };

  const openCreateDialog = () => {
    setEditingRule(null);
    setForm({
      eventType: "mission_approve",
      hospitalId: -1 as any, // UI에서 -1은 전체(Null)로 간주
      titleTemplate: "",
      bodyTemplate: "",
      actionUrlTemplate: "/mymissions",
      category: "mission",
      isActive: true,
      priority: 0,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (rule: AutoPushRule) => {
    setEditingRule(rule);
    setForm({
      ...rule,
      hospitalId: rule.hospitalId === null ? -1 : rule.hospitalId,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.titleTemplate || !form.bodyTemplate) {
      toast({ title: "필수 항목을 입력하세요.", variant: "destructive" });
      return;
    }
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const insertVariable = (field: 'titleTemplate' | 'bodyTemplate' | 'actionUrlTemplate', variable: string) => {
    // 간단히 끝에 추가 (고도화 시 커서 위치 삽입 가능)
    setForm(prev => ({ ...prev, [field]: (prev[field] || "") + `{{${variable}}}` }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          특정 이벤트 발생 시 조건에 맞는 내용으로 푸시 알림을 자동 발송하는 규칙(Rule Engine)을 관리합니다.
        </p>
        <Button onClick={openCreateDialog} size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> 규칙 추가
        </Button>
      </div>

      <div className="grid gap-3">
        {rules.map(rule => (
          <Card key={rule.id} className={rule.isActive ? "" : "opacity-60"}>
            <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-slate-100">
                    {EVENT_TYPES.find(e => e.value === rule.eventType)?.label || rule.eventType}
                  </Badge>
                  <Badge variant={rule.hospitalId === -2 ? "destructive" : (rule.hospitalId ? "default" : "secondary")}>
                    {rule.hospitalId 
                      ? (rule.hospitalId === -2 
                        ? "개발전용 (슈퍼관리자)" 
                        : (hospitals.find(h => h.id === rule.hospitalId)?.name || `병원 ID: ${rule.hospitalId}`))
                      : "전체 병원 (공통)"}
                  </Badge>
                  {rule.priority > 0 && <Badge variant="destructive" className="text-[10px] px-1 h-4">우선순위: {rule.priority}</Badge>}
                </div>
                <p className="font-semibold text-sm">{rule.titleTemplate}</p>
                <p className="text-sm text-muted-foreground truncate">{rule.bodyTemplate}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                  <span>발송: {rule.sentCount.toLocaleString()}건</span>
                  {rule.lastSentAt && <span>마지막 발송: {new Date(rule.lastSentAt).toLocaleString()}</span>}
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">{rule.isActive ? 'ON' : 'OFF'}</Label>
                  <Switch 
                    checked={rule.isActive} 
                    onCheckedChange={(checked) => handleToggle(rule, checked)}
                  />
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(rule)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => {
                    if(confirm("정말 이 자동 발송 규칙을 삭제하시겠습니까?")) {
                      deleteMutation.mutate(rule.id);
                    }
                  }} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRule ? "규칙 수정" : "새 규칙 추가"}</DialogTitle>
            <DialogDescription>
              이벤트 발생 시 병원 조건에 부합하면 자동으로 치환되어 푸시가 발송됩니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>트리거 이벤트 (언제?)</Label>
              <Select value={form.eventType} onValueChange={(v) => setForm({ ...form, eventType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>적용 대상 필터 (누구에게?)</Label>
              <Select value={String(form.hospitalId)} onValueChange={(v) => setForm({ ...form, hospitalId: parseInt(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="-1">전체 회원 (공통)</SelectItem>
                  <SelectItem value="-2">개발전용 (슈퍼관리자)</SelectItem>
                  {hospitals.map(h => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            <div className="col-span-2 space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <Label>가용 변수 (클릭 시 삽입)</Label>
                <div className="flex gap-1 flex-wrap">
                  {CHIP_VARIABLES.map(v => (
                    <Badge key={v} variant="outline" className="cursor-pointer hover:bg-slate-100" onClick={() => insertVariable('bodyTemplate', v)}>
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2 col-span-2">
              <Label>푸시 제목 템플릿</Label>
              <Input value={form.titleTemplate || ""} onChange={e => setForm({...form, titleTemplate: e.target.value})} placeholder="{{userName}}님! 미션이 승인되었습니다." />
            </div>
            
            <div className="space-y-2 col-span-2">
              <Label>푸시 본문 템플릿</Label>
              <Textarea rows={3} value={form.bodyTemplate || ""} onChange={e => setForm({...form, bodyTemplate: e.target.value})} placeholder="{{missionTitle}} 승인을 축하합니다." />
            </div>

            <div className="space-y-2">
              <Label>이동할 딥링크 (Action URL)</Label>
              <Input value={form.actionUrlTemplate || ""} onChange={e => setForm({...form, actionUrlTemplate: e.target.value})} placeholder="/mymissions" />
            </div>
            
            <div className="space-y-2">
              <Label>우선순위 (높을수록 우선)</Label>
              <Input type="number" value={form.priority || 0} onChange={e => setForm({...form, priority: parseInt(e.target.value) || 0})} />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>알림 카테고리 (수신 동의 적용 기준)</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

          </div>

          <DialogFooter className="mt-4 border-t pt-4 sm:justify-between">
            <Button variant="outline" type="button" onClick={() => toast({ title: "다음 버전에서 지원될 테스트 발송 기능입니다." })}>
              <Zap className="h-4 w-4 mr-1" />내 기기로 테스트 발송
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>취소</Button>
              <Button onClick={handleSubmit}>{editingRule ? "수정" : "저장"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
