---
description: 완료 보고서(Report) 생성 — PDCA Act 단계. Plan/Design/Check 결과를 통합하여 완료 보고서 작성
---

# /report [feature-name] 워크플로우

## 실행 절차

1. 사용자가 `/report {feature-name}`을 입력하면 기능명을 확인합니다.

2. PDCA 문서 존재 확인:
   - `docs/01-plan/features/{feature-name}.plan.md` (선택)
   - `docs/02-design/features/{feature-name}.design.md` (선택)
   - `docs/03-analysis/{feature-name}.analysis.md` (선택)
   - 문서가 없어도 보고서 생성은 가능하되, 있는 문서를 참조합니다.

3. 실제 코드 변경 사항을 분석합니다 (git diff 또는 파일 스캔).

4. 아래 템플릿으로 보고서를 생성합니다.

## Report 문서 템플릿

```markdown
# {Feature Name} 완료 보고서

## 개요
- **기능명**: {feature-name}
- **작성일**: {YYYY-MM-DD}
- **작업 기간**: {시작일} ~ {완료일}

## PDCA 사이클 요약

### Plan
- 계획 문서: {경로 또는 "미작성"}
- 목표: {간략 요약}

### Design
- 설계 문서: {경로 또는 "미작성"}
- 주요 설계 결정: {요약}

### Do (구현)
- 구현 범위:
  - {변경된 파일/기능 1}
  - {변경된 파일/기능 2}
- 실제 작업량: {시간/일}

### Check (갭 분석)
- 분석 문서: {경로 또는 "미실행"}
- 매치율: {N}%

## 완료 항목
- ✅ {항목 1}
- ✅ {항목 2}

## 미완료/보류 항목
- ⏸️ {항목}: {사유}

## 교훈 (Lessons Learned)

### 잘된 점
- {내용}

### 개선할 점
- {내용}

### 다음에 적용할 것
- {내용}

## 다음 단계
- {후속 작업 1}
- {후속 작업 2}
```

5. 문서를 `docs/04-report/features/{feature-name}.report.md`에 저장합니다.

6. 동시에 `docs/1_Detailed-Development-Specifications/` 규칙에 맞게 상세 스펙 문서도 업데이트를 제안합니다:
   - 파일명 규칙: `1-{YYYYMMDD}-{기능요약_영문}.md`

7. 완료 메시지:
   > "✅ 완료 보고서가 생성되었습니다. `/status`로 전체 프로젝트 현황을 확인할 수 있습니다."
