---
description: 새 기능 계획서(Plan) 작성 — PDCA Plan 단계
---

# /plan [feature-name] 워크플로우

## 실행 절차

1. 사용자가 `/plan {feature-name}`을 입력하면 기능명을 확인합니다.

2. `docs/01-plan/features/{feature-name}.plan.md` 파일이 이미 존재하는지 확인합니다.
   - 존재하면: 내용을 표시하고 수정할지 물어봅니다.
   - 없으면: 아래 템플릿으로 새 문서를 생성합니다.

3. 사용자와 대화하며 아래 항목을 채웁니다.

## Plan 문서 템플릿

```markdown
# {Feature Name} 계획서

## 개요
- **기능명**: {feature-name}
- **작성일**: {YYYY-MM-DD}
- **목표**: {이 기능이 해결하는 문제}

## 배경
- 왜 이 기능이 필요한가?
- 현재 상황은?

## 범위
### 포함
- {구현할 항목 1}
- {구현할 항목 2}

### 제외
- {이번에 하지 않을 것}

## 기술 요구사항
- **Frontend**: {React 컴포넌트, 페이지, 상태 관리}
- **Backend**: {Express 라우트, API 엔드포인트}
- **Database**: {Drizzle 스키마 변경}
- **Storage**: {Firebase/GCS 변경사항}

## 영향 범위
- 영향 받는 기존 기능: {목록}
- 수정 필요한 파일 예상: {목록}

## 예상 일정
- 예상 작업량: {시간/일}
- 우선순위: {높음/중간/낮음}

## 다음 단계
→ Plan 완료 후 `/design {feature-name}`으로 설계 문서 작성
```

4. 문서를 `docs/01-plan/features/{feature-name}.plan.md`에 저장합니다.

5. 완료 메시지와 함께 다음 단계를 안내합니다:
   > "✅ Plan 문서가 생성되었습니다. 다음 단계: `/design {feature-name}`으로 설계 문서를 작성하세요."
