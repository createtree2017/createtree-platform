import React, { useState } from "react";
import { useModal } from "@/hooks/useModal";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

// Phase 7-1: 신청 내역 관리 컴포넌트
export default function ApplicationManagement() {
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [selectedApplication, setSelectedApplication] = useState<any>(null);
    const modal = useModal();
    const queryClient = useQueryClient();

    // 신청 목록 조회
    const { data: applications = [], isLoading, error } = useQuery({
        queryKey: ["/api/admin/milestone-applications", statusFilter],
        queryFn: async () => {
            const url = statusFilter === "all"
                ? "/api/admin/milestone-applications"
                : `/api/admin/milestone-applications?status=${statusFilter}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("신청 목록을 불러오는데 실패했습니다.");
            }
            return response.json();
        }
    });

    // 신청 상세 조회
    const handleViewDetail = async (applicationId: number) => {
        try {
            const response = await fetch(`/api/admin/milestone-applications/${applicationId}`);
            if (!response.ok) {
                throw new Error("신청 상세 정보를 불러오는데 실패했습니다.");
            }
            const applicationDetail = await response.json();
            modal.open('applicationDetail', {
                application: applicationDetail
            });
        } catch (error) {
            console.error("신청 상세 조회 오류:", error);
            toast({
                title: "오류",
                description: "신청 상세 정보를 불러오는데 실패했습니다.",
                variant: "destructive",
            });
        }
    };

    // 신청 승인/거절/취소 처리
    const handleApproval = async (applicationId: number, status: 'approved' | 'rejected' | 'cancelled') => {
        setIsProcessing(true);
        try {
            const response = await fetch(`/api/admin/milestone-applications/${applicationId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status })
            });

            if (!response.ok) {
                throw new Error(`신청 ${status === 'approved' ? '승인' : status === 'rejected' ? '보류' : '취소'}에 실패했습니다.`);
            }

            // 성공 시 토스트 표시
            const statusMessage = status === 'approved' ? '승인' : status === 'rejected' ? '보류' : '취소';
            toast({
                title: "처리 완료",
                description: `신청이 ${statusMessage}되었습니다.`,
            });

            // 신청 목록 새로고침
            queryClient.invalidateQueries({ queryKey: ["/api/admin/milestone-applications"] });

            // 상세 다이얼로그 닫기
            setIsDetailDialogOpen(false);
            setSelectedApplication(null);

        } catch (error) {
            console.error("신청 처리 오류:", error);
            toast({
                title: "오류",
                description: error instanceof Error ? error.message : "신청 처리에 실패했습니다.",
                variant: "destructive",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    // 상태별 색상 반환
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'approved': return 'bg-green-100 text-green-800';
            case 'rejected': return 'bg-red-100 text-red-800';
            case 'cancelled': return 'bg-gray-100 text-gray-800';
            case 'expired': return 'bg-orange-100 text-orange-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    // 상태 한글명 반환
    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'pending': return '대기중';
            case 'approved': return '승인됨';
            case 'rejected': return '보류됨';
            case 'cancelled': return '취소됨';
            case 'expired': return '만료됨';
            default: return status;
        }
    };

    if (isLoading) {
        return <div className="text-center py-10">신청 목록을 불러오는 중...</div>;
    }

    if (error) {
        return (
            <div className="text-center py-10">
                <p className="text-red-500">신청 목록을 불러오는데 실패했습니다.</p>
                <Button
                    variant="outline"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/milestone-applications"] })}
                    className="mt-4"
                >
                    다시 시도
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 필터 영역 */}
            <Card className="p-4">
                <div className="flex items-center gap-4">
                    <Label htmlFor="status-filter">상태별 필터:</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">전체</SelectItem>
                            <SelectItem value="pending">대기중</SelectItem>
                            <SelectItem value="approved">승인됨</SelectItem>
                            <SelectItem value="rejected">보류됨</SelectItem>
                            <SelectItem value="cancelled">취소됨</SelectItem>
                            <SelectItem value="expired">만료됨</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="ml-auto text-sm text-gray-500">
                        총 {applications.length}개의 신청
                    </div>
                </div>
            </Card>

            {/* 신청 목록 테이블 */}
            <Card>
                <CardHeader>
                    <CardTitle>참여형 마일스톤 신청 내역</CardTitle>
                    <CardDescription>
                        사용자들의 참여형 마일스톤 신청을 검토하고 승인/거절 처리할 수 있습니다.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {applications.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="text-gray-500">
                                {statusFilter === "all" ? "신청 내역이 없습니다." : `${getStatusLabel(statusFilter)} 상태의 신청이 없습니다.`}
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>신청 ID</TableHead>
                                    <TableHead>마일스톤</TableHead>
                                    <TableHead>신청자</TableHead>
                                    <TableHead>상태</TableHead>
                                    <TableHead>신청일시</TableHead>
                                    <TableHead>처리일시</TableHead>
                                    <TableHead>작업</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {applications.map((app: any) => (
                                    <TableRow key={app.id}>
                                        <TableCell className="font-mono">#{app.id}</TableCell>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{app.milestone?.title}</div>
                                                <div className="text-sm text-gray-500">{app.milestone?.description?.slice(0, 50)}...</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{app.user?.username}</div>
                                                <div className="text-sm text-gray-500">{app.user?.email}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={getStatusColor(app.status)}>
                                                {getStatusLabel(app.status)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(app.appliedAt).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            {app.processedAt ? new Date(app.processedAt).toLocaleString() : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleViewDetail(app.id)}
                                                >
                                                    상세보기
                                                </Button>

                                                {/* 상태별 처리 버튼 */}
                                                {app.status === 'pending' && (
                                                    <>
                                                        <Button
                                                            variant="default"
                                                            size="sm"
                                                            onClick={() => handleApproval(app.id, 'approved')}
                                                            disabled={isProcessing}
                                                        >
                                                            승인
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => handleApproval(app.id, 'rejected')}
                                                            disabled={isProcessing}
                                                        >
                                                            보류
                                                        </Button>
                                                    </>
                                                )}

                                                {app.status === 'approved' && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleApproval(app.id, 'cancelled')}
                                                        disabled={isProcessing}
                                                        className="border-orange-300 text-orange-600 hover:bg-orange-50"
                                                    >
                                                        승인 취소
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

        </div>
    );
}
