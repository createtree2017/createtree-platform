import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * 모바일 브라우저 종료 방지 훅
 * 로그인된 사용자가 사이트를 벗어나려고 할 때 확인 메시지 표시
 */
export function useBeforeUnload(enabled: boolean = true) {
  const { user } = useAuth();

  useEffect(() => {
    // 로그인된 사용자이고 기능이 활성화된 경우에만 작동
    if (!enabled || !user) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // 표준 방법: returnValue 설정
      event.returnValue = 'AI문화센터를 종료하시겠습니까?';
      
      // 일부 브라우저를 위한 대체 방법
      return 'AI문화센터를 종료하시겠습니까?';
    };

    // 뒤로가기/새로고침/탭 닫기 감지
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 정리 함수
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, user]);
}

/**
 * 페이지별 종료 방지 설정
 */
export const usePageExitPrevention = (options: {
  // 특정 페이지에서만 활성화
  enableOnPages?: string[];
  // 특정 조건에서만 활성화 (예: 폼 작성 중)
  enableWhen?: () => boolean;
} = {}) => {
  const { enableOnPages, enableWhen } = options;
  
  // 현재 경로 확인
  const currentPath = window.location.pathname;
  
  // 페이지 조건 확인
  const shouldEnableByPage = !enableOnPages || enableOnPages.some(path => 
    currentPath.includes(path)
  );
  
  // 커스텀 조건 확인
  const shouldEnableByCondition = !enableWhen || enableWhen();
  
  // 최종 활성화 여부
  const shouldEnable = shouldEnableByPage && shouldEnableByCondition;
  
  useBeforeUnload(shouldEnable);
  
  return shouldEnable;
};