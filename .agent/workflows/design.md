---
description: 설계 문서(Design) 작성 — PDCA Design 단계
---

# /design [feature-name] 워크플로우

## 실행 절차

1. 사용자가 `/design {feature-name}`을 입력하면 기능명을 확인합니다.

2. `docs/01-plan/features/{feature-name}.plan.md`가 존재하는지 확인합니다.
   - 없으면: "Plan 문서가 먼저 필요합니다. `/plan {feature-name}`을 실행해주세요." 안내
   - 있으면: Plan 문서 내용을 참조하여 설계 문서를 작성합니다.

3. `docs/02-design/features/{feature-name}.design.md` 파일이 이미 존재하는지 확인합니다.
   - 존재하면: 내용을 표시하고 수정할지 물어봅니다.
   - 없으면: 아래 템플릿으로 새 문서를 생성합니다.

## Design 문서 템플릿

```markdown
# {Feature Name} 설계서

## 개요
- **기능명**: {feature-name}
- **작성일**: {YYYY-MM-DD}
- **Plan 참조**: docs/01-plan/features/{feature-name}.plan.md

## API 설계

### 엔드포인트
| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | /api/... | ... | 필요 |
| POST | /api/... | ... | 필요 |

### 요청/응답 스키마
```json
// Request
{}

// Response  
{}
```

## DB 스키마 변경

### 새 테이블 / 컬럼 변경
```sql
-- Drizzle ORM 스키마
```

## 컴포넌트 구조

### 새로 생성할 컴포넌트
- `client/src/components/{ComponentName}.tsx` — {역할}

### 수정할 기존 컴포넌트
- `client/src/pages/{PageName}.tsx` — {변경 내용}

## 상태 관리
- 사용할 훅: {useQuery, useMutation 등}
- 캐시 키: {React Query 키}

## 에러 처리
| 상황 | HTTP 코드 | 사용자 메시지 |
|------|----------|-------------|
| ... | 400 | ... |
| ... | 404 | ... |

## 구현 순서
1. {DB 스키마 변경}
2. {Backend API 구현}
3. {Frontend 컴포넌트 구현}
4. {통합 테스트}
```

4. 문서를 `docs/02-design/features/{feature-name}.design.md`에 저장합니다.

5. 완료 메시지:
   > "✅ Design 문서가 생성되었습니다. 구현을 진행하시고, 완료 후 `/check {feature-name}`으로 갭 분석을 실행하세요."
