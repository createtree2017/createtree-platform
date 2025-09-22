import { useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';

interface UseTabHistoryOptions {
  defaultTab: string;
  onTabChange: (tab: string) => void;
}

/**
 * 탭 네비게이션을 브라우저 히스토리에 추가하는 훅
 * 모바일 뒤로가기 버튼으로 탭 간 이동을 가능하게 함
 */
export function useTabHistory({ defaultTab, onTabChange }: UseTabHistoryOptions) {
  const [location, setLocation] = useLocation();

  // URL 해시에서 현재 탭 가져오기
  const getCurrentTab = useCallback(() => {
    const hash = window.location.hash.slice(1); // # 제거
    return hash || defaultTab;
  }, [defaultTab]);

  // 탭 변경 처리
  const changeTab = useCallback((newTab: string) => {
    // URL 해시 업데이트 (히스토리에 추가)
    const newHash = newTab === defaultTab ? '' : `#${newTab}`;
    const newUrl = `${window.location.pathname}${window.location.search}${newHash}`;
    
    // 히스토리에 추가
    window.history.pushState({ tab: newTab }, '', newUrl);
    
    // 탭 변경 콜백 호출
    onTabChange(newTab);
  }, [defaultTab, onTabChange]);

  // 뒤로가기/앞으로가기 처리
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const currentTab = getCurrentTab();
      onTabChange(currentTab);
    };

    // 초기 로드 시 URL에서 탭 읽기
    const initialTab = getCurrentTab();
    if (initialTab !== defaultTab) {
      onTabChange(initialTab);
    }

    // popstate 이벤트 리스너 등록
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [getCurrentTab, defaultTab, onTabChange]);

  return {
    currentTab: getCurrentTab(),
    changeTab,
  };
}