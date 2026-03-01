# 앱 변환(Capacitor + FCM 푸시 준비) 셋업 계획서

## 개요

- **기능명**: 앱 변환(Capacitor + FCM 푸시 준비) 셋업
- **작성일**: 2026-02-28
- **목표**: 기존 React 기반 웹 서비스(createTree)를 안드로이드 네이티브 앱(APK)으로 패키징하고, 추후 푸시 알림 발송을 위한 FCM 플러그인 연동 및 기기 토큰 수집 환경을 구축한다.

## 배경

- 스토어 심사 지연 없이 즉각적인 비즈니스 전개(병원 QR 앱 직접 배포)를 위해 안드로이드 전용 APK 제작이 필요함.
- 브라우저 PWA 환경의 사용자 경험 한계(고무줄 효과 튕김, 뒤로가기 제어 불가 등)를 극복하고 진짜 전용 스마트폰 앱의 경험을 제공해야 함.
- 초기 배포 시 푸시 알림 수신용 내부 플러그인을 미리 탑재하여, 향후 껍데기(APK) 재설치나 강제 업데이트 요구 없이 서버 연동만으로 푸시 알림을 발송할 수 있는 기반을 마련함.

## 범위

### 포함

- 프론트엔드(`client`) 프로젝트에 Capacitor 세팅 및 안드로이드 플랫폼 초기화.
- 앱 기본 메타데이터 설정 (앱 이름, 패키지 ID, 등).
- Railway에 배포된 라이브 웹사이트 URL을 바라보도록 WebView 구성 설정.
- Capacitor 푸시 알림 플러그인(`@capacitor/push-notifications`) 설치 및 앱 구동 시 알림 권한 획득/FCM 토큰 발급 프론트엔드 로직 작성.
- 브라우저 특유의 동작(Rubber-banding 방지, 텍스트 선택 강제 등) 앱 환경용 차단 로직 적용.
- (선택) 안드로이드 하드웨어 기기의 '뒤로가기' 버튼 제어 로직 모듈 추가.

### 제외

- 구글 플레이스토어 정식 등록 및 20명 테스터 연동 절차 (추후 단계).
- 서버(백엔드) 사이드의 실제 푸시 발송 로직 개발 (이번 계획은 앱 단말기의 수신 환경 구축에 한정됨).
- 애플 iOS 코어 빌드 및 배포 절차.

## 기술 요구사항

- **Frontend**:
  - `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` 라이브러리 연동
  - `@capacitor/push-notifications` 적용
  - 앱 진입점(`App.tsx` 등)에서 네이티브 API(Device/알림 권한) 호출 훅(Hook) 작성
- **Backend**: 해당 없음 (토큰 전달을 위한 API 스펙은 향후 백엔드 푸시 구현 단계에서 정의 가능).
- **System**:
  - `capacitor.config.ts` (라이브 서버 호스팅 URL 지정 및 Android 설정)
  - 구글 파이어베이스 콘솔(Firebase Console) 프로젝트 생성 및 `google-services.json` 세팅

## 영향 범위

- 영향 받는 기존 기능: 없음 (앱 모드로 동작할 때의 분기 처리 추가됨)
- 수정 필요한 파일 예상:
  - `client/package.json`
  - `client/vite.config.ts` 또는 index.html (모바일 최적화 메타 설정)
  - `client/src/App.tsx`
  - `client/capacitor.config.ts` (신규 파일)

## 예상 일정

- 예상 작업량: 1~2일
- 우선순위: 매우 높음 (배포 전략의 핵심 기능)

## 다음 단계

→ Plan 완료 후 `/design 앱 변환(Capacitor + FCM 푸시 준비) 셋업`으로 상세 설계 문서를 작성합니다.
