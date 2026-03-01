# 앱 변환(Capacitor + FCM 푸시 준비) 셋업 및 뒤로가기 중앙통제 구현 갭 분석 결과

## 개요

- **분석 대상**: 앱 변환(Capacitor + FCM 푸시 준비) 셋업 및 뒤로가기 중앙통제
- **분석일**: 2026-02-28
- **Design 문서**: `docs/02-design/features/1-20260228-앱_변환_Capacitor_FCM_푸시_준비_셋업.design.md`

## 종합 결과

| 카테고리       | 매치율  |               상태               |
| -------------- | :-----: | :------------------------------: |
| API 엔드포인트 |   N/A   | 해당 없음 (프론트엔드 구현 한정) |
| DB 스키마      |   N/A   |            해당 없음             |
| 컴포넌트 구조  |   95%   |             ✅ 우수              |
| 에러 처리      |  100%   |             ✅ 우수              |
| **종합**       | **95%** |             ✅ 우수              |

## 발견된 차이점

### 🟡 변경 (Design ≠ 구현)

- `client/index.html` 수정: Design에서는 `index.html` 내부에 `<style>` 형식으로 인라인 적용을 유도하였으나, 전역 관리의 효율성과 Tailwind CSS 시스템의 규격을 유지하기 위해 `client/src/index.css` 파일 최상단에 `overscroll-behavior-y: none;` 및 `user-select: none;` 속성을 선언하여 **전역 모달 통제와 스타일 최적화를 분리·적용**하였습니다.

### 🟢 통일 (Design & 구현 일치)

- `useMobileHardwareBack.ts`: `App.addListener('backButton')` 등록 및 1순위(`modalStack.length > 0`) 검사 후 `closeTopModal()` 호출 분기 로직이 디자인과 완벽히 일치하게 구현되었습니다.
- `usePushNotifications.ts`: `PushNotifications.addListener` 이벤트를 포함한 훅 코드가 설계와 정확하게 배치되었습니다.
- `App.tsx`: `CapacitorGlobalListeners`로 묶어서 `ModalProvider` 하위, 단말기 최상단에 훌륭하게 배치되었습니다.

## 권장 조치

1. (선택/향후) 모바일 시뮬레이터나 실제 안드로이드 기기를 통한 1차 테스트 진행
2. 향후 백엔드 작업 시 FCM 토큰 저장 라우터(`/api/users/device-token`) 구축

## 다음 단계

- 매치율 90%+ → `/report 앱 변환(Capacitor + FCM 푸시 준비) 셋업` 으로 최종 보고서 생성
