import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useModal } from "@/hooks/useModal";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Upload, Globe, FileText, ImagePlus, Palette, CheckSquare } from "lucide-react";
import { X as CloseIcon, X as XIcon } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Image } from "lucide-react";
import { RichTextEditor } from "@/components/admin/RichTextEditor";


// Import helper for date formatting if needed
const formatDateForInput = (dateString?: string | Date) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toISOString().split("T")[0];
};

interface SubMissionFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    missionId: string;
    editingSubMission?: any | null;
    onSuccess?: () => void;
}

export default function SubMissionFormModal({
    isOpen,
    onClose,
    missionId,
    editingSubMission,
    onSuccess,
}: SubMissionFormModalProps) {
    const queryClient = useQueryClient();
    const modal = useModal();
    const { toast } = useToast();

    const [partyTemplates, setPartyTemplates] = useState<any[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);

    // Active Action Types logic
    const { data: activeActionTypes = [] } = useQuery<any[]>({
        queryKey: ['/api/action-types/active'],
        enabled: isOpen,
    });

    const formSchema = z.object({
        title: z.string().min(1, "제목을 입력하세요"),
        description: z.string().optional(),
        submissionTypes: z.array(z.enum(["file", "image", "link", "text", "review", "studio_submit", "attendance"])).min(1, "최소 1개의 제출 타입이 필요합니다"),
        submissionLabels: z.record(z.string(), z.string()).optional(),
        requireReview: z.boolean().optional(),
        studioFileFormat: z.enum(["webp", "jpeg", "pdf"]).optional(),
        studioDpi: z.number().optional(),
        partyTemplateProjectId: z.number().nullable().optional(),
        partyMaxPages: z.number().nullable().optional(),
        actionTypeId: z.number().nullable().optional(),
        sequentialLevel: z.number().optional(),
        attendanceType: z.enum(["password", "qrcode"]).nullable().optional(),
        attendancePassword: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        externalProductCode: z.string().optional(),
        externalProductName: z.string().optional(),
    });

    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            description: "",
            submissionTypes: ["file"] as ("file" | "image" | "link" | "text" | "review" | "studio_submit" | "attendance")[],
            submissionLabels: {} as Record<string, string>,
            requireReview: false,
            studioFileFormat: "pdf" as "webp" | "jpeg" | "pdf",
            studioDpi: 300,
            partyTemplateProjectId: null as number | null,
            partyMaxPages: null as number | null,
            actionTypeId: null as number | null,
            sequentialLevel: 0,
            attendanceType: null as "password" | "qrcode" | null,
            attendancePassword: "",
            startDate: "",
            endDate: "",
            externalProductCode: "",
            externalProductName: "",
        },
    });

    // Initialize form when opening
    useEffect(() => {
        if (isOpen) {
            if (editingSubMission) {
                // Edit mode
                const subMission = editingSubMission;
                const types = subMission.submissionTypes || (subMission.submissionType ? [subMission.submissionType] : ["file"]);

                // Label conversion logic
                let indexedLabels: Record<string, string> = {};
                if (subMission.submissionLabels) {
                    const labels = subMission.submissionLabels;
                    const hasNumericKeys = Object.keys(labels).some(key => !isNaN(parseInt(key)));

                    if (hasNumericKeys) {
                        Object.entries(labels).forEach(([key, value]) => {
                            if (!isNaN(parseInt(key))) {
                                indexedLabels[key] = value as string;
                            }
                        });
                    } else {
                        const typeCount: Record<string, number> = {};
                        types.forEach((type: string, index: number) => {
                            if (labels[type]) {
                                if (typeCount[type] === undefined) {
                                    typeCount[type] = 0;
                                    indexedLabels[String(index)] = labels[type];
                                }
                                typeCount[type]++;
                            }
                        });
                    }
                }

                form.reset({
                    title: subMission.title,
                    description: subMission.description || "",
                    submissionTypes: types,
                    submissionLabels: indexedLabels,
                    requireReview: subMission.requireReview || false,
                    studioFileFormat: subMission.studioFileFormat || "pdf",
                    studioDpi: subMission.studioDpi || 300,
                    partyTemplateProjectId: subMission.partyTemplateProjectId || null,
                    partyMaxPages: subMission.partyMaxPages || null,
                    actionTypeId: subMission.actionTypeId || null,
                    sequentialLevel: subMission.sequentialLevel || 0,
                    attendanceType: subMission.attendanceType || null,
                    attendancePassword: subMission.attendancePassword || "",
                    startDate: formatDateForInput(subMission.startDate) || "",
                    endDate: formatDateForInput(subMission.endDate) || "",
                });

                if (subMission.partyTemplateProjectId && types.includes("studio_submit")) {
                    loadPartyTemplates();
                }
            } else {
                // Create mode
                form.reset({
                    title: "",
                    description: "",
                    submissionTypes: ["file"],
                    submissionLabels: {},
                    requireReview: false,
                    studioFileFormat: "pdf",
                    studioDpi: 300,
                    partyTemplateProjectId: null,
                    partyMaxPages: null,
                    actionTypeId: null,
                    sequentialLevel: 0,
                    attendanceType: null,
                    attendancePassword: "",
                    startDate: "",
                    endDate: "",
                });
            }
        }
    }, [isOpen, editingSubMission, form]);

    const loadPartyTemplates = async () => {
        setTemplatesLoading(true);
        try {
            const response = await apiRequest('/api/products/templates/party');
            const data = await response.json();
            setPartyTemplates(data.data || []);
            return data.data || [];
        } catch (error) {
            console.error('Failed to load party templates:', error);
            toast({ title: "오류", description: "템플릿 목록을 불러올 수 없습니다", variant: "destructive" });
            return [];
        } finally {
            setTemplatesLoading(false);
        }
    };

    const handleOpenTemplateModal = async () => {
        const templates = await loadPartyTemplates();
        modal.open('templatePicker', {
            templates,
            isLoading: templatesLoading,
            selectedTemplateId: form.getValues('partyTemplateProjectId'),
            onSelect: (template: any) => {
                form.setValue('partyTemplateProjectId', template.id);
                form.setValue('externalProductCode', template.partyProductCode);
                form.setValue('externalProductName', template.productName);
                modal.close();
            }
        });
    };

    const handleSelectTemplate = (template: any) => {
        form.setValue('partyTemplateProjectId', template.id);
        modal.close();
    };

    const handleClearTemplate = () => {
        form.setValue('partyTemplateProjectId', null);
    };

    const selectedTemplateId = form.watch('partyTemplateProjectId');
    const selectedTemplate = partyTemplates.find(t => t.id === selectedTemplateId);


    const saveSubMissionMutation = useMutation({
        mutationFn: ({ data, subMissionId }: { data: any; subMissionId: number | null }) => {
            const url = subMissionId
                ? `/api/admin/missions/${missionId}/sub-missions/${subMissionId}`
                : `/api/admin/missions/${missionId}/sub-missions`;
            const method = subMissionId ? 'PUT' : 'POST';

            return apiRequest(url, { method, body: JSON.stringify(data) });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/missions', missionId, 'sub-missions'] });
            toast({ title: "세부 미션이 저장되었습니다" });
            onSuccess?.(); // External callback
            onClose(); // Close this modal
        },
        onError: (error: any) => {
            toast({ title: "오류", description: error.message, variant: "destructive" });
        },
    });

    const onSubmit = (data: any) => {
        const subMissionId = editingSubMission?.id || null; // Use editingSubMission prop directly
        // console.log('[세부미션 저장] 모드:', subMissionId ? '수정' : '생성', 'ID:', subMissionId);

        const cleanedLabels: Record<string, string> = {};
        if (data.submissionLabels) {
            Object.entries(data.submissionLabels).forEach(([key, value]) => {
                // @ts-ignore
                if (!isNaN(parseInt(key)) && typeof value === 'string' && value.trim()) {
                    // @ts-ignore
                    cleanedLabels[key] = value;
                }
            });
        }

        const cleanedData = { ...data, submissionLabels: cleanedLabels };
        saveSubMissionMutation.mutate({ data: cleanedData, subMissionId });
    };


    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {editingSubMission ? "세부 미션 수정" : "세부 미션 추가"}
                    </DialogTitle>
                    <DialogDescription>
                        세부 미션 정보를 입력하세요
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>제목</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="파일을 업로드해주세요" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>설명 (선택)</FormLabel>
                                    <FormControl>
                                        <RichTextEditor
                                            value={field.value || ''}
                                            onChange={field.onChange}
                                            placeholder="세부 미션에 대한 설명을 입력하세요"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* 세부미션 기간 설정 */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="startDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>시작일 (선택)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                {...field}
                                                value={field.value || ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="endDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>종료일 (선택)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                {...field}
                                                value={field.value || ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground -mt-2">
                            기간 설정 시 해당 기간에만 세부미션 수행이 가능합니다. 미설정 시 항상 수행 가능합니다.
                        </p>

                        <FormField
                            control={form.control}
                            name="submissionTypes"
                            render={({ field }) => {
                                const submissionTypes = field.value || ["file"];
                                const submissionLabels = form.watch("submissionLabels") || {};

                                const getDefaultLabel = (type: string) => {
                                    switch (type) {
                                        case "file": return "파일 URL";
                                        case "image": return "이미지 URL";
                                        case "link": return "링크 URL";
                                        case "text": return "텍스트 내용";
                                        case "review": return "리뷰 내용";
                                        case "studio_submit": return "제작소 작업물";
                                        default: return "";
                                    }
                                };

                                const addType = () => {
                                    field.onChange([...submissionTypes, "file"]);
                                };

                                const removeType = (index: number) => {
                                    if (submissionTypes.length > 1) {
                                        const newTypes = submissionTypes.filter((_: string, i: number) => i !== index);
                                        field.onChange(newTypes);
                                        const newLabels: Record<string, string> = {};
                                        Object.keys(submissionLabels).forEach((key) => {
                                            const keyIndex = parseInt(key);
                                            if (!isNaN(keyIndex)) {
                                                if (keyIndex < index) {
                                                    newLabels[String(keyIndex)] = submissionLabels[key];
                                                } else if (keyIndex > index) {
                                                    newLabels[String(keyIndex - 1)] = submissionLabels[key];
                                                }
                                            }
                                        });
                                        form.setValue("submissionLabels", newLabels);
                                    }
                                };

                                const updateType = (index: number, newValue: string) => {
                                    const newTypes = [...submissionTypes] as string[];
                                    newTypes[index] = newValue;
                                    field.onChange(newTypes);
                                };

                                const updateLabel = (index: number, label: string) => {
                                    const newLabels = { ...submissionLabels };
                                    if (label.trim()) {
                                        newLabels[String(index)] = label;
                                    } else {
                                        delete newLabels[String(index)];
                                    }
                                    form.setValue("submissionLabels", newLabels);
                                };

                                return (
                                    <FormItem>
                                        <FormLabel>제출 타입</FormLabel>
                                        <div className="space-y-3">
                                            {submissionTypes.map((type: string, index: number) => (
                                                <div key={index} className="space-y-2 p-3 border rounded-lg bg-muted/30">
                                                    <div className="flex items-center gap-2">
                                                        <Select
                                                            value={type}
                                                            onValueChange={(value) => updateType(index, value)}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="flex-1">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="file">
                                                                    <div className="flex items-center gap-2">
                                                                        <Upload className="h-4 w-4" />
                                                                        파일 제출
                                                                    </div>
                                                                </SelectItem>
                                                                <SelectItem value="image">
                                                                    <div className="flex items-center gap-2">
                                                                        <ImagePlus className="h-4 w-4" />
                                                                        이미지 제출
                                                                    </div>
                                                                </SelectItem>
                                                                <SelectItem value="link">
                                                                    <div className="flex items-center gap-2">
                                                                        <Globe className="h-4 w-4" />
                                                                        링크 제출
                                                                    </div>
                                                                </SelectItem>
                                                                <SelectItem value="text">
                                                                    <div className="flex items-center gap-2">
                                                                        <FileText className="h-4 w-4" />
                                                                        텍스트 제출
                                                                    </div>
                                                                </SelectItem>
                                                                <SelectItem value="studio_submit">
                                                                    <div className="flex items-center gap-2">
                                                                        <Palette className="h-4 w-4" />
                                                                        제작소 제출
                                                                    </div>
                                                                </SelectItem>
                                                                <SelectItem value="attendance">
                                                                    <span className="flex items-center gap-2">
                                                                        <CheckSquare className="h-4 w-4" />
                                                                        <span>출석인증</span>
                                                                    </span>
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeType(index)}
                                                            disabled={submissionTypes.length <= 1}
                                                            className="shrink-0"
                                                        >
                                                            <XIcon className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    <Input
                                                        placeholder={`라벨명 (기본: ${getDefaultLabel(type)})`}
                                                        value={submissionLabels[String(index)] || ""}
                                                        onChange={(e) => updateLabel(index, e.target.value)}
                                                        className="text-sm"
                                                    />
                                                </div>
                                            ))}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={addType}
                                                className="w-full"
                                            >
                                                <Plus className="h-4 w-4 mr-2" />
                                                제출 타입 추가
                                            </Button>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                );
                            }}
                        />

                        <FormField
                            control={form.control}
                            name="requireReview"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">
                                            검수 필요
                                        </FormLabel>
                                        <FormDescription>
                                            제출 후 관리자 검수가 필요한 미션입니다
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        {/* 제작소 제출 설정 - studio_submit이 선택된 경우에만 표시 */}
                        {form.watch("submissionTypes")?.includes("studio_submit") && (
                            <div className="space-y-4 rounded-lg border p-4">
                                <div className="space-y-1">
                                    <h4 className="text-base font-medium">제작소 제출 설정</h4>
                                    <p className="text-sm text-muted-foreground">
                                        제작소 작업물 제출 시 파일 형식과 해상도를 설정하세요
                                    </p>
                                </div>

                                {/* 파일 형식 선택 */}
                                <FormField
                                    control={form.control}
                                    name="studioFileFormat"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel>파일 형식</FormLabel>
                                            <FormControl>
                                                <RadioGroup
                                                    value={field.value || "pdf"}
                                                    onValueChange={(value) => field.onChange(value)}
                                                    className="flex flex-col space-y-1"
                                                >
                                                    <div className="flex items-center space-x-3">
                                                        <RadioGroupItem value="webp" id="format-webp" />
                                                        <Label htmlFor="format-webp" className="font-normal cursor-pointer">
                                                            WEBP - 고화질, 작은 용량 (웹 최적화)
                                                        </Label>
                                                    </div>
                                                    <div className="flex items-center space-x-3">
                                                        <RadioGroupItem value="jpeg" id="format-jpeg" />
                                                        <Label htmlFor="format-jpeg" className="font-normal cursor-pointer">
                                                            JPEG - 범용 포맷 (높은 호환성)
                                                        </Label>
                                                    </div>
                                                    <div className="flex items-center space-x-3">
                                                        <RadioGroupItem value="pdf" id="format-pdf" />
                                                        <Label htmlFor="format-pdf" className="font-normal cursor-pointer">
                                                            PDF - 인쇄용 (모든 디자인 한 파일)
                                                        </Label>
                                                    </div>
                                                </RadioGroup>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                {/* DPI 선택 */}
                                <FormField
                                    control={form.control}
                                    name="studioDpi"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel>해상도 (DPI)</FormLabel>
                                            <FormControl>
                                                <RadioGroup
                                                    value={String(field.value || 300)}
                                                    onValueChange={(value) => field.onChange(parseInt(value))}
                                                    className="flex flex-col space-y-1"
                                                >
                                                    <div className="flex items-center space-x-3">
                                                        <RadioGroupItem value="150" id="dpi-150" />
                                                        <Label htmlFor="dpi-150" className="font-normal cursor-pointer">
                                                            고화질 (150 DPI) - 일반 용도
                                                        </Label>
                                                    </div>
                                                    <div className="flex items-center space-x-3">
                                                        <RadioGroupItem value="300" id="dpi-300" />
                                                        <Label htmlFor="dpi-300" className="font-normal cursor-pointer">
                                                            인쇄용 (300 DPI) - 고품질 인쇄
                                                        </Label>
                                                    </div>
                                                </RadioGroup>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        {/* 출석인증 비밀번호 설정 - attendance가 선택된 경우에만 표시 */}
                        {form.watch("submissionTypes")?.includes("attendance") && (
                            <FormField
                                control={form.control}
                                name="attendancePassword"
                                render={({ field }) => (
                                    <FormItem className="space-y-3 rounded-lg border p-4">
                                        <FormLabel className="text-base">출석인증 비밀번호</FormLabel>
                                        <FormDescription>
                                            현장에서 참가자에게 안내할 출석 인증 비밀번호를 설정하세요
                                        </FormDescription>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                placeholder="현장에서 안내할 비밀번호"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* 행사 에디터 템플릿 설정 - studio_submit이 선택된 경우에만 표시 */}
                        {form.watch("submissionTypes")?.includes("studio_submit") && (
                            <div className="space-y-4 rounded-lg border p-4">
                                <div className="space-y-1">
                                    <Label className="text-base font-medium">행사 에디터 템플릿</Label>
                                    <p className="text-sm text-muted-foreground">
                                        사용자가 에디터를 열 때 사용할 기본 템플릿을 설정합니다
                                    </p>
                                </div>

                                {selectedTemplateId && selectedTemplate ? (
                                    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                                        {selectedTemplate.thumbnailUrl ? (
                                            <img
                                                src={selectedTemplate.thumbnailUrl}
                                                alt={selectedTemplate.title}
                                                className="w-16 h-16 object-cover rounded border"
                                            />
                                        ) : (
                                            <div className="w-16 h-16 flex items-center justify-center bg-muted-foreground/10 rounded border">
                                                <Image className="h-6 w-6 text-muted-foreground" />
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <p className="font-medium">{selectedTemplate.title}</p>
                                            <p className="text-sm text-muted-foreground">ID: {selectedTemplate.id}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={handleOpenTemplateModal}
                                            >
                                                변경
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleClearTemplate}
                                            >
                                                <XIcon className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : selectedTemplateId && !selectedTemplate ? (
                                    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                                        <div className="w-16 h-16 flex items-center justify-center bg-muted-foreground/10 rounded border">
                                            <Image className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-muted-foreground">템플릿 ID: {selectedTemplateId}</p>
                                            <p className="text-sm text-muted-foreground">(템플릿 정보를 불러오려면 "변경" 클릭)</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={handleOpenTemplateModal}
                                            >
                                                변경
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleClearTemplate}
                                            >
                                                <XIcon className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleOpenTemplateModal}
                                        className="w-full"
                                    >
                                        <Palette className="h-4 w-4 mr-2" />
                                        에디터 템플릿 설정하기
                                    </Button>
                                )}

                                <FormField
                                    control={form.control}
                                    name="partyMaxPages"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>최대 페이지 수</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="비워두면 제한 없음"
                                                    value={field.value ?? ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        field.onChange(val === '' ? null : parseInt(val, 10));
                                                    }}
                                                    min={1}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                사용자가 만들 수 있는 최대 페이지 수를 제한합니다 (비워두면 제한 없음)
                                            </FormDescription>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        <div className="border-t pt-4 mt-4">
                            <h4 className="font-medium mb-4">액션 타입 및 잠금 설정</h4>

                            <FormField
                                control={form.control}
                                name="actionTypeId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>액션 타입</FormLabel>
                                        <Select
                                            onValueChange={(value) => field.onChange(value === "none" ? null : Number(value))}
                                            value={field.value?.toString() || "none"}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="액션 타입 선택 (선택사항)" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">선택 안함</SelectItem>
                                                {activeActionTypes.map((actionType: any) => (
                                                    <SelectItem key={actionType.id} value={actionType.id.toString()}>
                                                        {actionType.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>
                                            세부 미션의 액션 타입을 지정합니다 (신청, 제출, 출석, 리뷰 등)
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="sequentialLevel"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>순차 등급</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                placeholder="0 (순차진행 안함)"
                                                value={field.value || 0}
                                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            0=순차진행 안함, 1,2,3...=등급 (이전 등급의 모든 미션 완료 시 다음 등급 열림)
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>


                        <DialogFooter>
                            <Button
                                type="submit"
                                disabled={saveSubMissionMutation.isPending}
                            >
                                {saveSubMissionMutation.isPending && (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                )}
                                저장
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
