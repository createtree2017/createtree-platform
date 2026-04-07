import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatSimpleDate } from "@/lib/dateUtils";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface RewardApplication {
    id: number;
    userId: number;
    bigMissionId: number;
    rewardStatus: string;
    rewardAppliedAt: string;
    rewardProcessedAt: string | null;
    missionTitle: string;
    giftImageUrl: string | null;
    giftDescription: string | null;
    giftItems: {imageUrl?: string; description?: string}[] | null;
    userName: string;
    userPhone: string | null;
    userEmail: string;
    hospitalName: string | null;
}

export default function RewardApplicationManagement() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // 상태 필터 및 미션명 필터
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [missionTitleFilter, setMissionTitleFilter] = useState<string>(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            return params.get("missionTitle") || "all";
        }
        return "all";
    });
    
    // 모달을 띄울 선택된 선물 내역
    const [selectedGiftApp, setSelectedGiftApp] = useState<RewardApplication | null>(null);

    const { data: applications = [], isLoading } = useQuery<RewardApplication[]>({
        queryKey: ["/api/admin/big-missions/rewards/applications"],
        queryFn: async () => {
            const res = await fetch("/api/admin/big-missions/rewards/applications");
            if (!res.ok) throw new Error("Failed to fetch applications");
            return res.json();
        }
    });

    const approveMutation = useMutation({
        mutationFn: async (progressId: number) => {
            const res = await fetch(`/api/admin/big-missions/rewards/${progressId}/approve`, {
                method: "POST"
            });
            if (!res.ok) throw new Error("Failed to approve");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "보상 지급 처리가 완료되었습니다." });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/big-missions/rewards/applications"] });
        },
        onError: () => {
            toast({ title: "보상 지급 처리에 실패했습니다.", variant: "destructive" });
        }
    });

    const handleApprove = (progressId: number) => {
        if (window.confirm("이 신청건에 대해 보상 지급 완료 처리를 하시겠습니까?")) {
            approveMutation.mutate(progressId);
        }
    };

    // 고유 미션명 추출 (필터용)
    const uniqueMissionTitles = useMemo(() => {
        const titles = new Set(applications.map(app => app.missionTitle));
        return Array.from(titles);
    }, [applications]);

    // 필터 적용
    const filteredApplications = useMemo(() => {
        return applications.filter(app => {
            if (statusFilter !== "all" && app.rewardStatus !== statusFilter) return false;
            if (missionTitleFilter !== "all" && app.missionTitle !== missionTitleFilter) return false;
            return true;
        });
    }, [applications, statusFilter, missionTitleFilter]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold">보상 신청 관리</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        큰미션 100% 달성 사용자의 리워드 신청 내역을 확인하고 승인합니다.
                    </p>
                </div>
                
                {/* 필터 영역 */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <Select value={missionTitleFilter} onValueChange={setMissionTitleFilter}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="모든 미션명" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">모든 미션명 ({applications.length})</SelectItem>
                            {uniqueMissionTitles.map(title => (
                                <SelectItem key={title} value={title}>{title}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="모든 상태" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">모든 상태</SelectItem>
                            <SelectItem value="pending">신청 (검수 대기)</SelectItem>
                            <SelectItem value="approved">지급 완료</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>신청일</TableHead>
                            <TableHead>사용자</TableHead>
                            <TableHead>미션명</TableHead>
                            <TableHead>상태</TableHead>
                            <TableHead className="text-right">관리</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredApplications.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    설정된 조건에 맞는 신청 내역이 없습니다.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredApplications.map((app) => (
                                <TableRow key={app.id}>
                                    <TableCell>
                                        {formatSimpleDate(app.rewardAppliedAt || new Date().toISOString())}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{app.userName || '알 수 없음'}</span>
                                            {app.hospitalName && (
                                                <Badge variant="secondary" className="text-xs">
                                                    {app.hospitalName}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{app.userEmail}</div>
                                        {app.userPhone && <div className="text-xs text-muted-foreground">{app.userPhone}</div>}
                                    </TableCell>
                                    <TableCell>{app.missionTitle}</TableCell>
                                    <TableCell>
                                        {app.rewardStatus === 'pending' ? (
                                            <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200">신청 (검수 대기)</Badge>
                                        ) : app.rewardStatus === 'approved' ? (
                                            <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">지급 완료</Badge>
                                        ) : (
                                            <Badge variant="outline">{app.rewardStatus}</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2 items-center">
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                onClick={() => setSelectedGiftApp(app)}
                                                className="hidden sm:flex border-amber-200 text-amber-700 hover:bg-amber-50"
                                            >
                                                <Gift className="h-4 w-4 sm:mr-1" />
                                                <span className="hidden sm:inline">선물 확인</span>
                                            </Button>

                                            {app.rewardStatus === 'pending' && (
                                                <Button 
                                                    size="sm" 
                                                    className="bg-green-600 hover:bg-green-700 text-white"
                                                    onClick={() => handleApprove(app.id)}
                                                    disabled={approveMutation.isPending}
                                                >
                                                    <CheckCircle2 className="h-4 w-4 sm:mr-1" />
                                                    <span className="hidden sm:inline">지급완료 처리</span>
                                                </Button>
                                            )}
                                            {app.rewardStatus === 'approved' && (
                                                <div className="text-xs text-muted-foreground text-center">
                                                    {formatSimpleDate(app.rewardProcessedAt!)}<br />완료됨
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* 선물 확인 모달 */}
            <Dialog open={!!selectedGiftApp} onOpenChange={(open) => !open && setSelectedGiftApp(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Gift className="h-5 w-5 text-amber-500" />
                            보상 선물 확인
                        </DialogTitle>
                        <DialogDescription>
                            이 미션을 완료한 사용자에게 지급되는 선물입니다.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedGiftApp && (
                        <div className="space-y-4 py-4">
                            <div className="p-4 bg-muted/50 rounded-lg border">
                                <p className="font-semibold text-sm mb-2 text-muted-foreground">미션 정보</p>
                                <p className="font-medium">{selectedGiftApp.missionTitle}</p>
                            </div>

                            <div className="space-y-4">
                                <p className="font-semibold text-sm text-muted-foreground mb-2">지급될 선물 내역</p>
                                
                                {((!selectedGiftApp.giftItems || selectedGiftApp.giftItems.length === 0) && !selectedGiftApp.giftImageUrl && !selectedGiftApp.giftDescription) ? (
                                    <div className="text-center py-6 text-muted-foreground bg-accent/50 rounded-lg">
                                        설정된 선물 정보가 없습니다.
                                    </div>
                                ) : (
                                    <>
                                        {/* 멀티 아이템 */}
                                        {selectedGiftApp.giftItems && selectedGiftApp.giftItems.length > 0 ? (
                                            selectedGiftApp.giftItems.map((gift, idx) => (
                                                <div key={idx} className="flex items-center gap-4 border p-3 rounded-lg bg-background">
                                                    {gift.imageUrl && (
                                                        <div className="w-16 h-16 shrink-0 rounded-md overflow-hidden bg-muted">
                                                            <img 
                                                                src={gift.imageUrl} 
                                                                alt={`선물 ${idx+1}`} 
                                                                className="w-full h-full object-cover" 
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="flex-1">
                                                        <p className="font-medium text-sm">
                                                            {gift.description || "상세 설명 없음"}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            /* 레거시 단일 아이템 */
                                            <div className="flex items-center gap-4 border p-3 rounded-lg bg-background">
                                                {selectedGiftApp.giftImageUrl && (
                                                    <div className="w-16 h-16 shrink-0 rounded-md overflow-hidden bg-muted">
                                                        <img 
                                                            src={selectedGiftApp.giftImageUrl} 
                                                            alt="기본 선물" 
                                                            className="w-full h-full object-cover" 
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">
                                                        {selectedGiftApp.giftDescription || "상세 설명 없음 (공용 선물)"}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end">
                        <Button onClick={() => setSelectedGiftApp(null)}>닫기</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
