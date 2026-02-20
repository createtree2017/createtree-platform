import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { X, Music as MusicIcon } from "lucide-react";

// 사용자 UI와 동일한 음악 스타일 단어 관리
export default function MusicStylePromptManager() {
    const [newStyleName, setNewStyleName] = useState("");
    const queryClient = useQueryClient();

    // 음악 스타일 조회
    const { data: musicStylesData, isLoading, error } = useQuery({
        queryKey: ["/api/admin/music-styles"],
    });
    const musicStyles = (musicStylesData || []) as any[];

    // 새 스타일 단어 추가
    const createMutation = useMutation({
        mutationFn: (styleName: string) =>
            apiRequest("/api/admin/music-styles", {
                method: "POST",
                body: JSON.stringify({
                    styleId: styleName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                    name: styleName,
                    description: styleName,
                    prompt: styleName,
                    isActive: true,
                    order: musicStyles.length + 1
                }),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/music-styles"] });
            setNewStyleName("");
            toast({
                title: "성공",
                description: "새 스타일이 추가되었습니다.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "오류",
                description: error.message || "스타일 추가에 실패했습니다.",
                variant: "destructive",
            });
        },
    });

    // 스타일 삭제
    const deleteMutation = useMutation({
        mutationFn: (id: number) =>
            apiRequest(`/api/admin/music-styles/${id}`, {
                method: "DELETE",
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/music-styles"] });
            toast({
                title: "성공",
                description: "스타일이 삭제되었습니다.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "오류",
                description: error.message || "스타일 삭제에 실패했습니다.",
                variant: "destructive",
            });
        },
    });

    const handleAddStyle = () => {
        if (newStyleName.trim().length < 2) {
            toast({
                title: "입력 오류",
                description: "스타일 이름은 최소 2글자 이상 입력해주세요.",
                variant: "destructive",
            });
            return;
        }
        createMutation.mutate(newStyleName.trim());
    };

    const handleDeleteStyle = (id: number, name: string) => {
        if (window.confirm(`"${name}" 스타일을 삭제하시겠습니까?`)) {
            deleteMutation.mutate(id);
        }
    };

    if (isLoading) {
        return <div className="text-center py-10">스타일을 불러오는 중...</div>;
    }

    if (error) {
        return <div className="text-center py-10 text-red-500">오류가 발생했습니다. 페이지를 새로고침해주세요.</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-semibold">스타일 프롬프트</h3>
                <p className="text-gray-600 mt-1">클릭하여 음악 분위기를 선택할 수 있습니다</p>
            </div>

            {/* 새 스타일 추가 */}
            <Card className="p-4">
                <div className="flex gap-3">
                    <Input
                        placeholder="예: Cheerful, Sad, Peaceful..."
                        value={newStyleName}
                        onChange={(e) => setNewStyleName(e.target.value)}
                        className="flex-1"
                    />
                    <Button
                        onClick={handleAddStyle}
                        disabled={!newStyleName.trim() || createMutation.isPending}
                    >
                        {createMutation.isPending ? "추가 중..." : "추가"}
                    </Button>
                </div>
            </Card>

            {/* 현재 스타일들 - 사용자 UI와 동일한 형태 */}
            <div className="space-y-4">
                {musicStyles.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                        {musicStyles.map((style: any) => (
                            <div key={style.id} className="relative group">
                                <Button
                                    variant="outline"
                                    className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
                                >
                                    {style.name}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleDeleteStyle(style.id, style.name)}
                                    disabled={deleteMutation.isPending}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Card className="p-8 text-center">
                        <MusicIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">스타일이 없습니다</h3>
                        <p className="text-gray-500">첫 번째 음악 스타일을 추가해보세요</p>
                    </Card>
                )}
            </div>

            <p className="text-sm text-gray-500">
                클릭하여 음악 분위기를 추가할 수 있습니다
            </p>
        </div>
    );
}
