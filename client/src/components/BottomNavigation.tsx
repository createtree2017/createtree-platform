/**
 * BottomNavigation — 하단 네비게이션 컴포넌트 (리뉴얼 v2)
 *
 * 디자인 컨셉:
 *  - 중앙 AI 생성 버튼: 네비게이션 위로 돌출되는 FAB (앱 로고 삽입, 브랜드 글로우 효과)
 *  - 좌우 4개 메뉴: 완벽한 조연 역할 (평면화, 활성/비활성 상태 명확한 대비)
 *  - 상단 테두리: 아주 은은한 반사광 글래스모피즘 Edge 라인
 *  - 나의미션 숨김 시: 4개 → 중앙 FAB는 고정, 좌우 균등 배치
 */

import React from 'react';
import { Link, useLocation } from 'wouter';
import { useMainMenus, NavItem } from '@/hooks/useMainMenus';

// MAIN_PAGE_PATHS를 동적으로 제공하는 Hook (App.tsx에서 사용)
export { useMainMenus } from '@/hooks/useMainMenus';

// 폴백용 정적 경로 (React Hook 외부에서 사용하는 경우 대비)
export const MAIN_PAGE_PATHS = ['/', '/missions', '/gallery', '/profile'];

// 중앙 FAB 버튼 컴포넌트 (AI 생성 / 로고)
function CenterFabButton({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    // 높이를 충분히 주어 FAB원이 위로 돌출될 공간 확보 + overflow: visible 강제
    <div
      className="relative flex flex-col items-center justify-end flex-shrink-0"
      style={{ width: 72, height: '100%', overflow: 'visible' }}
    >
      {/* FAB 버튼 링크 — 원이 네비 상단으로 돌출됨 */}
      <Link
        to={item.path}
        aria-label={item.ariaLabel}
        onClick={() => window.scrollTo(0, 0)}
        className="flex flex-col items-center"
        style={{ marginBottom: 4, overflow: 'visible', position: 'relative' }}
      >
        {/* 원형 FAB — 크기와 글로우 */}
        <div
          className="flex items-center justify-center rounded-full transition-transform duration-300 hover:scale-110 active:scale-95"
          style={{
            width: 62,
            height: 62,
            marginTop: -30, // 네비 상단 위로 30px 밀어올림
            background: isActive
              ? 'linear-gradient(135deg, #a855f7 0%, #6366f1 50%, #06b6d4 100%)'
              : 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #0891b2 100%)',
            // 1단 링은 네비 바 전체로 이동 — FAB 원 자체에는 링 없이 글로우만
            boxShadow: isActive
              ? '0 0 28px rgba(168,85,247,0.7), 0 0 50px rgba(99,102,241,0.35), 0 -4px 16px rgba(168,85,247,0.25)'
              : '0 0 18px rgba(99,102,241,0.5), 0 0 35px rgba(99,102,241,0.2), 0 -2px 10px rgba(99,102,241,0.15)',
          }}
        >
          {/* 로고 이미지 */}
          <img
            src="/icons/icon-96x96.png"
            alt="AI 생성"
            className="rounded-full object-cover"
            style={{ width: 38, height: 38 }}
          />
        </div>

        {/* 라벨 */}
        <span
          className="font-semibold transition-all duration-300"
          style={{
            fontSize: 10,
            marginTop: 4,
            color: isActive ? '#a855f7' : '#9ca3af',
            letterSpacing: '0.02em',
          }}
        >
          {item.label}
        </span>
      </Link>
    </div>
  );
}

