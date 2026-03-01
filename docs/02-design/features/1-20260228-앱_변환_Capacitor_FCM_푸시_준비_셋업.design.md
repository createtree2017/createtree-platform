# 앱 변환(Capacitor + FCM 푸시 준비) 셋업 및 뒤로가기 중앙통제 설계서

## 개요

- **기능명**: 앱 변환(Capacitor + FCM 푸시 준비) 셋업 및 뒤로가기 중앙통제
- **작성일**: 2026-02-28
- **Plan 참조**: `docs/01-plan/features/1-20260228-앱_변환_Capacitor_FCM_푸시_준비_셋업.plan.md`

## 시스템 아키텍처 및 목표

기존 React 웹 서비스를 안드로이드 네이티브 앱(APK)으로 패키징하기 위한 프론트엔드(`client`) 환경을 구성합니다. 특히 기존 PWA 환경에서 제어가 어려웠던 **'하드웨어 뒤로 가기(Back) 버튼'**을 완벽히 통제하기 위한 **전역 모달/탭 상태 관리 시스템(중앙 통제소)** 구축을 최우선 목표로 합니다.

## 컴포넌트 구조

### 1. Capacitor 모바일 셋업

기존 `vite` 기반 React 프로젝트에 Capacitor 엔진을 통합합니다.

- **`client/capacitor.config.ts` (신규)**
  - 앱 메타 정보(appId, appName 등) 설정.
  - `server.url` 속성을 이용하여 배포된 라이브 사이트 URL(Railway 주소) 지정 모드 또는 로컬 번들 모드 설정 기능 제공.
- **`client/package.json`**
  - `@capacitor/core`, `@capacitor/android`, `@capacitor/ios`, `@capacitor/cli` 설치.
  - 외부 플러그인 `@capacitor/push-notifications`, `@capacitor/app` 설치 및 의존성 명시.
- **`client/index.html` (수정)**
  - 네이티브 앱 느낌을 위한 모바일 최적화 (Rubber-banding, 사용자 텍스트 강제 선택 차단 CSS 속성 `user-select: none`, 환경 변수를 통한 PWA 인스톨 프롬프트 억제 설정).

### 2. 푸시 알림 클라이언트 설정

- **`client/src/hooks/usePushNotifications.ts` (신규)**
  - Firebase Cloud Messaging 연동 훅.
  - Capacitor `PushNotifications` API를 사용해 알림 수신 동의 팝업 표시 및 고유 FCM 토큰(Token) 발급 로직.

### 3. [핵심] 정밀 뒤로 가기 중앙 통제 시스템

하드웨어 뒤로가기와 웹 브라우저의 뒤로가기 이벤트를 모두 단일 컨트롤 타워에서 받아 처리합니다.

- **`client/src/contexts/ModalContext.tsx` (수정/확장)**
  - **전역 상태 배열 관리**: 현재 열려있는 팝업, 모달, 바텀 시트 등의 상태를 배열 형태의 스택(`modalStack`)으로 중앙 관리.
- **`client/src/hooks/useMobileHardwareBack.ts` (신규 핵심 컴포넌트)**
  - Capacitor의 `App.addListener('backButton')` 리스너를 한 곳에 등록.
  - **[우선순위 로직 제어]**
    1. `modalStack.length > 0`: 열려 있는 팝업/모달이 있다면 최상단 1개만 `close()` (페이지 뒤로 가기 차단).
    2. 메인 페이지의 탭 이동 중이라면: 이전 탭 상태로 복구 (페이지 이동 없이 화면 전환).
    3. `modalStack`이 비어있다면: 비로소 역방향 히스토리 라우팅(`window.history.back()` 등) 허용하여 진짜 이전 페이지로 이동.

## API 설계 (앱 패키징 특성상 통신 없음)

### FCM 토큰 연동 계획 (추후 Backend 작업 연계용)

앱에서 발급받은 푸시 토큰 정보를 우리 서버 사용자 DB와 연결할 스펙을 미리 정의해 둡니다.

| Method | Path                      | 설명                                | 인증 |
| ------ | ------------------------- | ----------------------------------- | ---- |
| POST   | `/api/users/device-token` | 회원의 스마트폰 푸시 토큰(FCM) 저장 | 필요 |

```json
// Request 예시
{
  "fcmToken": "c1x2...zO7",
  "deviceType": "android"
}
```

## 에러 처리

| 플러그인 / 상황                          | 사용자 메시지    | 내부 처리 로직                                                                             |
| ---------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| FCM 설정 누락(google-services.json 없음) | 콘솔 로그만 발생 | Capacitor 앱 구동은 허용하되, PushNotification 훅 초기화 중단 (앱은 정상 작동 유지)        |
| 뒤로 가기 중앙통제 훅 에러               | 없음             | 에러 발생 시 최후의 보루로 `window.history.back()` 강제 실행하여 앱 먹통(Freeze) 상태 방지 |

## 구현 순서

1. **[Android 세팅]**: `client` 디렉토리에서 `@capacitor/cli` 및 관련 코어 패키지 설치.
2. **[Capacitor Init]**: `npx cap init` 등 명령어로 `capacitor.config.ts`, `android` 폴더 구조 생성. Firebase `google-services.json` 文件 투입.
3. **[프론트 강화 1]**: 앱 특유 UI 잔상 차단 (`user-select` 등 CSS 튜닝) 및 PWA 간섭 해제.
4. **[프론트 강화 2 - 핵심]**: 중앙 통제 통신망(`useMobileHardwareBack.ts`, `ModalContext` 등) 구축 및 기존의 파편화된 뒤로 가기(`popstate`) 로직을 일괄 정리하여 중앙통제소 관할로 이전.
5. **[프론트 강화 3]**: FCM Push 초기화 및 토큰 발급 훅(`usePushNotifications`) 장착 및 `App.tsx` 최상단 등록.
6. **로컬 테스트(선택)**: Android Studio 실행 및 `createtree` APK 빌드 테스트를 통해 화면, 뒤로가기, 권한 팝업 모의 테스트 진행.
