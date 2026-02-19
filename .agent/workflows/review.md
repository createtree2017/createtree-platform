---
description: 코드 리뷰 및 품질 분석 — 지정된 파일/디렉토리의 코드 품질, 보안, 성능 분석
---

# /review [file-or-directory] 워크플로우

## 실행 절차

1. 사용자가 `/review {대상}`을 입력하면 리뷰 대상을 확인합니다.
   - 파일 지정: `/review server/routes/auth.ts`
   - 디렉토리 지정: `/review client/src/components/`
   - 최근 변경: `/review recent` (최근 변경된 파일들)

2. 대상 파일을 읽고 아래 카테고리별로 분석합니다.

## 리뷰 카테고리

### 1. 코드 품질
- 중복 코드 탐지 (DRY 위반)
- 함수 복잡도 (20줄 초과, if-else 3단계+ 중첩)
- 네이밍 규칙 준수 (camelCase, PascalCase)
- TypeScript 타입 안정성 (`any` 사용, 타입 누락)

### 2. 버그 탐지
- null/undefined 미처리
- 비동기 에러 핸들링 누락 (try-catch, .catch())
- 경계 조건 미검증 (빈 배열, 빈 문자열)
- React 훅 규칙 위반 (조건부 훅 호출, 의존성 배열)

### 3. 보안
- XSS 취약점 (dangerouslySetInnerHTML, 미이스케이프 출력)
- SQL Injection 패턴 (raw 쿼리에 사용자 입력)
- 민감 정보 노출 (API 키, 비밀번호 하드코딩)
- 인증/인가 로직 검증

### 4. 성능
- N+1 쿼리 패턴
- 불필요한 리렌더링 (React.memo, useMemo, useCallback 부재)
- 메모리 누수 (이벤트 리스너 미해제, 구독 미해제)
- 큰 번들 사이즈 (불필요한 import)

## 리뷰 결과 템플릿

```markdown
## 코드 리뷰 결과

### 요약
- 분석 파일: {N}개
- 발견된 이슈: {N}개 (Critical: {N}, Major: {N}, Minor: {N})
- 점수: {N}/100

### 🔴 Critical 이슈
1. **[{파일}:{라인}]** {이슈 설명}
   → 수정 제안: {구체적 수정 방법}

### 🟡 Major 이슈
1. **[{파일}:{라인}]** {이슈 설명}
   → 수정 제안: {구체적 수정 방법}

### 🔵 Minor 이슈
1. **[{파일}:{라인}]** {이슈 설명}
   → 수정 제안: {구체적 수정 방법}

### 💡 개선 권장사항
- {권장 사항}
```

3. 결과를 화면에 표시합니다.

4. 사용자가 원하면 `docs/03-analysis/code-review-{YYYY-MM-DD}.md`로 저장합니다.

5. Critical 이슈가 있으면 수정 여부를 물어봅니다.
