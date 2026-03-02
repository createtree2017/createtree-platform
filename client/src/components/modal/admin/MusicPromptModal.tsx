import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/useToast";
import { MusicStyle } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useModalContext } from "@/contexts/ModalContext";

export interface MusicPromptModalProps {
    isOpen?: boolean;
    onClose?: () => void;
    style: MusicStyle;
}

export function MusicPromptModal({
    isOpen,
    onClose,
    style,
}: MusicPromptModalProps) {
    const [prompt, setPrompt] = useState("");
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const modal = useModalContext();

    // Initialize prompt when style changes or modal opens
    useEffect(() => {
        if (isOpen && style) {
            setPrompt(style.prompt ?? "");
        }
    }, [isOpen, style]);

    const updatePromptMutation = useMutation({
        mutationFn: ({ id, newPrompt }: { id: number; newPrompt: string }) =>
            apiRequest(`/api/admin/music-styles/${id}`, {
                method: "PUT",
                body: JSON.stringify({ prompt: newPrompt }),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/music-styles"] });
            toast({
                title: "성공",
                description: "스타일 프롬프트가 업데이트되었습니다.",
            });
            // Close the modal
            if (modal && typeof modal.closeTopModal === 'function') {
                modal.closeTopModal();
            } else if (onClose) {
                onClose();
            }
        },
        onError: (error: any) => {
            toast({
                title: "오류",
                description: error.message || "프롬프트 업데이트에 실패했습니다.",
                variant: "destructive",
            });
        },
    });

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
        updatePromptMutation.mutate({ id: style.id, newPrompt: prompt.trim() });
    };

    const isPending = updatePromptMutation.isPending;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        "{style?.name}" 프롬프트 수정
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">음악 생성 프롬프트</label>
                        <Textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="예: gentle lullaby with soft piano melody, peaceful and calming"
                            className="min-h-32 font-mono text-sm"
                            disabled={isPending}
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
                            onClick={() => onClose?.()}
                            disabled={isPending}
                        >
                            취소
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending || prompt.trim().length < 10}
                        >
                            {isPending ? "저장 중..." : "저장"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
