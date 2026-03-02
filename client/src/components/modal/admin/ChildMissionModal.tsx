import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useModal } from '@/hooks/useModal';
import { Loader2, Plus, Edit, Trash2, FolderTree, Users } from 'lucide-react';
import type { MissionCategory } from "@shared/schema";

export interface ChildMissionModalProps {
    parentId: number;
    parentTitle: string;
    isOpen?: boolean; // Provided by ModalContext
    onClose?: () => void; // Provided by ModalContext
    onAddChildMission?: (parentId: number) => void;
    onEditChildMission?: (mission: any) => void;
}

export function ChildMissionModal({
    parentId,
    parentTitle,
    isOpen = true,
    onClose = () => { },
    onAddChildMission,
    onEditChildMission
}: ChildMissionModalProps) {
    const queryClient = useQueryClient();
    const modal = useModal();
    const { toast } = useToast();

    // 하부미션 목록 조회
    const { data: childMissions = [], isLoading } = useQuery<any[]>({
        queryKey: ['/api/admin/missions', parentId, 'child-missions'],
        queryFn: async () => {
            const response = await fetch(`/api/admin/missions/${parentId}/child-missions`, { credentials: 'include' });
            if (!response.ok) throw new Error('하부미션 조회 실패');
            return response.json();
        },
        enabled: isOpen && !!parentId
    });

    // 승인된 사용자 목록 조회 (수정: 모달 열기 버튼 자체에서 로딩 상태 처리 or 모달 열 때 쿼리 실행 제안)
    const { data: approvedUsersData, isLoading: isLoadingApprovedUsers } = useQuery<any>({
        queryKey: ['/api/admin/missions', parentId, 'approved-users'],
        queryFn: async () => {
            const response = await fetch(`/api/admin/missions/${parentId}/approved-users`, { credentials: 'include' });
            if (!response.ok) throw new Error('승인된 사용자 조회 실패');
            return response.json();
        },
        enabled: isOpen && !!parentId // 모달 열기 전에 데이터를 가져와 두는 방향으로 전환
    });

    // 카테고리 목록 조회
    const { data: categories = [] } = useQuery<MissionCategory[]>({
        queryKey: ['/api/admin/mission-categories'],
    });

    // 하부미션 삭제 mutation
    const deleteChildMissionMutation = useMutation({
        mutationFn: (id: number) =>
            apiRequest(`/api/admin/missions/${id}`, {
                method: 'DELETE'
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/missions', parentId, 'child-missions'] });
            queryClient.invalidateQueries({ queryKey: ['/api/admin/missions'] });
            toast({ title: "하부미션이 삭제되었습니다" });
        },
        onError: (error: any) => {
            toast({ title: "오류", description: error.message, variant: "destructive" });
        },
    });

    // Approved User Modal Open Handler
    const handleOpenApprovedUsers = () => {
        modal.open('approvedUsers', {
            users: approvedUsersData?.users || [],
            isLoading: isLoadingApprovedUsers
        });
    };

    // Add/Edit trigger helper: Since these might be handled in MissionManagement,
    // we either pass it via props (which is tricky for context modals)
    // or we manage it here. In this design, Edit opens 'missionForm' theoretically, 
    // but to keep it simple, they should ideally be triggering the form logic.
    // We'll trust the parent provided these for now, or use generic event dispatch.

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <FolderTree className="h-5 w-5" />
                        하부미션 관리
                    </SheetTitle>
                    <SheetDescription>
                        "{parentTitle}" 미션의 하부미션을 관리합니다
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-4">
                    {/* 승인된 사용자 정보 */}
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-blue-600" />
                            <span className="text-sm text-blue-700">
                                승인된 사용자만 하부미션에 접근할 수 있습니다
                            </span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleOpenApprovedUsers}
                            disabled={isLoadingApprovedUsers}
                        >
                            사용자 보기
                        </Button>
                    </div>

                    {/* 하부미션 추가 버튼 */}
                    <div className="flex justify-between items-center">
                        <h3 className="font-medium">하부미션 목록</h3>
                        <Button size="sm" onClick={() => onAddChildMission && onAddChildMission(parentId)}>
                            <Plus className="h-4 w-4 mr-1" />
                            하부미션 추가
                        </Button>
                    </div>

                    {/* 하부미션 목록 */}
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : childMissions.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            아직 하부미션이 없습니다
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {childMissions.map((mission: any) => {
                                const category = categories.find(c => c.categoryId === mission.categoryId);
                                return (
                                    <div
                                        key={mission.id}
                                        className="p-4 border rounded-lg hover:bg-gray-50 flex items-center justify-between"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{mission.title}</span>
                                                {category && (
                                                    <Badge variant="outline" className="text-xs">
                                                        {category.emoji} {category.name}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="text-sm text-gray-500 mt-1">
                                                세부미션: {mission.subMissionCount || 0}개 |
                                                승인된 사용자: {mission.approvedUserCount || 0}명
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onEditChildMission && onEditChildMission(mission)}
                                                title="수정"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => modal.open('deleteConfirm', {
                                                    title: '하부 미션 삭제',
                                                    description: '정말로 이 하부 미션을 삭제하시겠습니까? 관련 세부 미션도 함께 삭제될 수 있습니다.',
                                                    isLoading: deleteChildMissionMutation.isPending,
                                                    onConfirm: () => deleteChildMissionMutation.mutate(mission.id)
                                                })}
                                                title="삭제"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
