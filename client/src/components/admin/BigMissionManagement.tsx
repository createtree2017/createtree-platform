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

    // States
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingMission, setEditingMission] = useState<BigMission | null>(null);
    const [formData, setFormData] = useState<Partial<BigMission>>(DEFAULT_FORM);
    const [topicSheetMission, setTopicSheetMission] = useState<BigMission | null>(null);
    const [isTopicDialogOpen, setIsTopicDialogOpen] = useState(false);
    const [editingTopic, setEditingTopic] = useState<BigMissionTopic | null>(null);
    const [topicFormData, setTopicFormData] = useState<Partial<BigMissionTopic>>(DEFAULT_TOPIC_FORM);

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
    const createMutation = useMutation({
        mutationFn: (data: Partial<BigMission>) =>
            apiRequest("/api/admin/big-missions", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/big-missions"] });
            setIsCreateDialogOpen(false);
            setFormData(DEFAULT_FORM);
            toast({ title: "큰미션이 생성되었습니다" });
        },
        onError: () => {
            toast({ title: "생성 실패", variant: "destructive" });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<BigMission> }) =>
            apiRequest(`/api/admin/big-missions/${id}`, {
                method: "PUT",
                body: JSON.stringify(data),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/big-missions"] });
            setEditingMission(null);
            setFormData(DEFAULT_FORM);
            toast({ title: "큰미션이 수정되었습니다" });
        },
        onError: () => {
            toast({ title: "수정 실패", variant: "destructive" });
        },
    });

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

    // Topic mutations
    const createTopicMutation = useMutation({
        mutationFn: ({ bigMissionId, data }: { bigMissionId: number; data: Partial<BigMissionTopic> }) =>
            apiRequest(`/api/admin/big-missions/${bigMissionId}/topics`, {
                method: "POST",
                body: JSON.stringify(data),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/big-missions"] });
            setIsTopicDialogOpen(false);
            setTopicFormData(DEFAULT_TOPIC_FORM);
            toast({ title: "토픽이 추가되었습니다" });
        },
        onError: () => {
            toast({ title: "토픽 추가 실패", variant: "destructive" });
        },
    });

    const updateTopicMutation = useMutation({
        mutationFn: ({ bigMissionId, topicId, data }: { bigMissionId: number; topicId: number; data: Partial<BigMissionTopic> }) =>
            apiRequest(`/api/admin/big-missions/${bigMissionId}/topics/${topicId}`, {
                method: "PUT",
                body: JSON.stringify(data),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/big-missions"] });
            setIsTopicDialogOpen(false);
            setEditingTopic(null);
            setTopicFormData(DEFAULT_TOPIC_FORM);
            toast({ title: "토픽이 수정되었습니다" });
        },
        onError: () => {
            toast({ title: "토픽 수정 실패", variant: "destructive" });
        },
    });

    const deleteTopicMutation = useMutation({
        mutationFn: ({ bigMissionId, topicId }: { bigMissionId: number; topicId: number }) =>
            apiRequest(`/api/admin/big-missions/${bigMissionId}/topics/${topicId}`, { method: "DELETE" }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/big-missions"] });
            toast({ title: "토픽이 삭제되었습니다" });
        },
        onError: () => {
            toast({ title: "토픽 삭제 실패", variant: "destructive" });
        },
    });

    // Handlers
    const handleOpenCreate = () => {
        setFormData(DEFAULT_FORM);
        setIsCreateDialogOpen(true);
    };

    const handleOpenEdit = (mission: BigMission) => {
        setFormData({
            title: mission.title,
            description: mission.description || "",
            headerImageUrl: mission.headerImageUrl || "",
            iconUrl: mission.iconUrl || "",
            visibilityType: mission.visibilityType,
            hospitalId: mission.hospitalId,
            startDate: mission.startDate ? new Date(mission.startDate).toISOString().split("T")[0] : "",
            endDate: mission.endDate ? new Date(mission.endDate).toISOString().split("T")[0] : "",
            giftImageUrl: mission.giftImageUrl || "",
            giftDescription: mission.giftDescription || "",
            order: mission.order,
            isActive: mission.isActive,
        } as any);
        setEditingMission(mission);
    };

    const handleSave = () => {
        if (editingMission) {
            updateMutation.mutate({ id: editingMission.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleDelete = (id: number) => {
        if (window.confirm("정말 이 큰미션을 삭제하시겠습니까? 관련 토픽도 모두 삭제됩니다.")) {
            deleteMutation.mutate(id);
        }
    };

    const handleOpenTopicSheet = (mission: BigMission) => {
        setTopicSheetMission(mission);
    };

    const handleOpenTopicCreate = () => {
        setTopicFormData(DEFAULT_TOPIC_FORM);
        setEditingTopic(null);
        setIsTopicDialogOpen(true);
    };

    const handleOpenTopicEdit = (topic: BigMissionTopic) => {
        setTopicFormData({
            title: topic.title,
            description: topic.description || "",
            iconUrl: topic.iconUrl || "",
            categoryId: topic.categoryId,
            order: topic.order,
            isActive: topic.isActive,
        });
        setEditingTopic(topic);
        setIsTopicDialogOpen(true);
    };

    const handleSaveTopic = () => {
        if (!topicSheetMission) return;
        if (editingTopic) {
            updateTopicMutation.mutate({
                bigMissionId: topicSheetMission.id,
                topicId: editingTopic.id,
                data: topicFormData,
            });
        } else {
            createTopicMutation.mutate({
                bigMissionId: topicSheetMission.id,
                data: topicFormData,
            });
        }
    };

    const handleDeleteTopic = (bigMissionId: number, topicId: number) => {
        if (window.confirm("이 토픽을 삭제하시겠습니까?")) {
            deleteTopicMutation.mutate({ bigMissionId, topicId });
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const renderForm = () => (
        <div className="space-y-4">
            <div>
                <Label>제목 *</Label>
                <Input
                    value={(formData as any).title || ""}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="산전 컬렉션"
                />
            </div>
            <div>
                <Label>설명</Label>
                <Textarea
                    value={(formData as any).description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="산전 건강관리를 위한 미션 컬렉션"
                    rows={3}
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>헤더 이미지 URL</Label>
                    <Input
                        value={(formData as any).headerImageUrl || ""}
                        onChange={(e) => setFormData({ ...formData, headerImageUrl: e.target.value })}
                        placeholder="https://..."
                    />
                </div>
                <div>
                    <Label>아이콘 URL (없으면 공용아이콘)</Label>
                    <Input
                        value={(formData as any).iconUrl || ""}
                        onChange={(e) => setFormData({ ...formData, iconUrl: e.target.value })}
                        placeholder="https://..."
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>시작일</Label>
                    <Input
                        type="date"
                        value={(formData as any).startDate || ""}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value } as any)}
                    />
                </div>
                <div>
                    <Label>종료일</Label>
                    <Input
                        type="date"
                        value={(formData as any).endDate || ""}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value } as any)}
                    />
                </div>
            </div>
            <div>
                <Label>공개범위</Label>
                <Select
                    value={(formData as any).visibilityType || "public"}
                    onValueChange={(value) => {
                        const updates: any = { ...formData, visibilityType: value };
                        if (value !== "hospital") {
                            updates.hospitalId = null;
                        }
                        setFormData(updates);
                    }}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="public">전체 공개</SelectItem>
                        <SelectItem value="hospital">병원 전용</SelectItem>
                        <SelectItem value="dev">개발용</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            {(formData as any).visibilityType === "hospital" && (
                <div>
                    <Label>병원 선택 *</Label>
                    <Select
                        value={(formData as any).hospitalId?.toString() || ""}
                        onValueChange={(value) => setFormData({ ...formData, hospitalId: parseInt(value) } as any)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="병원을 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                            {hospitals.map((hospital: any) => (
                                <SelectItem key={hospital.id} value={hospital.id.toString()}>
                                    {hospital.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>보상 이미지 URL</Label>
                    <Input
                        value={(formData as any).giftImageUrl || ""}
                        onChange={(e) => setFormData({ ...formData, giftImageUrl: e.target.value })}
                        placeholder="https://..."
                    />
                </div>
                <div>
                    <Label>보상 설명</Label>
                    <Input
                        value={(formData as any).giftDescription || ""}
                        onChange={(e) => setFormData({ ...formData, giftDescription: e.target.value })}
                        placeholder="산전 선물세트"
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>정렬 순서</Label>
                    <Input
                        type="number"
                        value={(formData as any).order || 0}
                        onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                    />
                </div>
                <div className="flex items-center gap-2 pt-6">
                    <Switch
                        checked={(formData as any).isActive !== false}
                        onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    />
                    <Label>활성화</Label>
                </div>
            </div>
        </div>
    );

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

            {/* 생성 다이얼로그 */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>큰미션 생성</DialogTitle>
                    </DialogHeader>
                    {renderForm()}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                            취소
                        </Button>
                        <Button onClick={handleSave} disabled={createMutation.isPending}>
                            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            생성
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 편집 다이얼로그 */}
            <Dialog open={!!editingMission} onOpenChange={(open) => !open && setEditingMission(null)}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>큰미션 수정</DialogTitle>
                    </DialogHeader>
                    {renderForm()}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingMission(null)}>
                            취소
                        </Button>
                        <Button onClick={handleSave} disabled={updateMutation.isPending}>
                            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            저장
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 토픽 관리 시트 */}
            <Sheet open={!!topicSheetMission} onOpenChange={(open) => !open && setTopicSheetMission(null)}>
                <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                            <Grid3X3 className="h-5 w-5" />
                            {topicSheetMission?.title} - 토픽 슬롯
                        </SheetTitle>
                    </SheetHeader>

                    <div className="mt-6 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                                {topicSheetMission?.topics?.length || 0}개 토픽
                            </span>
                            <Button size="sm" onClick={handleOpenTopicCreate} className="gap-1">
                                <Plus className="h-4 w-4" />
                                토픽 추가
                            </Button>
                        </div>

                        {topicSheetMission?.topics?.map((topic) => (
                            <Card key={topic.id} className="p-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                        {topic.iconUrl ? (
                                            <img src={topic.iconUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <Trophy className="h-5 w-5 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm">{topic.title}</div>
                                        <div className="text-xs text-muted-foreground">
                                            카테고리: {topic.category?.name || topic.categoryId}
                                        </div>
                                        {topic.description && (
                                            <div className="text-xs text-muted-foreground truncate">
                                                {topic.description}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                        <Button variant="ghost" size="sm" onClick={() => handleOpenTopicEdit(topic)}>
                                            <Edit className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteTopic(topicSheetMission!.id, topic.id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}

                        {(!topicSheetMission?.topics || topicSheetMission.topics.length === 0) && (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                아직 토픽이 없습니다. 토픽을 추가하여 카테고리와 연결해주세요.
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* 토픽 생성/편집 다이얼로그 */}
            <Dialog open={isTopicDialogOpen} onOpenChange={setIsTopicDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingTopic ? "토픽 수정" : "토픽 추가"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>토픽 이름 *</Label>
                            <Input
                                value={topicFormData.title || ""}
                                onChange={(e) => setTopicFormData({ ...topicFormData, title: e.target.value })}
                                placeholder="출산교실 참여"
                            />
                        </div>
                        <div>
                            <Label>설명</Label>
                            <Textarea
                                value={topicFormData.description || ""}
                                onChange={(e) => setTopicFormData({ ...topicFormData, description: e.target.value })}
                                placeholder="출산교실 관련 미션 1개 이상 완료"
                                rows={2}
                            />
                        </div>
                        <div>
                            <Label>아이콘 URL (없으면 공용아이콘)</Label>
                            <Input
                                value={topicFormData.iconUrl || ""}
                                onChange={(e) => setTopicFormData({ ...topicFormData, iconUrl: e.target.value })}
                                placeholder="https://..."
                            />
                        </div>
                        <div>
                            <Label>카테고리 연결 *</Label>
                            <Select
                                value={topicFormData.categoryId || ""}
                                onValueChange={(value) => setTopicFormData({ ...topicFormData, categoryId: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="카테고리 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat.categoryId} value={cat.categoryId}>
                                            {cat.name} ({cat.categoryId})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">
                                이 카테고리에 속한 주제미션 중 1개 이상 완료 시 토픽이 체크됩니다
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>정렬 순서</Label>
                                <Input
                                    type="number"
                                    value={topicFormData.order || 0}
                                    onChange={(e) =>
                                        setTopicFormData({ ...topicFormData, order: parseInt(e.target.value) || 0 })
                                    }
                                />
                            </div>
                            <div className="flex items-center gap-2 pt-6">
                                <Switch
                                    checked={topicFormData.isActive !== false}
                                    onCheckedChange={(checked) =>
                                        setTopicFormData({ ...topicFormData, isActive: checked })
                                    }
                                />
                                <Label>활성화</Label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsTopicDialogOpen(false);
                                setEditingTopic(null);
                            }}
                        >
                            취소
                        </Button>
                        <Button
                            onClick={handleSaveTopic}
                            disabled={createTopicMutation.isPending || updateTopicMutation.isPending}
                        >
                            {(createTopicMutation.isPending || updateTopicMutation.isPending) && (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            )}
                            {editingTopic ? "저장" : "추가"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
