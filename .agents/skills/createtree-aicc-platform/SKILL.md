---
name: createtree-aicc-platform
description: "AI문화센터 CT_aicc 프로젝트 전용 운영 스킬. Use for work on the createTree AI Culture Center platform, including React/Vite frontend, Express backend, admin pages, mission/reward flows, PDCA docs, Railway deployment context, user-facing mobile app behavior, and project handoff rules."
---

# AI문화센터 플랫폼 작업 스킬

## 핵심 기준

이 프로젝트는 산후조리원, 산부인과, 병원 고객을 위한 AI 기반 문화센터 플랫폼이다. 앱, 관리자, 미션, 리워드, 이미지 생성, 푸시 알림이 서로 연결되어 있으므로 변경 전 항상 영향 범위를 확인한다.

## 작업 전 확인

- `AGENTS.md`, `GEMINI.md`, 최신 `docs/05-devlog/` 문서를 먼저 확인한다.
- 기능 추가나 큰 변경은 `docs/01-plan/features/`와 `docs/02-design/features/`의 관련 문서를 확인한다.
- 실제 동작 기준은 코드베이스이며, 문서와 코드가 다르면 코드 기준으로 판단하고 문서 보강 필요성을 남긴다.

## 개발 규칙

- React, TypeScript, Vite, Express, Drizzle, Railway PostgreSQL, Firebase/GCS, Capacitor 구조를 유지한다.
- 사용자 주요 플로우는 미션 신청, 세부미션 제출, 이미지 생성, 리워드 신청, 알림함, 관리자 검수 흐름까지 함께 본다.
- 관리자 기능 변경 시 superadmin, 병원 관리자, 일반 사용자 권한 차이를 확인한다.
- 큰 파일은 한 번에 전면 수정하지 말고 도메인 단위로 분리한다.
- `!!푸시!!` 없이 `git add`, `git commit`, `git push`를 실행하지 않는다.
- 사용자-facing UI와 기능 설정은 모바일 화면을 1차 기준으로 설계한다. 수량 조절, 신청, 제출 같은 핵심 행동은 터치하기 쉽고 최소 조작으로 완료되게 만든다.
- 큰미션 보상 선택 신청은 `bigMissions.giftItems`를 사용자 선택지로 사용하고, 신청 시 `userBigMissionProgress.selectedRewardItem`에 스냅샷을 저장한다. 상품명은 코드에 하드코딩하지 않고 관리자가 등록한 `이미지 + 보상 이름`만 사용한다.
- 큰미션 보상 수량 선택은 `bigMissions.rewardSelectionLimit`를 총 선택 가능 수량으로 사용한다. 서버는 클라이언트가 보낸 상품명/이미지를 믿지 않고 `giftItems`의 index와 수량 합계를 검증한 뒤 `selectedRewardItem`에 배열형 스냅샷을 저장한다. 기존 단일 선택 스냅샷은 수량 1개로 호환 표시한다.
- 큰미션 보상 신청 배송 정보는 `userBigMissionProgress.rewardShippingAddress`와 `rewardMemo`에 저장한다. 배송 주소는 신청 시 필수로 검증하고, 메모는 선택값으로 처리하며, 관리자 보상 신청 관리에서 기존 신청 건 fallback까지 함께 표시한다.
- 큰미션 보상 신청은 `rewardStatus=pending` 상태에서 사용자 수정이 가능하다. 수정 시에도 서버가 `giftItems` index, 수량 합계, 배송 주소 필수값을 다시 검증하고 `selectedRewardItem`, `rewardShippingAddress`, `rewardMemo`, `updatedAt`만 갱신한다. `rewardStatus=approved` 지급완료 이후 수정은 프론트와 서버 모두에서 반드시 차단한다.

## Skill Impact Check

기능 개발, 기존 기능 변경, 업데이트 완료 시 다음을 자동 확인한다.

- 반복 작업 규칙이나 새 도메인 흐름이 생겼는가?
- API, DB, 컴포넌트, 검증 명령, 문서 위치가 바뀌었는가?
- 기존 스킬 설명이 현재 코드와 달라졌는가?
- 새 기능이 향후 반복 개발될 가능성이 큰가?

해당하면 관련 스킬과 `.agents/skills/SKILLS_INDEX.md`를 업데이트한다. 배포/DB/보안/개인정보/의료광고/AI provider/금전/자동화 권한 정책 변경은 사용자 확인 후 반영한다.

## 검증

- 스킬 변경 후 `npm run skills:sync`와 `npm run skills:check`를 실행한다.
- 코드 변경 후 가능한 범위에서 `npm run verify`, `npm run check`, 또는 관련 타입/빌드 검증을 수행한다.
