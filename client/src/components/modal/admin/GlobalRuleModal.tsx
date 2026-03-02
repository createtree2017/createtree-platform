import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useModalContext } from "@/contexts/ModalContext";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface GlobalPromptRule {
    id: number;
    name: string;
    jsonRules: any;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

interface RuleFormData {
    name: string;
    jsonRules: string;
    isActive: boolean;
}

export function GlobalRuleModal({
    isOpen,
    onClose,
    rule,
}: {
    isOpen?: boolean;
    onClose?: () => void;
    rule?: GlobalPromptRule;
}) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const modal = useModalContext();

    const [formData, setFormData] = useState<RuleFormData>({
        name: "",
        jsonRules: "",
        isActive: false
    });

    useEffect(() => {
        if (isOpen) {
            if (rule) {
                setFormData({
                    name: rule.name,
                    jsonRules: JSON.stringify(rule.jsonRules, null, 2),
                    isActive: rule.isActive
                });
            } else {
                setFormData({
                    name: "",
                    jsonRules: JSON.stringify({
                        ratio: "1:1",
                        subject: "pregnant Korean woman in her 20s",
                        quality: "high quality, detailed, professional",
                        style: "warm and gentle atmosphere",
                        technical: "8k resolution, soft lighting, cinematic composition"
                    }, null, 2),
                    isActive: false
                });
            }
        }
    }, [isOpen, rule]);

    const createRuleMutation = useMutation({
        mutationFn: (data: RuleFormData) => {
            try {
                const parsedData = {
                    ...data,
                    jsonRules: JSON.parse(data.jsonRules)
                };
                return apiRequest("/api/admin/global-prompt-rules", {
                    method: "POST",
                    body: JSON.stringify(parsedData)
                });
            } catch (error) {
                throw new Error("유효하지 않은 JSON 형식입니다.");
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/global-prompt-rules"] });
            toast({
                title: "성공",
                description: "전역 규칙이 성공적으로 생성되었습니다.",
            });
            modal.closeTopModal ? modal.closeTopModal() : onClose?.();
        },
        onError: (error: any) => {
            toast({
                title: "오류",
                description: error.message || "규칙 생성에 실패했습니다.",
                variant: "destructive"
            });
        }
    });

    const updateRuleMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: RuleFormData }) => {
            try {
                const parsedData = {
                    ...data,
                    jsonRules: JSON.parse(data.jsonRules)
                };
                return apiRequest(`/api/admin/global-prompt-rules/${id}`, {
                    method: "PUT",
                    body: JSON.stringify(parsedData)
                });
            } catch (error) {
                throw new Error("유효하지 않은 JSON 형식입니다.");
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/global-prompt-rules"] });
            toast({
                title: "성공",
                description: "전역 규칙이 성공적으로 수정되었습니다.",
            });
            modal.closeTopModal ? modal.closeTopModal() : onClose?.();
        },
        onError: (error: any) => {
            toast({
                title: "오류",
                description: error.message || "규칙 수정에 실패했습니다.",
                variant: "destructive"
            });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (rule) {
            updateRuleMutation.mutate({ id: rule.id, data: formData });
        } else {
            createRuleMutation.mutate(formData);
        }
    };

    const addJSONHelper = (key: string, value: string) => {
        try {
            const currentRules = JSON.parse(formData.jsonRules);
            currentRules[key] = value;
            setFormData({
                ...formData,
                jsonRules: JSON.stringify(currentRules, null, 2)
            });
        } catch (error) {
            const newRules = { [key]: value };
            setFormData({
                ...formData,
                jsonRules: JSON.stringify(newRules, null, 2)
            });
        }
    };

    const isPending = createRuleMutation.isPending || updateRuleMutation.isPending;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && (modal.closeTopModal ? modal.closeTopModal() : onClose?.())}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {rule ? "전역 규칙 수정" : "새 전역 규칙 추가"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="name">규칙 이름</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="예: 기본 이미지 규칙"
                                required
                            />
                        </div>

                        <div className="flex items-center space-x-2">
                            <Switch
                                id="isActive"
                                checked={formData.isActive}
                                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                            />
                            <Label htmlFor="isActive">활성화 (다른 규칙은 자동 비활성화)</Label>
                        </div>
                    </div>

                    <div className="border rounded-lg p-4 bg-gray-50">
                        <div className="text-sm font-medium mb-3">빠른 추가:</div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addJSONHelper("ratio", "1:1")}
                            >
                                비율: 1:1
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addJSONHelper("ratio", "4:3")}
                            >
                                비율: 4:3
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addJSONHelper("subject", "pregnant Korean woman in her 20s")}
                            >
                                주제: 임산부
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addJSONHelper("quality", "high quality, detailed, professional")}
                            >
                                품질: 고품질
                            </Button>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="jsonRules">JSON 규칙</Label>
                        <Textarea
                            id="jsonRules"
                            value={formData.jsonRules}
                            onChange={(e) => setFormData({ ...formData, jsonRules: e.target.value })}
                            placeholder="JSON 형태의 규칙을 입력하세요..."
                            rows={12}
                            className="font-mono text-sm"
                            required
                        />
                        <div className="text-xs text-muted-foreground mt-1">
                            유효한 JSON 형식으로 입력해주세요. ratio, subject, quality, style, technical 등의 키를 사용할 수 있습니다.
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => modal.closeTopModal ? modal.closeTopModal() : onClose?.()}
                        >
                            취소
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending}
                        >
                            {rule ? "수정" : "생성"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
