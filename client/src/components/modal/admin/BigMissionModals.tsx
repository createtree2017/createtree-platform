import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useModalContext } from "@/contexts/ModalContext";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Grid3X3, Plus, Trophy, Edit, Trash2, Upload, X } from "lucide-react";

// Types from BigMissionManagement
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
    growthEnabled?: boolean;
    growthTreeName?: string;
    growthStageImages?: string[];
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
    growthEnabled: false,
    growthTreeName: "사과몽",
    growthStageImages: [],
};

const DEFAULT_TOPIC_FORM: Partial<BigMissionTopic> = {
    title: "",
    description: "",
    iconUrl: "",
    categoryId: "",
    order: 0,
    isActive: true,
};

// 1. BigMissionFormModal
export function BigMissionFormModal({
    isOpen,
    onClose,
    mission,
}: {
    isOpen?: boolean;
    onClose?: () => void;
    mission?: BigMission;
}) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const modal = useModalContext();
    const [formData, setFormData] = useState<Partial<BigMission>>(DEFAULT_FORM);

    // 이미지 업로더 state (헤더/아이콘/보상)
    const [headerPreview, setHeaderPreview] = useState<string | null>(null);
    const [iconPreview, setIconPreview] = useState<string | null>(null);
    const [giftPreview, setGiftPreview] = useState<string | null>(null);
    const [uploadingField, setUploadingField] = useState<string | null>(null);
    const headerFileRef = useRef<HTMLInputElement>(null);
    const iconFileRef = useRef<HTMLInputElement>(null);
    const giftFileRef = useRef<HTMLInputElement>(null);

    const { data: hospitals = [] } = useQuery<any[]>({
        queryKey: ["/api/hospitals"],
    });

    useEffect(() => {
        if (isOpen) {
            if (mission) {
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
                    growthEnabled: mission.growthEnabled ?? false,
                    growthTreeName: mission.growthTreeName || "사과몽",
                    growthStageImages: mission.growthStageImages || [],
                });
                setHeaderPreview(mission.headerImageUrl || null);
                setIconPreview(mission.iconUrl || null);
                setGiftPreview(mission.giftImageUrl || null);
            } else {
                setFormData(DEFAULT_FORM);
                setHeaderPreview(null);
                setIconPreview(null);
                setGiftPreview(null);
            }
            [headerFileRef, iconFileRef, giftFileRef].forEach(r => { if (r.current) r.current.value = ""; });
        }
    }, [isOpen, mission]);

    // 공통 업로드 핸들러
    const handleImageUpload = async (
        e: React.ChangeEvent<HTMLInputElement>,
        field: "headerImageUrl" | "iconUrl" | "giftImageUrl",
        setPreview: (v: string | null) => void,
        fallbackUrl: string | undefined
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setPreview(reader.result as string);
        reader.readAsDataURL(file);
        setUploadingField(field);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
            if (!res.ok) throw new Error("업로드 실패");
            const data = await res.json();
            setFormData(prev => ({ ...prev, [field]: data.url }));
            toast({ title: "이미지 업로드 완료" });
        } catch {
            toast({ title: "업로드 실패", description: "이미지 업로드 중 오류가 발생했습니다.", variant: "destructive" });
            setPreview(fallbackUrl || null);
        } finally {
            setUploadingField(null);
        }
    };

    const removeImage = (field: "headerImageUrl" | "iconUrl" | "giftImageUrl", setPreview: (v: string | null) => void, ref: React.RefObject<HTMLInputElement>) => {
        setPreview(null);
        setFormData(prev => ({ ...prev, [field]: "" }));
        if (ref.current) ref.current.value = "";
    };

    const createMutation = useMutation({
        mutationFn: (data: Partial<BigMission>) =>
            apiRequest("/api/admin/big-missions", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/big-missions"] });
            toast({ title: "큰미션이 생성되었습니다" });
            modal.closeTopModal ? modal.closeTopModal() : onClose?.();
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
            toast({ title: "큰미션이 수정되었습니다" });
            modal.closeTopModal ? modal.closeTopModal() : onClose?.();
        },
        onError: () => {
            toast({ title: "수정 실패", variant: "destructive" });
        },
    });

    const handleSave = () => {
        if (mission) {
            updateMutation.mutate({ id: mission.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const isPending = createMutation.isPending || updateMutation.isPending;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && (modal.closeTopModal ? modal.closeTopModal() : onClose?.())}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{mission ? "큰미션 수정" : "큰미션 생성"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <Label>제목 *</Label>
                        <Input
                            value={formData.title || ""}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="산전 컬렉션"
                        />
                    </div>
                    <div>
                        <Label>설명</Label>
                        <Textarea
                            value={formData.description || ""}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="산전 건강관리를 위한 미션 컬렉션"
                            rows={3}
                        />
                    </div>
                    {/* 헤더 이미지 업로더 - 가로 배너형 */}
                    <div>
                        <Label>헤더 이미지</Label>
                        <div
                            className="relative w-full h-28 bg-muted rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary transition-colors mt-1"
                            onClick={() => uploadingField !== "headerImageUrl" && headerFileRef.current?.click()}
                        >
                            {uploadingField === "headerImageUrl" ? (
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            ) : headerPreview ? (
                                <img src={headerPreview} alt="헤더 미리보기" className="w-full h-full object-cover" />
                            ) : (
                                <div className="flex flex-col items-center text-muted-foreground gap-1">
                                    <Upload className="h-6 w-6" />
                                    <span className="text-xs">헤더 이미지 업로드 (클릭)</span>
                                </div>
                            )}
                        </div>
                        <input ref={headerFileRef} type="file" accept="image/*" className="hidden"
                            onChange={(e) => handleImageUpload(e, "headerImageUrl", setHeaderPreview, mission?.headerImageUrl)} />
                        {headerPreview && (
                            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground mt-1"
                                onClick={() => removeImage("headerImageUrl", setHeaderPreview, headerFileRef)}>
                                <X className="h-3 w-3 mr-1" />제거
                            </Button>
                        )}
                    </div>
                    {/* 아이콘 + 보상 이미지 - 2열 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>아이콘 이미지 (없으면 공용아이콘)</Label>
                            <div className="flex items-center gap-2 mt-1">
                                <div
                                    className="w-14 h-14 bg-muted rounded-full overflow-hidden border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary transition-colors flex-shrink-0"
                                    onClick={() => uploadingField !== "iconUrl" && iconFileRef.current?.click()}
                                >
                                    {uploadingField === "iconUrl" ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    ) : iconPreview ? (
                                        <img src={iconPreview} alt="아이콘 미리보기" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex flex-col items-center text-muted-foreground">
                                            <Upload className="h-3 w-3" />
                                            <span className="text-[9px] mt-0.5">업로드</span>
                                        </div>
                                    )}
                                </div>
                                <input ref={iconFileRef} type="file" accept="image/*" className="hidden"
                                    onChange={(e) => handleImageUpload(e, "iconUrl", setIconPreview, mission?.iconUrl)} />
                                <div className="flex flex-col gap-1">
                                    <Button type="button" variant="outline" size="sm"
                                        disabled={uploadingField === "iconUrl"}
                                        onClick={() => iconFileRef.current?.click()}>
                                        {uploadingField === "iconUrl" ? "업로드 중..." : "선택"}
                                    </Button>
                                    {iconPreview && (
                                        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground"
                                            onClick={() => removeImage("iconUrl", setIconPreview, iconFileRef)}>
                                            <X className="h-3 w-3 mr-1" />제거
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div>
                            <Label>보상 이미지</Label>
                            <div className="flex items-center gap-2 mt-1">
                                <div
                                    className="w-14 h-14 bg-muted rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary transition-colors flex-shrink-0"
                                    onClick={() => uploadingField !== "giftImageUrl" && giftFileRef.current?.click()}
                                >
                                    {uploadingField === "giftImageUrl" ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    ) : giftPreview ? (
                                        <img src={giftPreview} alt="보상 미리보기" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex flex-col items-center text-muted-foreground">
                                            <Upload className="h-3 w-3" />
                                            <span className="text-[9px] mt-0.5">업로드</span>
                                        </div>
                                    )}
                                </div>
                                <input ref={giftFileRef} type="file" accept="image/*" className="hidden"
                                    onChange={(e) => handleImageUpload(e, "giftImageUrl", setGiftPreview, mission?.giftImageUrl)} />
                                <div className="flex flex-col gap-1">
                                    <Button type="button" variant="outline" size="sm"
                                        disabled={uploadingField === "giftImageUrl"}
                                        onClick={() => giftFileRef.current?.click()}>
                                        {uploadingField === "giftImageUrl" ? "업로드 중..." : "선택"}
                                    </Button>
                                    {giftPreview && (
                                        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground"
                                            onClick={() => removeImage("giftImageUrl", setGiftPreview, giftFileRef)}>
                                            <X className="h-3 w-3 mr-1" />제거
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>시작일</Label>
                            <Input
                                type="date"
                                value={formData.startDate || ""}
                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label>종료일</Label>
                            <Input
                                type="date"
                                value={formData.endDate || ""}
                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                            />
                        </div>
                    </div>
                    <div>
                        <Label>공개범위</Label>
                        <Select
                            value={formData.visibilityType || "public"}
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
                    {formData.visibilityType === "hospital" && (
                        <div>
                            <Label>병원 선택 *</Label>
                            <Select
                                value={formData.hospitalId?.toString() || ""}
                                onValueChange={(value) => setFormData({ ...formData, hospitalId: parseInt(value) })}
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
                    <div>
                        <Label>보상 설명</Label>
                        <Input
                            value={formData.giftDescription || ""}
                            onChange={(e) => setFormData({ ...formData, giftDescription: e.target.value })}
                            placeholder="산전 선물세트"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>정렬 순서</Label>
                            <Input
                                type="number"
                                value={formData.order || 0}
                                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                            <Switch
                                checked={formData.isActive !== false}
                                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                            />
                            <Label>활성화</Label>
                        </div>
                    </div>
                    {/* ===== 성장 애니메이션 설정 ===== */}
                    <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-base font-semibold">🌱 성장 애니메이션</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">토픽 완료 수에 따라 캐릭터가 성장하는 애니메이션 설정</p>
                            </div>
                            <Switch
                                checked={formData.growthEnabled ?? false}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, growthEnabled: checked }))}
                            />
                        </div>

                        {formData.growthEnabled && (
                            <>
                                {/* 캐릭터 이름 */}
                                <div>
                                    <Label>캐릭터 이름</Label>
                                    <Input
                                        value={formData.growthTreeName || ""}
                                        onChange={(e) => setFormData(prev => ({ ...prev, growthTreeName: e.target.value }))}
                                        placeholder="사과몽"
                                        className="mt-1"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">예: 쑥쑥 자라는 {formData.growthTreeName || "사과몽"}</p>
                                </div>

                                {/* 단계별 이미지 */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <Label>단계별 이미지 ({(formData.growthStageImages || []).length}/10)</Label>
                                        {(formData.growthStageImages || []).length < 10 && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setFormData(prev => ({ ...prev, growthStageImages: [...(prev.growthStageImages || []), ""] }))}
                                            >
                                                + 단계 추가
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-3">1단계부터 순서대로 이미지를 업로드하세요. 토픽 완료 비율에 따라 자동으로 단계가 올라갑니다.</p>
                                    <div className="space-y-2">
                                        {(formData.growthStageImages || []).map((imgUrl, idx) => (
                                            <div key={idx} className="flex items-center gap-2 p-2 border rounded-md bg-background">
                                                <span className="text-xs font-bold text-muted-foreground w-8 flex-shrink-0">Lv.{idx + 1}</span>
                                                {/* 미리보기 */}
                                                <div
                                                    className="w-10 h-10 flex-shrink-0 rounded bg-muted border flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary"
                                                    onClick={() => {
                                                        const input = document.getElementById(`growth-stage-input-${idx}`) as HTMLInputElement;
                                                        input?.click();
                                                    }}
                                                >
                                                    {uploadingField === `growth-${idx}` ? (
                                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                    ) : imgUrl ? (
                                                        <img src={imgUrl} alt={`stage-${idx}`} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Upload className="h-3 w-3 text-muted-foreground" />
                                                    )}
                                                </div>
                                                <input
                                                    id={`growth-stage-input-${idx}`}
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        setUploadingField(`growth-${idx}`);
                                                        try {
                                                            const fd = new FormData();
                                                            fd.append("file", file);
                                                            const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
                                                            if (!res.ok) throw new Error("업로드 실패");
                                                            const data = await res.json();
                                                            setFormData(prev => {
                                                                const images = [...(prev.growthStageImages || [])];
                                                                images[idx] = data.url;
                                                                return { ...prev, growthStageImages: images };
                                                            });
                                                            toast({ title: `Lv.${idx + 1} 이미지 업로드 완료` });
                                                        } catch {
                                                            toast({ title: "업로드 실패", variant: "destructive" });
                                                        } finally {
                                                            setUploadingField(null);
                                                        }
                                                    }}
                                                />
                                                <span className="text-xs text-muted-foreground flex-1 truncate">{imgUrl ? "업로드 완료" : "이미지 없음"}</span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive h-7 w-7 p-0 flex-shrink-0"
                                                    onClick={() => setFormData(prev => {
                                                        const images = [...(prev.growthStageImages || [])];
                                                        images.splice(idx, 1);
                                                        return { ...prev, growthStageImages: images };
                                                    })}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                        {(formData.growthStageImages || []).length === 0 && (
                                            <p className="text-xs text-center text-muted-foreground py-4 border rounded-md border-dashed">
                                                + 단계 추가 버튼으로 이미지를 추가하세요
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => modal.closeTopModal ? modal.closeTopModal() : onClose?.()}>
                        취소
                    </Button>
                    <Button onClick={handleSave} disabled={isPending}>
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {mission ? "저장" : "생성"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// 2. BigMissionTopicSheet
export function BigMissionTopicSheet({
    isOpen,
    onClose,
    mission,
}: {
    isOpen?: boolean;
    onClose?: () => void;
    mission: BigMission;
}) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const modal = useModalContext();

    // Use query to get fresh data instead of using cached mission topics directly if need to be reactive
    const { data: missions = [] } = useQuery<BigMission[]>({
        queryKey: ["/api/admin/big-missions"],
    });

    const activeMission = missions.find(m => m.id === mission?.id) || mission;

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

    const handleOpenTopicCreate = () => {
        modal.openModal('bigMissionTopicForm', { bigMissionId: activeMission.id });
    };

    const handleOpenTopicEdit = (topic: BigMissionTopic) => {
        modal.openModal('bigMissionTopicForm', { bigMissionId: activeMission.id, topic });
    };

    const handleDeleteTopic = (bigMissionId: number, topicId: number) => {
        if (window.confirm("이 토픽을 삭제하시겠습니까?")) {
            deleteTopicMutation.mutate({ bigMissionId, topicId });
        }
    };

    if (!activeMission) return null;

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && (modal.closeTopModal ? modal.closeTopModal() : onClose?.())}>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <Grid3X3 className="h-5 w-5" />
                        {activeMission.title} - 토픽 슬롯
                    </SheetTitle>
                </SheetHeader>

                <div className="mt-6 space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                            {activeMission.topics?.length || 0}개 토픽
                        </span>
                        <Button size="sm" onClick={handleOpenTopicCreate} className="gap-1">
                            <Plus className="h-4 w-4" />
                            토픽 추가
                        </Button>
                    </div>

                    {activeMission.topics?.map((topic) => (
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
                                        onClick={() => handleDeleteTopic(activeMission.id, topic.id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}

                    {(!activeMission.topics || activeMission.topics.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            아직 토픽이 없습니다. 토픽을 추가하여 카테고리와 연결해주세요.
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}

// 3. BigMissionTopicFormModal
export function BigMissionTopicFormModal({
    isOpen,
    onClose,
    bigMissionId,
    topic,
}: {
    isOpen?: boolean;
    onClose?: () => void;
    bigMissionId: number;
    topic?: BigMissionTopic;
}) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const modal = useModalContext();
    const [topicFormData, setTopicFormData] = useState<Partial<BigMissionTopic>>(DEFAULT_TOPIC_FORM);
    const [iconPreview, setIconPreview] = useState<string | null>(null);
    const [isIconUploading, setIsIconUploading] = useState(false);
    const iconFileInputRef = useRef<HTMLInputElement>(null);

    const { data: categories = [] } = useQuery<MissionCategory[]>({
        queryKey: ["/api/admin/mission-categories"],
    });

    useEffect(() => {
        if (isOpen) {
            if (topic) {
                setTopicFormData({
                    title: topic.title,
                    description: topic.description || "",
                    iconUrl: topic.iconUrl || "",
                    categoryId: topic.categoryId,
                    order: topic.order,
                    isActive: topic.isActive,
                });
                setIconPreview(topic.iconUrl || null);
            } else {
                setTopicFormData(DEFAULT_TOPIC_FORM);
                setIconPreview(null);
            }
            if (iconFileInputRef.current) iconFileInputRef.current.value = "";
        }
    }, [isOpen, topic]);

    const handleIconFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 즉시 미리보기
        const reader = new FileReader();
        reader.onload = () => setIconPreview(reader.result as string);
        reader.readAsDataURL(file);

        // GCS 업로드
        setIsIconUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
                credentials: "include",
            });
            if (!res.ok) throw new Error("업로드 실패");
            const data = await res.json();
            setTopicFormData(prev => ({ ...prev, iconUrl: data.url }));
            toast({ title: "아이콘 업로드 완료" });
        } catch {
            toast({ title: "업로드 실패", description: "이미지 업로드 중 오류가 발생했습니다.", variant: "destructive" });
            setIconPreview(topic?.iconUrl || null);
        } finally {
            setIsIconUploading(false);
        }
    };

    const handleRemoveIcon = () => {
        setIconPreview(null);
        setTopicFormData(prev => ({ ...prev, iconUrl: "" }));
        if (iconFileInputRef.current) iconFileInputRef.current.value = "";
    };

    const createTopicMutation = useMutation({
        mutationFn: ({ bigMissionId, data }: { bigMissionId: number; data: Partial<BigMissionTopic> }) =>
            apiRequest(`/api/admin/big-missions/${bigMissionId}/topics`, {
                method: "POST",
                body: JSON.stringify(data),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/big-missions"] });
            toast({ title: "토픽이 추가되었습니다" });
            modal.closeTopModal ? modal.closeTopModal() : onClose?.();
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
            toast({ title: "토픽이 수정되었습니다" });
            modal.closeTopModal ? modal.closeTopModal() : onClose?.();
        },
        onError: () => {
            toast({ title: "토픽 수정 실패", variant: "destructive" });
        },
    });

    const handleSaveTopic = () => {
        if (topic) {
            updateTopicMutation.mutate({
                bigMissionId,
                topicId: topic.id,
                data: topicFormData,
            });
        } else {
            createTopicMutation.mutate({
                bigMissionId,
                data: topicFormData,
            });
        }
    };

    const isPending = createTopicMutation.isPending || updateTopicMutation.isPending;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && (modal.closeTopModal ? modal.closeTopModal() : onClose?.())}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{topic ? "토픽 수정" : "토픽 추가"}</DialogTitle>
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
                        <Label>아이콘 이미지 (없으면 공용아이콘)</Label>
                        <div className="flex items-center gap-3 mt-1">
                            <div
                                className="relative w-16 h-16 bg-muted rounded-full overflow-hidden border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary transition-colors flex-shrink-0"
                                onClick={() => !isIconUploading && iconFileInputRef.current?.click()}
                            >
                                {isIconUploading ? (
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                ) : iconPreview ? (
                                    <img src={iconPreview} alt="아이콘 미리보기" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center text-muted-foreground">
                                        <Upload className="h-4 w-4" />
                                        <span className="text-[10px] mt-0.5">업로드</span>
                                    </div>
                                )}
                            </div>
                            <input
                                ref={iconFileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleIconFileSelect}
                                className="hidden"
                            />
                            <div className="flex flex-col gap-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => iconFileInputRef.current?.click()}
                                    disabled={isIconUploading}
                                >
                                    {isIconUploading ? "업로드 중..." : "이미지 선택"}
                                </Button>
                                {iconPreview && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleRemoveIcon}
                                        className="text-muted-foreground"
                                    >
                                        <X className="h-3 w-3 mr-1" />제거
                                    </Button>
                                )}
                            </div>
                        </div>
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
                        onClick={() => modal.closeTopModal ? modal.closeTopModal() : onClose?.()}
                    >
                        취소
                    </Button>
                    <Button
                        onClick={handleSaveTopic}
                        disabled={isPending}
                    >
                        {isPending && (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        )}
                        {topic ? "저장" : "추가"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
