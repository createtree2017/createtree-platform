import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatSimpleDate } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Trophy,
    Plus,
    Edit,
    Trash2,
    Loader2,
    Grid3X3,
    Gift,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useModalContext } from "@/contexts/ModalContext";

interface BigMission {
    id: number;
    title: string;
    description?: string;
    headerImageUrl?: string;
    iconUrl?: string;
    visibilityType: string;
    hospitalId?: number;
    startDate?: string;
    endDate?: string;
    giftImageUrl?: string;
    giftDescription?: string;
    order: number;
    isActive: boolean;
    topics: BigMissionTopic[];
    hospital?: { id: number; name: string };
}

interface BigMissionTopic {
    id: number;
    bigMissionId: number;
    title: string;
    description?: string;
    iconUrl?: string;
    categoryId: string;
    order: number;
    isActive: boolean;
    category?: { categoryId: string; name: string };
}

interface MissionCategory {
    categoryId: string;
    name: string;
}

const DEFAULT_FORM: Partial<BigMission> = {
    title: "",
    description: "",
    headerImageUrl: "",
    iconUrl: "",
    visibilityType: "public",
    giftImageUrl: "",
    giftDescription: "",
    order: 0,
    isActive: true,
};

const DEFAULT_TOPIC_FORM: Partial<BigMissionTopic> = {
    title: "",
    description: "",
    iconUrl: "",
    categoryId: "",
    order: 0,
    isActive: true,
};

export default function BigMissionManagement() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const modal = useModalContext();

    // Queries
    const { data: missions = [], isLoading } = useQuery<BigMission[]>({
        queryKey: ["/api/admin/big-missions"],
    });

    const { data: categories = [] } = useQuery<MissionCategory[]>({
        queryKey: ["/api/admin/mission-categories"],
    });

    const { data: hospitals = [] } = useQuery<any[]>({
        queryKey: ["/api/hospitals"],
    });

    // Mutations

    const deleteMutation = useMutation({
        mutationFn: (id: number) =>
            apiRequest(`/api/admin/big-missions/${id}`, { method: "DELETE" }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/big-missions"] });
            toast({ title: "큰미션이 삭제되었습니다" });
        },
        onError: () => {
            toast({ title: "삭제 실패", variant: "destructive" });
        },
    });

    const toggleActiveMutation = useMutation({
        mutationFn: (id: number) =>
            apiRequest(`/api/admin/big-missions/${id}/toggle-active`, { method: "PATCH" }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/big-missions"] });
        },
    });

    // Handlers
    const handleOpenCreate = () => {
        modal.openModal('bigMissionForm');
    };

    const handleOpenEdit = (mission: BigMission) => {
        modal.openModal('bigMissionForm', { mission });
    };

    const handleDelete = (id: number) => {
        if (window.confirm("정말 이 큰미션을 삭제하시겠습니까? 관련 토픽도 모두 삭제됩니다.")) {
            deleteMutation.mutate(id);
        }
    };

    const handleOpenTopicSheet = (mission: BigMission) => {
        modal.openModal('bigMissionTopicSheet', { mission });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }



    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    <h2 className="text-xl font-bold">큰미션 관리</h2>
                    <Badge variant="outline">{missions.length}개</Badge>
                </div>
                <Button onClick={handleOpenCreate} className="gap-2">
                    <Plus className="h-4 w-4" />
                    큰미션 추가
                </Button>
            </div>

            {/* 큰미션 목록 테이블 */}
            {missions.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">
                    아직 큰미션이 없습니다. 새 큰미션을 추가해주세요.
                </Card>
            ) : (
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">순서</TableHead>
                                <TableHead>제목</TableHead>
                                <TableHead>슬롯수</TableHead>
                                <TableHead>공개범위</TableHead>
                                <TableHead>기간</TableHead>
                                <TableHead>보상</TableHead>
                                <TableHead>활성</TableHead>
                                <TableHead>관리</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {missions.map((mission) => (
                                <TableRow key={mission.id}>
                                    <TableCell className="text-center">{mission.order}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {mission.headerImageUrl && (
                                                <img
                                                    src={mission.headerImageUrl}
                                                    alt=""
                                                    className="w-8 h-8 rounded object-cover"
                                                />
                                            )}
                                            <span className="font-medium">{mission.title}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{mission.topics?.length || 0}개</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                mission.visibilityType === "public"
                                                    ? "default"
                                                    : mission.visibilityType === "hospital"
                                                        ? "secondary"
                                                        : "outline"
                                            }
                                        >
                                            {mission.visibilityType === "public"
                                                ? "전체"
                                                : mission.visibilityType === "hospital"
                                                    ? "병원"
                                                    : "개발"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {mission.startDate && formatSimpleDate(mission.startDate)}
                                        {mission.startDate && mission.endDate && " ~ "}
                                        {mission.endDate && formatSimpleDate(mission.endDate)}
                                        {!mission.startDate && !mission.endDate && "-"}
                                    </TableCell>
                                    <TableCell>
                                        {mission.giftDescription || mission.giftImageUrl ? (
                                            <Gift className="h-4 w-4 text-amber-500" />
                                        ) : (
                                            "-"
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={mission.isActive}
                                            onCheckedChange={() => toggleActiveMutation.mutate(mission.id)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleOpenTopicSheet(mission)}
                                                title="토픽 슬롯 관리"
                                            >
                                                <Grid3X3 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleOpenEdit(mission)}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(mission.id)}
                                            >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}

        </div>
    );
}
