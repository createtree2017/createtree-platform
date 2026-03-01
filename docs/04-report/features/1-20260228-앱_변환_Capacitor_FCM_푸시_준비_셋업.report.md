# 앱 변환(Capacitor + FCM 푸시 준비) 셋업 및 뒤로가기 중앙통제 완료 보고서

## 개요

- **기능명**: 앱 변환(Capacitor + FCM 푸시 준비) 셋업 및 뒤로가기 중앙통제
- **작성일**: 2026-03-01
- **작업 기간**: 2026-02-28 ~ 2026-03-01

## PDCA 사이클 요약

### 계획 (Plan)

- 계획 문서: `docs/01-plan/features/1-20260228-앱_변환_Capacitor_FCM_푸시_준비_셋업.plan.md`
- 목표: 기존 React + Vite 웹 프로젝트를 기반으로 안드로이드 네이티브 앱(APK) 패키징을 위한 Capacitor 도입, 푸시 알림 플러그인 장착, 그리고 하드웨어 물리 뒤로가기 버튼과 기존 웹 뒤로가기의 양방향 완벽 제어를 위한 전역 수문장(ModalContext 확장) 구축.

### 설계 (Design)

- 설계 문서: `docs/02-design/features/1-20260228-앱_변환_Capacitor_FCM_푸시_준비_셋업.design.md`
- 주요 설계 결정:
  - 앱(Capacitor)과 웹(Browser) 환경에서 파편화된 뒤로가기 및 팝업 닫기 로직을 버리고 오직 `ModalContext`의 `openModal`과 `closeTopModal`로 단일화/중앙집중화하기로 설계.
  - Capacitor 네이티브 물리 버튼 이벤트 감지 통제(`useMobileHardwareBack.ts`) 및 FCM 연동 초기화 훅(`usePushNotifications.ts`) 신규 분리 배치.
  - 앱 뷰(WebView) 특유의 Rubber-banding 및 돋보기 이슈 해결용 CSS 처리.

### 구현 (Do)

- 구현 범위:
  - `client/capacitor.config.ts` 및 Android 플랫폼 추가 (`npx cap add android`)
  - `client/src/index.css`: 모바일 및 웹뷰 UI 최적화(user-select 제어 등)
  - `client/src/hooks/useMobileHardwareBack.ts`: 물리 뒤로 가기 리스너 및 1순위 모달 방어 로직 구현
  - `client/src/hooks/usePushNotifications.ts`: 푸시 권한 획득 플러그인 탑재
  - `client/src/App.tsx`: 최상단 Capacitor 글로벌 훅 탑재
- 실제 작업량: 약 1일 (2026-02-28 야간 ~ 2026-03-01 새벽)

### 검증 (Check)

- 분석 문서: `docs/03-analysis/1-20260228-앱_변환_Capacitor_FCM_푸시_준비_셋업.analysis.md`
- 매치율: 95%
- 자체 검증: 로컬 Vite 데브 환경에서 브라우저 렌더링 정상 동작(플러그인 충돌 없음) 및 기존 웹 서비스 연동 정상 테스트 통과 완료.

## 완료 항목

- ✅ Capacitor 코어 패키지 설치 및 설정 (`com.createtree.app`)
- ✅ Capacitor Android 플랫폼 프로젝트 생성
- ✅ 물리적 버튼 뒤로 가기 중앙통제 (`useMobileHardwareBack` 연동)
- ✅ 네이티브 환경 푸시 알림 토큰 획득 준비 (`usePushNotifications` 연동)
- ✅ App.tsx 최상단 글로벌 이벤트 리스너 통합 장착
- ✅ 웹뷰 Rubber-banding 튕김/하이라이트 방지 CSS 전역 반영

## 미완료/보류 항목

- ⏸️ 서버(Backend) API 연동: 획득한 FCM Device Token을 사용자 DB와 묶어 저장하는 API(`POST /api/users/device-token`)는 추후 푸시 발송 시스템 백엔드 작업 시 구현 예정.

## 교훈 (회고)

### 잘된 점

- 웹페이지에 수십 개의 모달(`useModalHistory`) 파편화가 존재하던 것을 하나의 Single Source of Truth(`ModalContext`)로 통합함으로써 **앱(APK) 변환 비용(하드웨어 코딩량)을 획기적으로 낮춘 점**.
- 브라우저 개발 모드에서도 Capacitor 플러그인이 터지지 않도록 `isNativePlatform()` 분기 처리를 훌륭하게 수행함.

### 개선할 점

- 개발 과정 중 Capacitor 설정 파일 초기화 시 문법 에러 등 터미널 조작성 이슈가 잠시 일어났으나, 에러 코드 분석으로 빠르게 치유함.

### 다음에 적용할 것

- 이번에 분리해 낸 FCM Token 수집 로직(`usePushNotifications.ts`)을 확장하여 실제 Firebase SDK 백엔드에서 푸시 전송 테스트 환경을 구성할 것.

## 다음 단계

- 백엔드 푸시 토큰 DB 테이블 마이그레이션(Drizzle) 및 저장 API 개발
- 구글 파이어베이스 콘솔(google-services.json) 프로젝트 연동 최종 확인 및 Android Studio 로컬 APK 빌드 테스트
