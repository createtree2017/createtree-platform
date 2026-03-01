# 앱 변환(Capacitor + FCM 푸시 준비) 셋업 및 뒤로가기 중앙통제 상세 개발 스펙

## 1. 개요

- **기능명**: 앱 패키징(안드로이드/iOS) 기반 셋업, 푸시 알림 권한 획득, 그리고 하드웨어 물리 뒤로가기의 하이브리드 중앙 통제
- **구현일**: 2026-03-01
- **목적**: 기존 React 기반 PWA 웹을 모바일 네이티브 앱 형태로 쉽게 포팅하고, 웹 환경에서 난잡했던 팝업 뒤로가기 처리를 단 1곳의 중앙 통제소에서 완벽히 융합(브라우저 `popstate` + 안드로이드 기기 하드웨어 `backButton`)하기 위함입니다.
- **관련 문서**:
  - [Plan] `docs/01-plan/features/1-20260228-앱_변환_Capacitor_FCM_푸시_준비_셋업.plan.md`
  - [Design] `docs/02-design/features/1-20260228-앱_변환_Capacitor_FCM_푸시_준비_셋업.design.md`
  - [Analysis] `docs/03-analysis/1-20260228-앱_변환_Capacitor_FCM_푸시_준비_셋업.analysis.md`
  - [Report] `docs/04-report/features/1-20260228-앱_변환_Capacitor_FCM_푸시_준비_셋업.report.md`

## 2. 모바일 앱 환경 설정 사양 (Capacitor)

- **앱 식별자(appId)**: `com.createtree.app`
- **플러그인 환경**: `@capacitor/core`, `@capacitor/android`, `@capacitor/ios`, `@capacitor/app`, `@capacitor/push-notifications` (버전 6.x 이상 호환성 확보)
- **앱 빌드 타겟**: 웹 빌드 결과물(`dist` 폴더)을 WebView에서 호스팅하거나, `server.url` 옵션을 통해 Railway 라이브 서버 환경으로 즉시 구동됩니다.
- **CSS 네이티브 최적화**:
  - `client/src/index.css` 전역 설정 반영
  - `user-select: none` 및 웹 뷰 하이라이트/돋보기 제어 로직 적용
  - `overscroll-behavior-y: none`을 통해 고무줄 스크롤(Rubber-banding) 차단

## 3. 핵심 아키텍처: 중앙 뒤로 가기 통제소

이 시스템은 Capacitor `App` 리스너와 기존 React Context(`ModalContext`)가 한 점에서 만나 결합하는 핵심 아키텍처입니다. 모바일 기기의 뒤로 가기를 누를 때, 스크린 이동 전에 먼저 팝업창(모달, 시트)을 청소합니다.

### 3.1. `useMobileHardwareBack.ts`

- **구독(Listener)**: `App.addListener('backButton', callback)`
- **동작 원리**:
  1. 기기의 물리적 뒤로 가기 버튼이 눌림
  2. `useModalContext`에서 가져온 전역 상태 `modalStack.length` 검사.
  3. 만약 1개 이상의 스택(모달)이 존재한다면, 브라우저 History(url) 이동을 **차단**하고 `closeTopModal()`을 호출하여 최상단 팝업만 제거.
  4. 모달 스택이 비어있는 상태라면 안드로이드 WebView의 네이티브 라우팅(`window.history.back()`)을 정상 수행.
  5. 더 이상 갈 곳이 없는 최상단 계층(루트)이라면, 안드로이드 기본 동작인 `App.minimizeApp()`을 호출해 앱을 백그라운드로 보냄.

### 3.2. 기존 React `popstate`와의 완벽한 융합

- 스마트폰 하드웨어 버튼뿐 아니라 데스크톱 창, Safari(iOS) 브라우저의 일반 브라우저 뒤로 가기를 눌렀을 시에도 `ModalContext`의 `handlePopState` 리스너가 동일한 효과(팝업 닫기)를 적용합니다.

## 4. 푸시 알림 (FCM Push Notifications)

### 4.1. `usePushNotifications.ts`

- **목적**: 기기 고유의 FCM Token 확보 및 안드로이드 알림 권한 획득 처리
- **안전장치**: 브라우저 환경에서 이 앱이 구동될 때 알림 에러가 발생하여 뻗는 현상을 방지하기 위해 `Capacitor.isNativePlatform()` 검사를 선행합니다.
- **동작 방식**:
  - 권한 요청 (`PushNotifications.requestPermissions()`)
  - FCM 디바이스 단말기 등록 메커니즘 (`PushNotifications.register()`)
  - 토큰 획득 이벤트 감지 후 `fcmToken` 상태값으로 저장
  - 향후 서버 연동 시 발급된 `fcmToken`을 사용자 계정에 맵핑할 수 있는 징검다리 역할.

### 4.2. 전역 렌더링 (`App.tsx`)

위 2개의 강력한 훅은 `App.tsx` 파일 내에 컴포넌트(`<CapacitorGlobalListeners />`) 형태로 묶여, 전체 라우터 및 테마, Toaster 등과 동일한 최상단 생명 주기에서 24시간 백그라운드로 작동하게끔 설계되었습니다.

## 5. 변경 파일 목록 요약

- `client/capacitor.config.ts` (신규)
- `client/src/index.css` (수정)
- `client/src/contexts/ModalContext.tsx` (기능 고도화)
- `client/src/hooks/useMobileHardwareBack.ts` (신규)
- `client/src/hooks/usePushNotifications.ts` (신규)
- `client/src/App.tsx` (전역 리스너 마운트 수정)
