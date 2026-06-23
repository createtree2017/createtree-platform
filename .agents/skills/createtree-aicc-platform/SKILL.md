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
- 큰미션 진행미션은 특정 문화센터 프로그램 ID가 아니라 `bigMissionTopics.categoryId` 기준 슬롯이다. 같은 `categoryId`의 `themeMission` 중 하나라도 `isActive=true`인 세부미션이 1개 이상 있고, 그 활성 세부미션 전체가 사용자 기준 `subMissionSubmissions.status=approved`이면 해당 진행미션을 완료로 본다. `신청` 세부미션 1개 approved만으로 큰미션 진행미션을 완료 처리하지 않는다.
- 큰미션 완료 계산은 `server/services/mission/big-mission-progress.service.ts`를 공통 기준으로 사용한다. 사용자 큰미션 목록/상세/보상신청, 관리자 세부미션 검수 후 `userBigMissionProgress` 재계산은 이 서비스를 우선 재사용한다.
- 문화센터 프로그램 진행률은 분모와 분자 모두 활성 세부미션 기준이다. 분모는 `subMissions.isActive=true`, 분자는 그 활성 세부미션에 대한 사용자 `approved` 제출만 센다. 비활성 세부미션의 과거 approved 제출을 진행률에 포함하지 않는다.
- 세부미션 `isActive` 변경은 큰미션 완료 조건의 분모를 바꾸므로, 변경된 문화센터 프로그램과 관련된 사용자만 대상으로 `bigMissionProgressService.recalculateUsersForThemeMission`을 호출해 저장 progress를 동기화한다.
- 문화센터 `신청` 타입 세부미션의 자동승인은 주제미션 `isFirstCome=true`일 때만 허용한다. `isFirstCome=false`이면 모집인원이 `0`, `null`, `N` 중 무엇이든 관리자 승인 대기(`submitted`)로 등록하고, 신청 타입의 `requireReview=false`를 자동승인 근거로 쓰지 않는다. `isFirstCome=true`에서 모집인원 `0`/비어 있음은 무제한 자동승인, 모집인원 `N`은 `N`명 자동승인 후 대기자(`waitlist`) 정책이다.
- 선착순 문화센터 프로그램에서 승인자가 참여취소해 대기자가 자동승격되면, 승격된 제출의 `reviewNotes`에 `대기자 자동승격` 흔적을 남겨 관리자 검수/신청 관리 화면에서 badge로 식별되게 한다.
- 관리자 검수에서 승인 취소는 사용자 신청 취소가 아니므로 `cancelled`가 아니라 `approved -> submitted`로 되돌린다. 승인 취소 시 `isLocked=false`, `reviewedBy=null`, `reviewedAt=null`로 초기화하고 큰미션 진행률을 재계산한다. 선착순 신청 미션에서 승인 취소로 승인자가 빠지면 가장 빠른 대기자를 자동승격하고 기존 `대기자 자동승격` badge 흐름을 재사용한다.
- 큰미션 보상 신청 운영취소는 `rewardStatus=cancelled`와 `rewardCancelledAt`, `rewardCancelledBy`, `rewardCancelReason`으로 이력을 보존한다. 관리자는 `pending`만 운영취소할 수 있고, `approved` 지급완료 건은 자동취소하지 않고 수동 검토 대상으로 분리한다. 취소 이력이 있어도 사용자가 새 완료 기준으로 100% 달성하면 재신청을 허용한다.

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
