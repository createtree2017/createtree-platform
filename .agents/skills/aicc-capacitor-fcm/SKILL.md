---
name: aicc-capacitor-fcm
description: "CT_aicc Capacitor Android and FCM push notification skill. Use for native Android app packaging, Capacitor push notification hooks, FCM token registration, automatic push Rule Engine, notification inbox, deep links, app update/download behavior, and push delivery verification."
---

# Capacitor FCM 스킬

## 핵심 기준

앱 푸시는 사용자 알림함, FCM 토큰, 자동 푸시 규칙, 관리자 발송 콘솔, 딥링크가 연결된 운영 기능이다. 토큰 생명주기와 권한 흐름을 먼저 확인한다.

## 작업 전 확인

- `capacitor.config.ts`, `android/`, `google-services.json`, 푸시 hook, 서버 push service, notification routes를 확인한다.
- 로그인 전 토큰 보관, 로그인 후 등록, 로그아웃/회원탈퇴 시 비활성화 흐름을 유지한다.
- 자동 푸시 Rule Engine과 수동 발송 경로가 중복 발송하지 않는지 확인한다.

## 구현 규칙

- FCM 토큰은 2-Phase 등록 흐름을 깨지 않는다.
- 발송은 chunk 단위와 `Promise.allSettled` 성격의 오류 격리를 유지한다.
- push delivery log와 사용자 알림함 저장이 서로 어긋나지 않게 한다.
- Android channelId, deep link actionUrl, unread badge 갱신을 함께 확인한다.
- 앱 배포/스토어 정책이나 자동 업데이트 정책 변경은 운영 정책 변경으로 보고 사용자 확인 후 반영한다.

## 검증

- 로컬에서는 가능한 API/타입 검증을 먼저 수행한다.
- 실제 디바이스/FCM 발송 검증은 비용과 환경 의존성이 있으므로 사용자가 명시한 테스트 범위 안에서 수행한다.
