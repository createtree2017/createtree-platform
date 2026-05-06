---
description: 프로젝트 PDCA 현황 대시보드 — 진행 중인 기능과 PDCA 단계 현황 표시
---

# /status 워크플로우

## 실행 절차

1. 사용자가 `/status`를 입력하면 프로젝트의 PDCA 현황을 조사합니다.

2. 아래 디렉토리를 스캔합니다:
   - `docs/01-plan/features/` — Plan 문서 목록
   - `docs/02-design/features/` — Design 문서 목록
   - `docs/03-analysis/` — Analysis 문서 목록
   - `docs/04-report/features/` — Report 문서 목록

3. 각 기능의 PDCA 진행 단계를 판단합니다:
   - Plan만 있음 → Plan 단계
   - Plan + Design 있음 → Design 완료, 구현 대기
   - Plan + Design + Analysis 있음 → Check 완료
   - Plan + Design + Analysis + Report 있음 → 완료
   - Plan 문서에 `작업 관리표`가 있으면 항목별 상태(`미완료`, `진행중`, `검증중`, `완료`, `보류`)도 함께 집계합니다.

4. 아래 형식으로 현황을 표시합니다.

## 출력 형식

```
📊 createTree PDCA 현황 대시보드
═══════════════════════════════════════

🔄 진행 중인 기능
──────────────────────────────────────
  {feature-1}
  [Plan] ✅ → [Design] ✅ → [Do] 🔄 → [Check] ⏳ → [Report] ⏳
  작업 상태: 완료 {N} / 진행중 {N} / 검증중 {N} / 미완료 {N} / 보류 {N}

  {feature-2}
  [Plan] ✅ → [Design] ⏳ → [Do] ⏳ → [Check] ⏳ → [Report] ⏳
  작업 상태: 완료 {N} / 진행중 {N} / 검증중 {N} / 미완료 {N} / 보류 {N}

✅ 완료된 기능
──────────────────────────────────────
  {feature-3} (완료: 2026-02-15)
  [Plan] ✅ → [Design] ✅ → [Do] ✅ → [Check] ✅ → [Report] ✅

📈 통계
──────────────────────────────────────
  진행 중: {N}개
  완료: {N}개
  총 기능: {N}개
  미완료 작업 항목: {N}개
  검증 대기 항목: {N}개

💡 추천
──────────────────────────────────────
  → {feature-1}은 구현이 완료되면 `/check {feature-1}`으로 갭 분석을 실행하세요.
  → {feature-2}는 `/design {feature-2}`로 설계 문서를 작성하세요.
```

5. 기능이 없으면:
   > "📭 아직 PDCA 문서가 없습니다. `/plan {feature-name}`으로 첫 번째 기능 계획을 시작하세요!"