// 일반 메뉴 아이템 컴포넌트 (조연)
function NavMenuItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const IconComponent = item.icon;

  return (
    <Link
      to={item.path}
      aria-label={item.ariaLabel}
      onClick={() => window.scrollTo(0, 0)}
      className="flex flex-col items-center justify-center flex-1 py-1.5 relative group min-w-0"
    >
      {/* 아이콘 */}
      <div className="flex items-center justify-center w-9 h-9">
        <IconComponent
          size={20}
          strokeWidth={isActive ? 2.5 : 1.5}
          className={`transition-all duration-300 ${
            isActive
              ? 'text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.4)]'
              : 'text-zinc-500 group-hover:text-zinc-300'
          }`}
        />
      </div>

      {/* 라벨 */}
      <span
        className={`text-[10px] font-semibold transition-all duration-300 leading-none ${
          isActive ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'
        }`}
      >
        {item.label}
      </span>

      {/* Active 인디케이터 — 아이콘 위 짧은 라인 */}
      <span
        className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full transition-all duration-300"
        style={{
          width: isActive ? 20 : 0,
          height: 2,
          background: 'linear-gradient(90deg, #a855f7, #6366f1)',
          opacity: isActive ? 1 : 0,
        }}
      />
    </Link>
  );
}

// 메인 컴포넌트
export default function BottomNavigation() {
  const [location] = useLocation();
  const { navItems } = useMainMenus();

  // AI 생성 (center FAB) 과 나머지 메뉴 분리
  const fabItem = navItems.find((item) => item.menuId === 'ai-create');
  const sideItems = navItems.filter((item) => item.menuId !== 'ai-create');

  // 좌우 균등 분배: floor/ceil을 사용해 좌측이 더 적거나 같게 유지
  // 예) 4개: [문화센터,갤러리] | FAB | [MY] → 2:1 이 아닌,
  //      [문화센터] | FAB | [갤러리, MY] — 왼쪽 floor, 오른쪽 ceil
  //      3개: [문화센터] | FAB | [갤러리, MY]
  //      4개: [나의미션, 문화센터] | FAB | [갤러리, MY]  ← 완벽 균형
  const mid = Math.floor(sideItems.length / 2);
  const leftItems = sideItems.slice(0, mid);
  const rightItems = sideItems.slice(mid);

  return (
    // overflow: visible 필수 — FAB가 위로 튀어나오려면 부모가 잘라내지 않아야 함
    <div className="fixed bottom-0 left-0 right-0 z-50" style={{ overflow: 'visible' }}>
      {/* 네비게이션 본체 — justify-around 제거, 대신 좌/우 래퍼가 각각 flex-1로 자체 상단*/}
      <nav
        className="flex items-end px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]"
        style={{
          minHeight: 72,
          paddingTop: 16, // FAB가 위로 올라올 공간
          overflow: 'visible', // FAB 잘림 방지
          background: 'rgba(14, 14, 20, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '20px 20px 0 0',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          borderBottom: 'none',
          boxShadow: '0 -4px 30px rgba(0,0,0,0.3), 0 0 0 1px rgba(168,85,247,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* 왜쪽 메뉴 그룹 — flex-1 영역 내에서 자체 균등 정렬 */}
        <div className="flex flex-1 justify-around items-end">
          {leftItems.length > 0 ? (
            leftItems.map((item) => (
              <NavMenuItem key={item.path} item={item} isActive={location === item.path} />
            ))
          ) : (
            // 왜쪽 메뉴가 없어도 오른쪽과 반대와 균형을 맞춤을 위해 빈 공간 유지
            <div className="flex-1" />
          )}
        </div>

        {/* 중앙 FAB 버튼 — 항상 정중앙 고정 */}
        {fabItem ? (
          <CenterFabButton item={fabItem} isActive={location === fabItem.path} />
        ) : (
          <div style={{ width: 72, flexShrink: 0 }} />
        )}

        {/* 오른쪽 메뉴 그룹 — flex-1 영역 내에서 자체 균등 정렬 */}
        <div className="flex flex-1 justify-around items-end">
          {rightItems.map((item) => (
            <NavMenuItem key={item.path} item={item} isActive={location === item.path} />
          ))}
        </div>
      </nav>
    </div>
  );
}