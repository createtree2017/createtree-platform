import { useEffect, useCallback, useRef } from 'react';

interface UseModalHistoryOptions {
  isOpen: boolean;
  onClose: () => void;
  modalId?: string;
}

/**
 * 모달/오버레이를 브라우저 히스토리에 추가하는 훅
 * 모바일 뒤로가기 버튼으로 모달을 닫을 수 있게 함
 */
export function useModalHistory({ isOpen, onClose, modalId = 'modal' }: UseModalHistoryOptions) {
  const hasAddedHistory = useRef(false);

  // 모달이 열릴 때 히스토리 추가
  useEffect(() => {
    if (isOpen && !hasAddedHistory.current) {
      // 현재 상태를 히스토리에 저장
      const currentState = { modal: modalId };
      window.history.pushState(currentState, '', `#${modalId}`);
      hasAddedHistory.current = true;
    } else if (!isOpen && hasAddedHistory.current) {
      // 모달이 닫힐 때 히스토리 정리
      hasAddedHistory.current = false;
    }
  }, [isOpen, modalId]);

  // 뒤로가기 처리
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // 현재 URL 해시 확인
      const currentHash = window.location.hash.slice(1);
      
      // 이전 상태로 돌아갔고 모달이 열려있다면 닫기
      if (currentHash !== modalId && isOpen) {
        onClose();
        hasAddedHistory.current = false;
      }
    };

    if (isOpen) {
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isOpen, onClose, modalId]);

  // 모달을 닫을 때 히스토리 정리
  const closeWithHistory = useCallback(() => {
    if (hasAddedHistory.current) {
      // 해시가 현재 모달 ID와 같다면 뒤로가기
      if (window.location.hash === `#${modalId}`) {
        window.history.back();
      }
      hasAddedHistory.current = false;
    }
    onClose();
  }, [onClose, modalId]);

  return {
    closeWithHistory,
  };
}