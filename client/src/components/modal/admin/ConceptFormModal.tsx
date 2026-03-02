import React, { useState, useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Concept, ConceptCategory, InsertConcept, Hospital, AiModel } from "@shared/schema";
import { Loader2, Plus, Trash, Image } from "lucide-react";
import { useModelCapabilities, getEffectiveAspectRatios, getAspectRatioOptions, ModelCapabilities } from "@/hooks/useModelCapabilities";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { createImageErrorHandler } from "@/utils/image-url-resolver";
import { useToast } from "@/hooks/use-toast";
import { useModal } from "@/hooks/useModal";

export interface ConceptFormModalProps {
    mode: "create" | "edit";
    concept?: Concept;
    categories: ConceptCategory[];
    hospitals: Hospital[];
    isHospitalsLoading: boolean;
    onSubmit: (concept: Partial<InsertConcept> & { conceptId: string }, thumbnailFile: File | null, referenceFile: File | null) => Promise<void>;
    isPending: boolean;
}

export function ConceptFormModal({
    mode,
    concept,
    categories,
    hospitals,
    isHospitalsLoading,
    onSubmit,
    isPending,
}: ConceptFormModalProps) {
    const modal = useModal();
    const { toast } = useToast();

    const [newConcept, setNewConcept] = useState({
        conceptId: "",
        title: "",
        description: "",
        promptTemplate: "",
        systemPrompt: "",
        thumbnailUrl: "",
        categoryId: "",
        referenceImageUrl: "",
        visibilityType: "public" as "public" | "hospital",
        hospitalId: null as number | null,
        generationType: "image_upload" as "image_upload" | "text_only",
        availableModels: [] as AiModel[],
        availableAspectRatios: {} as Record<string, string[]>,
        gemini3ImageSize: "1K" as "1K" | "2K" | "4K",
        variables: [] as Array<{ name: string, label: string, placeholder: string }>,
        isActive: true,
        isFeatured: false,
        bgRemovalEnabled: false,
        bgRemovalType: "foreground" as "foreground" | "background",
        minImageCount: 1,
        maxImageCount: 1,
        enableImageText: false,
    });

    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
    const [referenceFile, setReferenceFile] = useState<File | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    const { data: modelCapabilities, isLoading: isCapabilitiesLoading } = useModelCapabilities();
    const { data: systemSettings } = useSystemSettings();

    useEffect(() => {
        if (mode === "edit" && concept) {
            const existingAspectRatios = concept.availableAspectRatios || {};
            const settingsData = systemSettings as any;
            const models = concept.availableModels || (settingsData?.supportedAiModels ?? ["openai", "gemini"]);

            const aspectRatios: Record<string, string[]> = {};
            models.forEach((model: string) => {
                const aspectRatioData = existingAspectRatios as Record<string, unknown>;
                if (aspectRatioData?.[model]) {
                    aspectRatios[model] = aspectRatioData[model] as string[];
                } else {
                    const capabilities = modelCapabilities as ModelCapabilities;
                    aspectRatios[model] = getEffectiveAspectRatios(model, null, capabilities);
                }
            });

            setNewConcept({
                conceptId: concept.conceptId,
                title: concept.title,
                description: concept.description || "",
                promptTemplate: concept.promptTemplate,
                systemPrompt: concept.systemPrompt || "",
                thumbnailUrl: concept.thumbnailUrl || "",
                categoryId: concept.categoryId || "",
                referenceImageUrl: concept.thumbnailUrl || "",
                visibilityType: (concept.visibilityType as "public" | "hospital") || "public",
                hospitalId: concept.hospitalId || null,
                generationType: (concept.generationType as "image_upload" | "text_only") || "image_upload",
                availableModels: models,
                availableAspectRatios: aspectRatios,
                gemini3ImageSize: ((concept as any).gemini3ImageSize as "1K" | "2K" | "4K") || "1K",
                variables: Array.isArray(concept.variables) ? concept.variables : [],
                isActive: concept.isActive ?? true,
                isFeatured: concept.isFeatured ?? false,
                bgRemovalEnabled: concept.bgRemovalEnabled ?? false,
                bgRemovalType: (concept.bgRemovalType as "foreground" | "background") || "foreground",
                minImageCount: (concept as any).minImageCount ?? 1,
                maxImageCount: (concept as any).maxImageCount ?? 1,
                enableImageText: (concept as any).enableImageText ?? false,
            });
        } else if (mode === "create" && systemSettings && modelCapabilities && newConcept.availableModels.length === 0) {
            const settingsData = systemSettings as any;
            const supportedModels = settingsData?.supportedAiModels || [];
            const defaultAspectRatios: Record<string, string[]> = {};

            supportedModels.forEach((model: string) => {
                const capabilities = modelCapabilities as ModelCapabilities;
                const ratios = capabilities?.[model];
                if (ratios && ratios.length > 0) {
                    defaultAspectRatios[model] = [ratios[0]];
                }
            });

            setNewConcept((prev) => ({
                ...prev,
                availableModels: supportedModels as AiModel[],
                availableAspectRatios: defaultAspectRatios,
            }));
        }
    }, [mode, concept, systemSettings, modelCapabilities]);

    const validateForm = () => {
        const errors: Record<string, string> = {};

        if (!newConcept.conceptId.trim()) errors.conceptId = "컨셉 ID는 필수 입력 항목입니다.";
        if (!newConcept.title.trim()) errors.title = "컨셉 제목은 필수 입력 항목입니다.";
        if (!newConcept.promptTemplate.trim()) errors.promptTemplate = "프롬프트 템플릿은 필수 입력 항목입니다.";
        if (!newConcept.categoryId) errors.categoryId = "카테고리는 필수 선택 항목입니다.";
        if (!newConcept.thumbnailUrl.trim() && !thumbnailFile) errors.thumbnailUrl = "썸네일 이미지는 필수 항목입니다.";
        if (newConcept.visibilityType === "hospital" && !newConcept.hospitalId) {
            errors.hospitalId = "병원전용 선택 시 병원을 반드시 선택해야 합니다.";
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            toast({
                title: "입력 정보를 확인해주세요",
                description: "필수 항목을 모두 입력해주세요.",
                variant: "destructive",
            });
            return;
        }

        await onSubmit(newConcept, thumbnailFile, referenceFile);
    };

    const handleModelToggle = (model: string) => {
        const aiModel = model as AiModel;
        const currentModels = newConcept.availableModels;
        let newAspectRatios = { ...newConcept.availableAspectRatios };

        if (currentModels.includes(aiModel)) {
            if (currentModels.length > 1) {
                delete newAspectRatios[model];
                setNewConcept({
                    ...newConcept,
                    availableModels: currentModels.filter((m) => m !== aiModel),
                    availableAspectRatios: newAspectRatios,
                });
            }
        } else {
            const capabilities = modelCapabilities as ModelCapabilities;
            const defaultRatios = getEffectiveAspectRatios(model, null, capabilities);
            newAspectRatios[model] = defaultRatios;
            setNewConcept({
                ...newConcept,
                availableModels: [...currentModels, aiModel],
                availableAspectRatios: newAspectRatios,
            });
        }
    };

    const handleAspectRatioToggle = (model: string, ratio: string) => {
        const currentRatios = newConcept.availableAspectRatios[model] || [];
        let newRatios: string[];

        if (currentRatios.includes(ratio)) {
            if (currentRatios.length > 1) {
                newRatios = currentRatios.filter((r) => r !== ratio);
            } else {
                return;
            }
        } else {
            newRatios = [...currentRatios, ratio];
        }

        setNewConcept({
            ...newConcept,
            availableAspectRatios: {
                ...newConcept.availableAspectRatios,
                [model]: newRatios,
            },
        });
    };

    const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setThumbnailFile(e.target.files[0]);
        }
    };

    const handleReferenceImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setReferenceFile(e.target.files[0]);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] max-h-[800px] w-full max-w-[700px] mx-auto bg-background rounded-lg shadow-lg border overflow-hidden">
            <div className="p-6 border-b">
                <h2 className="text-xl font-bold">
                    {mode === "edit" ? "컨셉 수정" : "새 컨셉 추가"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                    AI 이미지 변환 스타일 컨셉을 {mode === "edit" ? "수정" : "추가"}합니다.
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <form id="concept-form" onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label
                                htmlFor="conceptId"
                                className={validationErrors.conceptId ? "text-red-600" : ""}
                            >
                                컨셉 ID{" "}
                                {validationErrors.conceptId && (
                                    <span className="text-red-500">*</span>
                                )}
                            </Label>
                            <Input
                                id="conceptId"
                                placeholder="영문, 숫자, 언더스코어만 사용 (예: elegant_portrait)"
                                value={newConcept.conceptId}
                                onChange={(e) => {
                                    setNewConcept({ ...newConcept, conceptId: e.target.value });
                                    if (validationErrors.conceptId && e.target.value.trim()) {
                                        setValidationErrors({
                                            ...validationErrors,
                                            conceptId: "",
                                        });
                                    }
                                }}
                                disabled={mode === "edit"}
                                className={`${validationErrors.conceptId
                                        ? "border-red-500 focus:border-red-500"
                                        : ""
                                    }`}
                                required
                            />
                            {validationErrors.conceptId && (
                                <p className="text-sm text-red-600 mt-1">
                                    {validationErrors.conceptId}
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label
                                htmlFor="title"
                                className={validationErrors.title ? "text-red-600" : ""}
                            >
                                제목{" "}
                                {validationErrors.title && (
                                    <span className="text-red-500">*</span>
                                )}
                            </Label>
                            <Input
                                id="title"
                                placeholder="컨셉 제목"
                                value={newConcept.title}
                                onChange={(e) => {
                                    setNewConcept({ ...newConcept, title: e.target.value });
                                    if (validationErrors.title && e.target.value.trim()) {
                                        setValidationErrors({ ...validationErrors, title: "" });
                                    }
                                }}
                                className={`${validationErrors.title
                                        ? "border-red-500 focus:border-red-500"
                                        : ""
                                    }`}
                                required
                            />
                            {validationErrors.title && (
                                <p className="text-sm text-red-600 mt-1">
                                    {validationErrors.title}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">설명</Label>
                        <Textarea
                            id="description"
                            placeholder="컨셉에 대한 간단한 설명"
                            value={newConcept.description}
                            onChange={(e) =>
                                setNewConcept({ ...newConcept, description: e.target.value })
                            }
                            rows={2}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label
                            htmlFor="categoryId"
                            className={validationErrors.categoryId ? "text-red-600" : ""}
                        >
                            카테고리{" "}
                            {validationErrors.categoryId && (
                                <span className="text-red-500">*</span>
                            )}
                        </Label>
                        <Select
                            value={newConcept.categoryId}
                            onValueChange={(value) => {
                                setNewConcept({ ...newConcept, categoryId: value });
                                if (validationErrors.categoryId && value) {
                                    setValidationErrors({ ...validationErrors, categoryId: "" });
                                }
                            }}
                        >
                            <SelectTrigger
                                className={`${validationErrors.categoryId
                                        ? "border-red-500 focus:border-red-500"
                                        : ""
                                    }`}
                            >
                                <SelectValue placeholder="카테고리 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories?.map((category: ConceptCategory) => (
                                    <SelectItem
                                        key={category.categoryId}
                                        value={category.categoryId}
                                    >
                                        {category.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {validationErrors.categoryId && (
                            <p className="text-sm text-red-600 mt-1">
                                {validationErrors.categoryId}
                            </p>
                        )}
                    </div>

                    {/* 생성 방식 선택 섹션 */}
                    <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                        <div className="space-y-3">
                            <Label className="text-base font-medium">생성 방식</Label>
                            <RadioGroup
                                value={newConcept.generationType}
                                onValueChange={(value) =>
                                    setNewConcept({
                                        ...newConcept,
                                        generationType: value as "image_upload" | "text_only",
                                    })
                                }
                            >
                                <div className="space-y-3">
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="image_upload" id="image_upload" />
                                        <Label
                                            htmlFor="image_upload"
                                            className="text-sm font-normal cursor-pointer"
                                        >
                                            이미지 첨부 생성 (기존 방식)
                                        </Label>
                                    </div>

                                    {/* AI 모델 선택 체크박스 - 모든 생성 방식에서 표시 */}
                                    <div className="ml-6 space-y-2 p-3 bg-background/50 rounded border border-dashed border-muted-foreground/30">
                                        <Label className="text-sm font-medium text-muted-foreground">
                                            사용 가능한 AI 모델
                                        </Label>
                                        <div className="flex flex-wrap gap-4">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="model-openai"
                                                    checked={newConcept.availableModels.includes(
                                                        "openai"
                                                    )}
                                                    onCheckedChange={() => handleModelToggle("openai")}
                                                />
                                                <Label
                                                    htmlFor="model-openai"
                                                    className="text-sm cursor-pointer"
                                                >
                                                    GPT-Image-1
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="model-gemini"
                                                    checked={newConcept.availableModels.includes(
                                                        "gemini"
                                                    )}
                                                    onCheckedChange={() => handleModelToggle("gemini")}
                                                />
                                                <Label
                                                    htmlFor="model-gemini"
                                                    className="text-sm cursor-pointer"
                                                >
                                                    Gemini 2.5 Flash
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="model-gemini_3"
                                                    checked={newConcept.availableModels.includes(
                                                        "gemini_3"
                                                    )}
                                                    onCheckedChange={() => handleModelToggle("gemini_3")}
                                                />
                                                <Label
                                                    htmlFor="model-gemini_3"
                                                    className="text-sm cursor-pointer"
                                                >
                                                    Gemini 3.0 Pro
                                                </Label>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            최소 1개 이상의 모델을 선택해야 합니다. 사용자는 선택된
                                            모델만 사용할 수 있습니다.
                                        </p>
                                    </div>

                                    {/* 비율 선택 - 이미지 첨부 생성 선택 시에만 표시 */}
                                    {newConcept.generationType === "image_upload" &&
                                        newConcept.availableModels.length > 0 && (
                                            <div className="ml-6 space-y-4 p-3 bg-background/30 rounded border border-dashed border-muted-foreground/20">
                                                <Label className="text-sm font-medium text-muted-foreground">
                                                    이미지 비율 설정
                                                </Label>
                                                <div className="space-y-4">
                                                    {newConcept.availableModels.map((model) => (
                                                        <div key={model} className="space-y-2">
                                                            <Label className="text-xs font-medium text-muted-foreground">
                                                                {model === "openai"
                                                                    ? "GPT-Image-1"
                                                                    : model === "gemini"
                                                                        ? "Gemini 2.5 Flash"
                                                                        : "Gemini 3.0 Pro"}{" "}
                                                                비율
                                                            </Label>
                                                            <div className="flex flex-wrap gap-3">
                                                                {isCapabilitiesLoading ? (
                                                                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                        <span>비율 옵션 로딩 중...</span>
                                                                    </div>
                                                                ) : getAspectRatioOptions(
                                                                    model,
                                                                    modelCapabilities as ModelCapabilities
                                                                ).length === 0 ? (
                                                                    <div className="text-xs text-muted-foreground">
                                                                        사용 가능한 비율이 없습니다.
                                                                    </div>
                                                                ) : (
                                                                    getAspectRatioOptions(
                                                                        model,
                                                                        modelCapabilities as ModelCapabilities
                                                                    ).map((ratio) => (
                                                                        <div
                                                                            key={ratio.value}
                                                                            className="flex items-center space-x-2"
                                                                        >
                                                                            <Checkbox
                                                                                id={`ratio-${model}-${ratio.value}`}
                                                                                checked={(
                                                                                    newConcept.availableAspectRatios[
                                                                                    model
                                                                                    ] || []
                                                                                ).includes(ratio.value)}
                                                                                onCheckedChange={() =>
                                                                                    handleAspectRatioToggle(
                                                                                        model,
                                                                                        ratio.value
                                                                                    )
                                                                                }
                                                                            />
                                                                            <Label
                                                                                htmlFor={`ratio-${model}-${ratio.value}`}
                                                                                className="text-xs cursor-pointer"
                                                                            >
                                                                                {ratio.label}
                                                                            </Label>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    각 모델별로 최소 1개 이상의 비율을 선택해야 합니다.
                                                    사용자는 선택된 비율만 사용할 수 있습니다.
                                                </p>

                                                {/* Gemini 3.0 Pro 해상도 옵션 - Gemini 3.0 Pro 선택 시에만 표시 */}
                                                {newConcept.availableModels.includes("gemini_3") && (
                                                    <div className="space-y-2 mt-4 pt-4 border-t border-dashed border-muted-foreground/20">
                                                        <Label className="text-sm font-medium text-muted-foreground">
                                                            Gemini 3.0 Pro 해상도
                                                        </Label>
                                                        <div className="flex flex-wrap gap-3">
                                                            {(["1K", "2K", "4K"] as const).map((size) => (
                                                                <div
                                                                    key={size}
                                                                    className="flex items-center space-x-2"
                                                                >
                                                                    <input
                                                                        type="radio"
                                                                        id={`imageSize-${size}`}
                                                                        name="gemini3ImageSize"
                                                                        value={size}
                                                                        checked={
                                                                            newConcept.gemini3ImageSize === size
                                                                        }
                                                                        onChange={(e) =>
                                                                            setNewConcept({
                                                                                ...newConcept,
                                                                                gemini3ImageSize: e.target
                                                                                    .value as "1K" | "2K" | "4K",
                                                                            })
                                                                        }
                                                                        className="h-4 w-4"
                                                                    />
                                                                    <Label
                                                                        htmlFor={`imageSize-${size}`}
                                                                        className="text-xs cursor-pointer"
                                                                    >
                                                                        {size}{" "}
                                                                        {size === "1K"
                                                                            ? "(기본)"
                                                                            : size === "4K"
                                                                                ? "(최고)"
                                                                                : ""}
                                                                    </Label>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            Gemini 3.0 Pro 모델의 이미지 해상도를 선택합니다.
                                                            해상도가 높을수록 생성 시간과 비용이 증가합니다.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                </div>

                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="text_only" id="text_only" />
                                    <Label
                                        htmlFor="text_only"
                                        className="text-sm font-normal cursor-pointer"
                                    >
                                        프롬프트로 생성 (텍스트만)
                                    </Label>
                                </div>
                            </RadioGroup>
                            <p className="text-xs text-muted-foreground">
                                "이미지 첨부 생성"은 기존처럼 이미지를 업로드해야 하고,
                                "프롬프트로 생성"은 텍스트만으로 이미지를 생성합니다.
                            </p>
                        </div>
                    </div>

                    {/* 공개설정 섹션 */}
                    <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                        <div className="space-y-3">
                            <Label className="text-base font-medium">공개 설정</Label>
                            <div className="flex flex-col space-y-3">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        id="visibility-public"
                                        name="visibilityType"
                                        value="public"
                                        checked={newConcept.visibilityType === "public"}
                                        onChange={(e) =>
                                            setNewConcept({
                                                ...newConcept,
                                                visibilityType: e.target.value as
                                                    | "public"
                                                    | "hospital",
                                                hospitalId:
                                                    e.target.value === "public"
                                                        ? null
                                                        : newConcept.hospitalId,
                                            })
                                        }
                                        className="h-4 w-4"
                                    />
                                    <Label
                                        htmlFor="visibility-public"
                                        className="text-sm font-normal cursor-pointer"
                                    >
                                        전체 공개 (모든 사용자가 사용 가능)
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        id="visibility-hospital"
                                        name="visibilityType"
                                        value="hospital"
                                        checked={newConcept.visibilityType === "hospital"}
                                        onChange={(e) =>
                                            setNewConcept({
                                                ...newConcept,
                                                visibilityType: e.target.value as
                                                    | "public"
                                                    | "hospital",
                                            })
                                        }
                                        className="h-4 w-4"
                                    />
                                    <Label
                                        htmlFor="visibility-hospital"
                                        className="text-sm font-normal cursor-pointer"
                                    >
                                        병원 전용 (특정 병원만 사용 가능)
                                    </Label>
                                </div>
                            </div>

                            {/* 병원 선택 드롭다운 - 병원전용 선택 시에만 표시 */}
                            {newConcept.visibilityType === "hospital" && (
                                <div className="space-y-2 ml-6">
                                    <Label
                                        htmlFor="hospitalId"
                                        className={`text-sm text-gray-200 ${validationErrors.hospitalId ? "text-red-400" : ""
                                            }`}
                                    >
                                        병원 선택 <span className="text-red-400">*</span>
                                    </Label>
                                    <select
                                        value={newConcept.hospitalId?.toString() || ""}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setNewConcept({
                                                ...newConcept,
                                                hospitalId: value ? parseInt(value) : null,
                                            });
                                            if (validationErrors.hospitalId && value) {
                                                setValidationErrors({
                                                    ...validationErrors,
                                                    hospitalId: "",
                                                });
                                            }
                                        }}
                                        className={`w-full px-3 py-2 border rounded-md bg-gray-800 text-white text-sm ${validationErrors.hospitalId
                                                ? "border-red-500 focus:border-red-400 focus:ring-red-400"
                                                : "border-gray-600 focus:border-blue-400 focus:ring-blue-400"
                                            }`}
                                    >
                                        <option value="">병원을 선택하세요</option>
                                        {isHospitalsLoading ? (
                                            <option disabled>병원 목록을 불러오는 중...</option>
                                        ) : Array.isArray(hospitals) && hospitals.length > 0 ? (
                                            hospitals.map((hospital: Hospital) => (
                                                <option
                                                    key={hospital.id}
                                                    value={hospital.id.toString()}
                                                >
                                                    {hospital.name}
                                                </option>
                                            ))
                                        ) : (
                                            <option disabled>
                                                병원 목록이 없습니다 ({hospitals?.length || 0}개)
                                            </option>
                                        )}
                                    </select>
                                    {validationErrors.hospitalId && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {validationErrors.hospitalId}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <Tabs defaultValue="basic" className="w-full">
                        <TabsList className="w-full mb-2 bg-muted-foreground/5">
                            <TabsTrigger value="basic" className="flex-1 font-semibold">
                                기본 정보
                            </TabsTrigger>
                            <TabsTrigger value="advanced" className="flex-1 font-semibold">
                                고급 설정
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="basic" className="space-y-4">
                            <div className="space-y-2 mt-4">
                                <Label
                                    htmlFor="promptTemplate"
                                    className={
                                        validationErrors.promptTemplate ? "text-red-600" : ""
                                    }
                                >
                                    기본 프롬프트 템플릿{" "}
                                    {validationErrors.promptTemplate && (
                                        <span className="text-red-500">*</span>
                                    )}
                                </Label>
                                <Textarea
                                    id="promptTemplate"
                                    placeholder="A beautiful {{object}} in {{style}} style, high quality"
                                    value={newConcept.promptTemplate}
                                    onChange={(e) => {
                                        setNewConcept({
                                            ...newConcept,
                                            promptTemplate: e.target.value,
                                        });
                                        if (
                                            validationErrors.promptTemplate &&
                                            e.target.value.trim()
                                        ) {
                                            setValidationErrors({
                                                ...validationErrors,
                                                promptTemplate: "",
                                            });
                                        }
                                    }}
                                    className={`${validationErrors.promptTemplate
                                            ? "border-red-500 focus:border-red-500"
                                            : ""
                                        }`}
                                    rows={3}
                                    required
                                />
                                {validationErrors.promptTemplate && (
                                    <p className="text-sm text-red-600 mt-1">
                                        {validationErrors.promptTemplate}
                                    </p>
                                )}
                                <p className="text-sm text-muted-foreground">
                                    {"{object}"}, {"{style}"}, {"{mood}"} 등의 변수를 사용할 수 있습니다.
                                </p>
                            </div>

                            {/* 변수 설정 섹션 */}
                            <div className="space-y-2">
                                <Label>사용자 입력 변수 설정</Label>
                                <p className="text-sm text-muted-foreground">
                                    사용자가 직접 입력할 수 있는 변수를 설정합니다 (예: 아기 이름,
                                    메시지 등)
                                </p>

                                {newConcept.variables.map((variable, index) => (
                                    <div
                                        key={index}
                                        className="flex gap-2 items-center p-3 border rounded"
                                    >
                                        <Input
                                            placeholder="변수명 (예: baby_name)"
                                            value={variable.name}
                                            onChange={(e) => {
                                                const newVariables = [...newConcept.variables];
                                                newVariables[index].name = e.target.value;
                                                setNewConcept({
                                                    ...newConcept,
                                                    variables: newVariables,
                                                });
                                            }}
                                            className="flex-1"
                                        />
                                        <Input
                                            placeholder="라벨 (예: 아기 이름)"
                                            value={variable.label}
                                            onChange={(e) => {
                                                const newVariables = [...newConcept.variables];
                                                newVariables[index].label = e.target.value;
                                                setNewConcept({
                                                    ...newConcept,
                                                    variables: newVariables,
                                                });
                                            }}
                                            className="flex-1"
                                        />
                                        <Input
                                            placeholder="안내문구 (예: 아기 이름을 입력하세요)"
                                            value={variable.placeholder}
                                            onChange={(e) => {
                                                const newVariables = [...newConcept.variables];
                                                newVariables[index].placeholder = e.target.value;
                                                setNewConcept({
                                                    ...newConcept,
                                                    variables: newVariables,
                                                });
                                            }}
                                            className="flex-1"
                                        />
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => {
                                                const newVariables = newConcept.variables.filter(
                                                    (_, i) => i !== index
                                                );
                                                setNewConcept({
                                                    ...newConcept,
                                                    variables: newVariables,
                                                });
                                            }}
                                        >
                                            <Trash className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setNewConcept({
                                            ...newConcept,
                                            variables: [
                                                ...newConcept.variables,
                                                { name: "", label: "", placeholder: "" },
                                            ],
                                        });
                                    }}
                                    className="w-full"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    변수 추가
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="thumbnail"
                                    className={
                                        validationErrors.thumbnailUrl ? "text-red-600" : ""
                                    }
                                >
                                    썸네일 이미지{" "}
                                    {validationErrors.thumbnailUrl && (
                                        <span className="text-red-500">*</span>
                                    )}
                                </Label>
                                <div className="flex items-center gap-4">
                                    <Input
                                        id="thumbnail"
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            handleThumbnailChange(e);
                                            if (
                                                validationErrors.thumbnailUrl &&
                                                e.target.files &&
                                                e.target.files[0]
                                            ) {
                                                setValidationErrors({
                                                    ...validationErrors,
                                                    thumbnailUrl: "",
                                                });
                                            }
                                        }}
                                        className={`flex-1 ${validationErrors.thumbnailUrl
                                                ? "border-red-500 focus:border-red-500"
                                                : ""
                                            }`}
                                    />
                                    {(newConcept.thumbnailUrl || thumbnailFile) && (
                                        <div className="w-16 h-16 rounded overflow-hidden border">
                                            <img
                                                src={
                                                    thumbnailFile
                                                        ? URL.createObjectURL(thumbnailFile)
                                                        : newConcept.thumbnailUrl
                                                }
                                                alt="썸네일 미리보기"
                                                className="w-full h-full object-cover"
                                                onError={createImageErrorHandler("thumbnail")}
                                            />
                                        </div>
                                    )}
                                </div>
                                {validationErrors.thumbnailUrl && (
                                    <p className="text-sm text-red-600 mt-1">
                                        {validationErrors.thumbnailUrl}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="referenceImage">레퍼런스 이미지</Label>
                                <p className="text-sm text-muted-foreground">
                                    스타일 참고용 이미지를 업로드합니다.
                                </p>
                                <div className="flex items-center gap-4">
                                    <Input
                                        id="referenceImage"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleReferenceImageChange}
                                        className="flex-1"
                                    />
                                    {(newConcept.referenceImageUrl || referenceFile) && (
                                        <div className="w-24 h-24 rounded overflow-hidden border">
                                            <img
                                                src={
                                                    referenceFile
                                                        ? URL.createObjectURL(referenceFile)
                                                        : newConcept.referenceImageUrl
                                                }
                                                alt="레퍼런스 이미지 미리보기"
                                                className="w-full h-full object-cover"
                                                onError={createImageErrorHandler("reference")}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="advanced" className="space-y-4">
                            <div className="space-y-2 mt-4">
                                <Label htmlFor="systemPrompt">시스템 프롬프트 (선택사항)</Label>
                                <Textarea
                                    id="systemPrompt"
                                    placeholder="이미지 분석과 변환을 위한 시스템 지침을 입력하세요."
                                    value={newConcept.systemPrompt}
                                    onChange={(e) =>
                                        setNewConcept({
                                            ...newConcept,
                                            systemPrompt: e.target.value,
                                        })
                                    }
                                    rows={6}
                                />
                                <p className="text-sm text-muted-foreground">
                                    시스템 프롬프트는 AI 모델에게 이미지 처리 방법에 대한 상세한
                                    지침을 제공합니다.
                                </p>
                            </div>
                        </TabsContent>
                    </Tabs>

                    {/* 다중 이미지 업로드 설정 */}
                    <div className="space-y-4 pt-4 border-t border-muted-foreground/20">
                        <div>
                            <Label className="text-base font-medium">
                                다중 이미지 업로드 설정
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                초음파 앨범, 콜라주 등 여러 이미지를 업로드해야 하는 컨셉에
                                사용합니다.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="minImageCount">최소 이미지 개수</Label>
                                <Input
                                    id="minImageCount"
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={newConcept.minImageCount}
                                    onChange={(e) =>
                                        setNewConcept({
                                            ...newConcept,
                                            minImageCount: Math.max(
                                                1,
                                                parseInt(e.target.value) || 1
                                            ),
                                        })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="maxImageCount">최대 이미지 개수</Label>
                                <Input
                                    id="maxImageCount"
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={newConcept.maxImageCount}
                                    onChange={(e) =>
                                        setNewConcept({
                                            ...newConcept,
                                            maxImageCount: Math.max(
                                                1,
                                                parseInt(e.target.value) || 1
                                            ),
                                        })
                                    }
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-sm font-medium">
                                    이미지별 텍스트 입력 활성화
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    각 이미지마다 설명 텍스트를 입력할 수 있도록 합니다.
                                    프롬프트에서 [IMAGE_N], [TEXT_N] 형식으로 사용하세요.
                                </p>
                            </div>
                            <Switch
                                checked={newConcept.enableImageText}
                                onCheckedChange={(checked) =>
                                    setNewConcept({
                                        ...newConcept,
                                        enableImageText: checked,
                                    })
                                }
                            />
                        </div>

                        {newConcept.maxImageCount > 1 && (
                            <div className="p-3 bg-blue-500/10 rounded border border-blue-500/30">
                                <p className="text-xs text-blue-400">
                                    프롬프트 템플릿에서 다음 플레이스홀더를 사용하세요:
                                    <br />
                                    • [IMAGE_1], [IMAGE_2], ... : 업로드된 이미지 위치
                                    <br />
                                    • [TEXT_1], [TEXT_2], ... : 이미지별 텍스트 (enableImageText
                                    활성화 시)
                                </p>
                            </div>
                        )}
                    </div>

                    {/* 배경제거 설정 */}
                    <div className="space-y-4 pt-4 border-t border-muted-foreground/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-base font-medium">배경제거 적용</Label>
                                <p className="text-sm text-muted-foreground">
                                    이미지 생성 후 자동으로 배경을 제거합니다.
                                </p>
                            </div>
                            <Switch
                                checked={newConcept.bgRemovalEnabled}
                                onCheckedChange={(checked) =>
                                    setNewConcept({
                                        ...newConcept,
                                        bgRemovalEnabled: checked,
                                    })
                                }
                            />
                        </div>

                        {newConcept.bgRemovalEnabled && (
                            <div className="ml-6 p-3 bg-background/50 rounded border border-dashed border-muted-foreground/30">
                                <Label className="text-sm font-medium text-muted-foreground mb-3 block">
                                    배경제거 결과 타입
                                </Label>
                                <RadioGroup
                                    value={newConcept.bgRemovalType}
                                    onValueChange={(value) =>
                                        setNewConcept({
                                            ...newConcept,
                                            bgRemovalType: value as "foreground" | "background",
                                        })
                                    }
                                    className="space-y-2"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="foreground" id="bg-foreground" />
                                        <Label
                                            htmlFor="bg-foreground"
                                            className="text-sm font-normal cursor-pointer"
                                        >
                                            전경만 (사람/객체) - 배경을 투명하게 제거
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="background" id="bg-background" />
                                        <Label
                                            htmlFor="bg-background"
                                            className="text-sm font-normal cursor-pointer"
                                        >
                                            배경만 - 사람/객체를 제거하고 배경만 유지
                                        </Label>
                                    </div>
                                </RadioGroup>
                                <p className="text-xs text-muted-foreground mt-2">
                                    품질과 모델 설정은 시스템 설정의 배경제거 설정에서 관리합니다.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* 활성화 설정 UI 추가 */}
                    <div className="space-y-3 pt-4 border-t border-muted-foreground/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-base font-medium">컨셉 활성화</Label>
                                <p className="text-sm text-muted-foreground">
                                    비활성화 시 사용자에게 표시되지 않습니다.
                                </p>
                            </div>
                            <Switch
                                checked={newConcept.isActive}
                                onCheckedChange={(checked) =>
                                    setNewConcept({
                                        ...newConcept,
                                        isActive: checked,
                                    })
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-base font-medium">추천 컨셉</Label>
                                <p className="text-sm text-muted-foreground">
                                    추천 컨셉으로 설정하면 우선적으로 표시됩니다.
                                </p>
                            </div>
                            <Switch
                                checked={newConcept.isFeatured}
                                onCheckedChange={(checked) =>
                                    setNewConcept({
                                        ...newConcept,
                                        isFeatured: checked,
                                    })
                                }
                            />
                        </div>
                    </div>
                </form>
            </div>

            <div className="flex items-center justify-end p-6 border-t gap-2 bg-background">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => modal.close()}
                >
                    취소
                </Button>
                <Button
                    type="submit"
                    form="concept-form"
                    disabled={isPending}
                >
                    {isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            저장 중...
                        </>
                    ) : (
                        "저장"
                    )}
                </Button>
            </div>
        </div>
    );
}
