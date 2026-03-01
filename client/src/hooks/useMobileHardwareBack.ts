import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { useModalContext } from '../contexts/ModalContext';

/**
 * Android 네이티브 하드웨어 뒤로 가기(Back) 버튼 제어 훅
 * ModalContext(전역 모달 상태)와 연동하여 팝업/모달이 열려있으면 차단하고 팝업만 닫습니다.
 */
export function useMobileHardwareBack() {
  const { modalStack, closeTopModal } = useModalContext();

  useEffect(() => {
    // 백 버튼 이벤트 리스너 등록
    const backButtonListener = App.addListener('backButton', ({ canGoBack }) => {
      // 1순위: 열려있는 모달/바텀시트가 있는지 확인
      if (modalStack.length > 0) {
        // 모달이 있다면 히스토리 이동 없이 최상단 모달만 안전하게 닫음 (기존 웹 popstate와 동기화됨)
        closeTopModal();
        return;
      }

      // 2순위: 모달이 없다면 기본 라우팅 히스토리(웹) 의존
      if (canGoBack) {
        window.history.back();
      } else {
        // 더 이상 뒤로 갈 수 없다면 앱 자체를 백그라운드로 전환 (안드로이드 기본 동작)
        App.minimizeApp();
      }
    });

    // 클린업 함수
    return () => {
      backButtonListener.then(listener => listener.remove());
    };
  }, [modalStack.length, closeTopModal]);
}
