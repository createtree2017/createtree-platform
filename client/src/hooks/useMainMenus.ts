/**
 * useMainMenus — 메인 메뉴 데이터를 API에서 가져오는 커스텀 훅
 * 
 * /api/main-menus (공개 API)로 활성화된 메뉴 목록을 가져옴
 * API 실패 시 하드코딩된 폴백 데이터 반환
 */

import { useQuery } from "@tanstack/react-query";
import { Trophy, Target, Sparkles, Images, User, Home, Settings } from "lucide-react";

// 아이콘 문자열 → 컴포넌트 매핑
const iconMap: Record<string, React.ForwardRefExoticComponent<any>> = {
    Trophy,
    Target,
    Sparkles,
    Images,
    User,
    Home,
    Settings,
};

export interface MainMenuData {
    id: number;
    menuId: string;
    title: string;
    icon: string;
    path: string;
    homeType: string;
    homeSubmenuPath: string | null;
    isActive: boolean;
    order: number;
}

export interface NavItem {
    path: string;
    icon: React.ForwardRefExoticComponent<any>;
    label: string;
    ariaLabel: string;
    menuId: string;
}

// 폴백 메뉴 (API 실패 시 사용)
const FALLBACK_MENUS: NavItem[] = [
    { path: "/missions", icon: Target, label: "문화센터", ariaLabel: "문화센터 페이지", menuId: "culture-center" },
    { path: "/", icon: Sparkles, label: "AI 생성", ariaLabel: "AI 이미지 생성 페이지", menuId: "ai-create" },
    { path: "/gallery", icon: Images, label: "갤러리", ariaLabel: "이미지 갤러리 페이지", menuId: "gallery" },
    { path: "/profile", icon: User, label: "MY", ariaLabel: "마이페이지", menuId: "my-page" },
];

const FALLBACK_PATHS = ["/", "/missions", "/gallery", "/profile"];

export function useMainMenus() {
    const { data: menus, isLoading, error } = useQuery<MainMenuData[]>({
        queryKey: ["/api/main-menus"],
        staleTime: 5 * 60 * 1000, // 5분 캐시
        retry: 2,
    });

    // API 데이터를 NavItem 형태로 변환
    const navItems: NavItem[] = menus && menus.length > 0
        ? menus.map((menu) => ({
            path: menu.homeType === "submenu" && menu.homeSubmenuPath
                ? menu.homeSubmenuPath
                : menu.path,
            icon: iconMap[menu.icon] || Sparkles,
            label: menu.title,
            ariaLabel: `${menu.title} 페이지`,
            menuId: menu.menuId,
        }))
        : FALLBACK_MENUS;

    // 메인 페이지 경로 (하단바 표시 조건)
    const mainPagePaths: string[] = menus && menus.length > 0
        ? menus.map((menu) =>
            menu.homeType === "submenu" && menu.homeSubmenuPath
                ? menu.homeSubmenuPath
                : menu.path
        )
        : FALLBACK_PATHS;

    return {
        navItems,
        mainPagePaths,
        isLoading,
        error,
        rawMenus: menus,
    };
}
