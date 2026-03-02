/**
 * MenuManagement — 메인 메뉴 관리 컴포넌트
 * 
 * 관리자 > 메뉴관리 탭의 핵심 UI
 * - 5개 메인 메뉴 목록 표시 (아코디언 형태)
 * - 활성/비활성 토글
 * - 제목/아이콘/경로 수정
 * - 홈 설정 (전용 홈 vs 하위메뉴 선택)
 * - 관리 기능 바로가기 (각 메뉴별 관련 관리 탭으로 이동)
 */

import React, { useState, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import ErrorBoundary from "@/components/ErrorBoundary";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

import {
    Trophy,
    Target,
    Sparkles,
    Images,
    User,
    Home,
    Settings,
    GripVertical,
    Pencil,
    Save,
    EyeOff,
    ExternalLink,
} from "lucide-react";

// 아이콘 매핑
const iconMap: Record<string, React.ComponentType<any>> = {
    Trophy,
    Target,
    Sparkles,
    Images,
    User,
};

// 아이콘 선택 옵션
const ICON_OPTIONS = [
    { value: "Trophy", label: "🏆 Trophy" },
    { value: "Target", label: "🎯 Target" },
    { value: "Sparkles", label: "✨ Sparkles" },
    { value: "Images", label: "🖼️ Images" },
    { value: "User", label: "👤 User" },
    { value: "Home", label: "🏠 Home" },
    { value: "Settings", label: "⚙️ Settings" },
];

interface MainMenu {
    id: number;
    menuId: string;
    title: string;
    icon: string;
    path: string;
    homeType: string;
    homeSubmenuPath: string | null;
    isActive: boolean;
    order: number;
    createdAt: string;
    updatedAt: string;
}

// 관리 컴포넌트 lazy import (탭 통합을 위해)
const PersonaManager = lazy(() => import("@/components/admin/PersonaManagement"));
const CategoryManager = lazy(() => import("@/components/admin/PersonaCategoryManagement"));
const ConceptManagement = lazy(() => import("@/components/admin/ConceptManagement"));
const ConceptCategoryManager = lazy(() => import("@/components/admin/ConceptCategoryManagement"));
const SnapshotPromptManagement = lazy(() => import("@/components/admin/SnapshotPromptManagement"));
const BackgroundRemovalManagement = lazy(() => import("@/components/admin/BackgroundRemovalManagement"));
const ImageGallery = lazy(() => import("@/components/admin/ImageGalleryAdmin"));
const MusicStylePromptManager = lazy(() => import("@/components/admin/MusicStylePromptManager"));
const MissionManagement = lazy(() => import("@/components/admin/MissionManagement"));
const BigMissionManagement = lazy(() => import("@/components/admin/BigMissionManagement"));
const BannerManagement = lazy(() => import("@/components/admin/BannerManagement"));
const SmallBannerManagement = lazy(() => import("@/components/admin/SmallBannerManagement"));
const PopularStyleManagement = lazy(() => import("@/components/admin/PopularStyleManagement"));
const MainGalleryManagement = lazy(() => import("@/components/admin/MainGalleryManagement"));
const CategoryManagement2 = lazy(() => import("@/components/admin/CategoryManagement"));
const ServiceItemManagement = lazy(() => import("@/components/admin/ServiceItemManagement"));
const PhotobookTemplateManagement = lazy(() => import("@/components/admin/PhotobookTemplateManagement"));
const PhotobookBackgroundManagement = lazy(() => import("@/components/admin/PhotobookBackgroundManagement"));
const PhotobookIconManagement = lazy(() => import("@/components/admin/PhotobookIconManagement"));
const PhotobookMaterialCategoryManagement = lazy(() => import("@/components/admin/PhotobookMaterialCategoryManagement"));
const UpscaleSettingsManagement = lazy(() => import("@/components/admin/UpscaleSettingsManagement"));

// Lazy 로딩 스피너
function LazySpinner() {
    return (
        <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
    );
}

// 각 메인 메뉴별 관리 서브탭 정의
interface SubPanel {
    value: string;
    label: string;
    component: React.LazyExoticComponent<React.ComponentType<any>>;
}

const MENU_SUB_PANELS: Record<string, SubPanel[]> = {
    "my-missions": [
        { value: "big-missions", label: "큰미션", component: BigMissionManagement },
    ],
    "culture-center": [
        { value: "mission-categories", label: "미션관리", component: MissionManagement },
    ],
    "ai-create": [
        { value: "chat-characters", label: "채팅 캐릭터", component: PersonaManager },
        { value: "chat-categories", label: "채팅 카테고리", component: CategoryManager },
        { value: "image-concepts", label: "이미지 컨셉", component: ConceptManagement },
        { value: "image-categories", label: "이미지 카테고리", component: ConceptCategoryManager },
        { value: "snapshot-prompts", label: "스냅샷 프롬프트", component: SnapshotPromptManagement },
        { value: "bg-removal", label: "배경제거", component: BackgroundRemovalManagement },
        { value: "image-gallery", label: "이미지 갤러리", component: ImageGallery },
        { value: "music-prompts", label: "음악 프롬프트", component: MusicStylePromptManager },
        { value: "photobook-templates", label: "포토북 템플릿", component: PhotobookTemplateManagement },
        { value: "photobook-backgrounds", label: "포토북 배경", component: PhotobookBackgroundManagement },
        { value: "photobook-icons", label: "포토북 아이콘", component: PhotobookIconManagement },
        { value: "photobook-categories", label: "포토북 카테고리", component: PhotobookMaterialCategoryManagement },
        { value: "upscale-settings", label: "업스케일", component: UpscaleSettingsManagement },
        { value: "banners", label: "슬라이드 배너", component: BannerManagement },
        { value: "small-banners", label: "간단 배너", component: SmallBannerManagement },
        { value: "popular-styles", label: "인기스타일", component: PopularStyleManagement },
        { value: "main-gallery", label: "메인갤러리", component: MainGalleryManagement },
        { value: "service-categories", label: "카테고리", component: CategoryManagement2 },
        { value: "service-items", label: "하위 메뉴", component: ServiceItemManagement },
    ],
    "gallery": [],
    "my-page": [],
};

interface MenuManagementProps {
    activeMissionId?: string | null;
    activeSubmissionId?: string | null;
    onMissionSelect?: (missionId: string | null) => void;
    onSubmissionSelect?: (submissionId: string | null, missionId?: string | null) => void;
}

export default function MenuManagement({
    activeMissionId,
    activeSubmissionId,
    onMissionSelect,
    onSubmissionSelect
}: MenuManagementProps = {}) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const searchParams = new URLSearchParams(window.location.search);
    const [editingMenu, setEditingMenu] = useState<MainMenu | null>(null);
    const [homeSettingMenu, setHomeSettingMenu] = useState<MainMenu | null>(null);

    // URL 연동 - 아코디언 오픈 상태 및 탭 상태 동기화
    const [openMenus, setOpenMenus] = useState<string[]>(() => {
        const urlMenu = searchParams.get('menuItem');
        return urlMenu ? [urlMenu] : [];
    });
    
    const [activePanels, setActivePanels] = useState<Record<string, string>>(() => {
        const urlMenu = searchParams.get('menuItem');
        const urlPanel = searchParams.get('panel');
        if (urlMenu && urlPanel) {
            return { [urlMenu]: urlPanel };
        }
        return {};
    });

    const handleAccordionChange = (values: string[]) => {
        setOpenMenus(values);
        const currentParams = new URLSearchParams(window.location.search);
        
        if (values.length > 0) {
            // 여러 개 열려있을 경우 URL에는 방금 열린 것을 우선 반영
            const lastOpened = values.find(v => !openMenus.includes(v)) || values[0];
            currentParams.set('menuItem', lastOpened);
            const panel = activePanels[lastOpened] || (MENU_SUB_PANELS[lastOpened]?.[0]?.value);
            if (panel) {
                currentParams.set('panel', panel);
            } else {
                currentParams.delete('panel');
            }
        } else {
            currentParams.delete('menuItem');
            currentParams.delete('panel');
        }
        window.history.pushState({}, '', `${window.location.pathname}?${currentParams.toString()}`);
    };

    const handlePanelChange = (menuId: string, panelValue: string) => {
        setActivePanels(prev => ({ ...prev, [menuId]: panelValue }));
        
        const currentParams = new URLSearchParams(window.location.search);
        currentParams.set('menuItem', menuId);
        currentParams.set('panel', panelValue);
        window.history.pushState({}, '', `${window.location.pathname}?${currentParams.toString()}`);
    };

    React.useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const urlMenu = params.get('menuItem');
            const urlPanel = params.get('panel');
            
            if (urlMenu) {
                setOpenMenus(prev => prev.includes(urlMenu) ? prev : [...prev, urlMenu]);
                if (urlPanel) {
                    setActivePanels(prev => ({ ...prev, [urlMenu]: urlPanel }));
                }
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // 관리자용 전체 메뉴 조회
    const { data: menus, isLoading, error } = useQuery<MainMenu[]>({
        queryKey: ["/api/admin/main-menus"],
    });

    // 활성/비활성 토글
    const toggleMutation = useMutation({
        mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
            const res = await apiRequest(`/api/admin/main-menus/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ isActive }),
                headers: { "Content-Type": "application/json" },
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/main-menus"] });
            queryClient.invalidateQueries({ queryKey: ["/api/main-menus"] });
            toast({ title: "메뉴 상태가 변경되었습니다." });
        },
        onError: () => {
            toast({ title: "메뉴 상태 변경 실패", variant: "destructive" });
        },
    });

    // 메뉴 수정
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: Partial<MainMenu> }) => {
            const res = await apiRequest(`/api/admin/main-menus/${id}`, {
                method: "PATCH",
                body: JSON.stringify(data),
                headers: { "Content-Type": "application/json" },
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/main-menus"] });
            queryClient.invalidateQueries({ queryKey: ["/api/main-menus"] });
            setEditingMenu(null);
            setHomeSettingMenu(null);
            toast({ title: "메뉴가 수정되었습니다." });
        },
        onError: () => {
            toast({ title: "메뉴 수정 실패", variant: "destructive" });
        },
    });


    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12 text-red-500">
                메뉴 목록을 불러오는 중 오류가 발생했습니다.
            </div>
        );
    }

    const activeCount = menus?.filter((m) => m.isActive).length || 0;

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">메뉴관리</h2>
                    <div className="text-sm text-muted-foreground mt-1">
                        하단 네비게이션 메뉴를 관리합니다. 활성화된 메뉴: <Badge variant="secondary">{activeCount}개</Badge>
                    </div>
                </div>
            </div>

            {/* 메뉴 목록 */}
            <Accordion type="multiple" value={openMenus} onValueChange={handleAccordionChange} className="space-y-3">
                {menus?.map((menu) => {
                    const IconComponent = iconMap[menu.icon] || Sparkles;
                    const subPanels = MENU_SUB_PANELS[menu.menuId] || [];

                    return (
                        <AccordionItem
                            key={menu.id}
                            value={menu.menuId}
                            className={`border rounded-lg px-4 transition-colors ${menu.isActive
                                ? "bg-card border-border"
                                : "bg-muted/50 border-border/50 opacity-70"
                                }`}
                        >
                            <div className="relative flex items-center w-full [&>h3]:w-full">
                                <AccordionTrigger className="w-full flex-1 p-0 hover:no-underline select-none pr-14">
                                    <div className="flex items-center gap-3 py-3 w-full cursor-pointer">
                                        {/* 드래그 핸들 */}
                                        <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                        </div>

                                        {/* 아이콘 */}
                                        <div
                                            className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${menu.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                                }`}
                                        >
                                            <IconComponent className="h-5 w-5" />
                                        </div>

                                        {/* 메뉴 정보 */}
                                        <div className="flex-1 min-w-0 text-left">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-base">{menu.title}</span>
                                                <Badge variant={menu.isActive ? "default" : "outline"} className="text-xs">
                                                    {menu.isActive ? "활성" : "비활성"}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                <span className="truncate">{menu.path}</span>
                                                {menu.homeType === "submenu" && (
                                                    <span className="text-blue-500 truncate">→ {menu.homeSubmenuPath}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </AccordionTrigger>

                                {/* 활성/비활성 토글 — 플로팅 우측 배치 */}
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10" onClick={(e) => e.stopPropagation()}>
                                    <Switch
                                        checked={menu.isActive}
                                        onCheckedChange={(checked) =>
                                            toggleMutation.mutate({ id: menu.id, isActive: checked })
                                        }
                                        aria-label={`${menu.title} 활성/비활성`}
                                    />
                                </div>
                            </div>

                            <AccordionContent>
                                <div className="pt-2 pb-4 pl-14 space-y-4">
                                    {/* 메뉴 설정 */}
                                    <Card>
                                        <CardHeader className="py-3 px-4">
                                            <CardTitle className="text-sm font-medium">메뉴 설정</CardTitle>
                                        </CardHeader>
                                        <CardContent className="px-4 pb-3 space-y-3">
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">메뉴 ID</Label>
                                                    <p className="font-mono text-xs">{menu.menuId}</p>
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">순서</Label>
                                                    <p>{menu.order}</p>
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">기본 경로</Label>
                                                    <p className="font-mono text-xs">{menu.path}</p>
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">홈 설정</Label>
                                                    <p className="text-xs">
                                                        {menu.homeType === "dedicated"
                                                            ? "전용 홈 페이지"
                                                            : `하위메뉴: ${menu.homeSubmenuPath}`}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 pt-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setEditingMenu({ ...menu })}
                                                >
                                                    <Pencil className="h-3.5 w-3.5 mr-1" />
                                                    수정
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setHomeSettingMenu({ ...menu })}
                                                >
                                                    <Home className="h-3.5 w-3.5 mr-1" />
                                                    홈 설정
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* 인라인 관리 서브탭 패널 */}
                                    {(MENU_SUB_PANELS[menu.menuId] || []).length > 0 && (
                                        <Card>
                                            <CardHeader className="py-3 px-4">
                                                <CardTitle className="text-sm font-medium">관리 기능</CardTitle>
                                            </CardHeader>
                                            <CardContent className="px-4 pb-3">
                                                <Tabs 
                                                    value={activePanels[menu.menuId] || (MENU_SUB_PANELS[menu.menuId] || [])[0]?.value}
                                                    onValueChange={(val) => handlePanelChange(menu.menuId, val)}
                                                >
                                                    <TabsList className="flex flex-wrap h-auto gap-1">
                                                        {(MENU_SUB_PANELS[menu.menuId] || []).map((panel) => (
                                                            <TabsTrigger
                                                                key={panel.value}
                                                                value={panel.value}
                                                                className="text-xs px-2 py-1"
                                                            >
                                                                {panel.label}
                                                            </TabsTrigger>
                                                        ))}
                                                    </TabsList>
                                                    {(MENU_SUB_PANELS[menu.menuId] || []).map((panel) => (
                                                        <TabsContent key={panel.value} value={panel.value}>
                                                            <div className="mt-4">
                                                                <ErrorBoundary>
                                                                    <Suspense fallback={<LazySpinner />}>
                                                                        <panel.component 
                                                                            activeMissionId={activeMissionId}
                                                                            activeSubmissionId={activeSubmissionId}
                                                                            onMissionSelect={onMissionSelect}
                                                                            onSubmissionSelect={onSubmissionSelect}
                                                                        />
                                                                    </Suspense>
                                                                </ErrorBoundary>
                                                            </div>
                                                        </TabsContent>
                                                    ))}
                                                </Tabs>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    );
                })}
            </Accordion>

            {/* 메뉴 수정 다이얼로그 */}
            <Dialog open={!!editingMenu} onOpenChange={() => setEditingMenu(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>메뉴 수정</DialogTitle>
                        <DialogDescription>
                            메뉴의 제목, 아이콘, 경로를 수정합니다.
                        </DialogDescription>
                    </DialogHeader>
                    {editingMenu && (
                        <div className="space-y-4">
                            <div>
                                <Label>메뉴 제목</Label>
                                <Input
                                    value={editingMenu.title}
                                    onChange={(e) =>
                                        setEditingMenu({ ...editingMenu, title: e.target.value })
                                    }
                                />
                            </div>
                            <div>
                                <Label>아이콘</Label>
                                <Select
                                    value={editingMenu.icon}
                                    onValueChange={(v) =>
                                        setEditingMenu({ ...editingMenu, icon: v })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ICON_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>기본 경로</Label>
                                <Input
                                    value={editingMenu.path}
                                    onChange={(e) =>
                                        setEditingMenu({ ...editingMenu, path: e.target.value })
                                    }
                                    placeholder="/mymissions"
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingMenu(null)}>
                            취소
                        </Button>
                        <Button
                            onClick={() => {
                                if (editingMenu) {
                                    updateMutation.mutate({
                                        id: editingMenu.id,
                                        data: {
                                            title: editingMenu.title,
                                            icon: editingMenu.icon,
                                            path: editingMenu.path,
                                        },
                                    });
                                }
                            }}
                            disabled={updateMutation.isPending}
                        >
                            <Save className="h-4 w-4 mr-1" />
                            저장
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 홈 설정 다이얼로그 */}
            <Dialog open={!!homeSettingMenu} onOpenChange={() => setHomeSettingMenu(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>🏠 {homeSettingMenu?.title} 홈 설정</DialogTitle>
                        <DialogDescription>
                            이 메뉴를 탭했을 때 이동할 페이지를 설정합니다.
                        </DialogDescription>
                    </DialogHeader>
                    {homeSettingMenu && (
                        <div className="space-y-4">
                            <div className="space-y-3">
                                <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent">
                                    <input
                                        type="radio"
                                        name="homeType"
                                        value="dedicated"
                                        checked={homeSettingMenu.homeType === "dedicated"}
                                        onChange={() =>
                                            setHomeSettingMenu({
                                                ...homeSettingMenu,
                                                homeType: "dedicated",
                                                homeSubmenuPath: null,
                                            })
                                        }
                                        className="mt-1"
                                    />
                                    <div>
                                        <p className="font-medium text-sm">전용 홈 페이지 사용</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {homeSettingMenu.path} → 현재 메인 페이지로 이동
                                        </p>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent">
                                    <input
                                        type="radio"
                                        name="homeType"
                                        value="submenu"
                                        checked={homeSettingMenu.homeType === "submenu"}
                                        onChange={() =>
                                            setHomeSettingMenu({
                                                ...homeSettingMenu,
                                                homeType: "submenu",
                                            })
                                        }
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <p className="font-medium text-sm">하위메뉴를 홈으로 선택</p>
                                        <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                                            특정 서비스 페이지로 바로 이동
                                        </p>
                                        {homeSettingMenu.homeType === "submenu" && (
                                            <Input
                                                value={homeSettingMenu.homeSubmenuPath || ""}
                                                onChange={(e) =>
                                                    setHomeSettingMenu({
                                                        ...homeSettingMenu,
                                                        homeSubmenuPath: e.target.value,
                                                    })
                                                }
                                                placeholder="/baby-face"
                                                className="text-xs"
                                            />
                                        )}
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setHomeSettingMenu(null)}>
                            취소
                        </Button>
                        <Button
                            onClick={() => {
                                if (homeSettingMenu) {
                                    updateMutation.mutate({
                                        id: homeSettingMenu.id,
                                        data: {
                                            homeType: homeSettingMenu.homeType,
                                            homeSubmenuPath: homeSettingMenu.homeSubmenuPath,
                                        },
                                    });
                                }
                            }}
                            disabled={updateMutation.isPending}
                        >
                            <Save className="h-4 w-4 mr-1" />
                            저장
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
