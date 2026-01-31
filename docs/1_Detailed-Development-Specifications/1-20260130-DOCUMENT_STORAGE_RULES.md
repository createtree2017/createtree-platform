# 📋 문서 저장 규칙 (Document Storage Guidelines)

**설정일**: 2026-01-30  
**상태**: ✅ 활성화됨

---

## 📁 저장 위치

모든 개발 관련 문서(.md)는 다음 디렉토리에 저장:

```
docs/1_Detailed-Development-Specifications/
```

**절대 경로**:
```
c:\Users\TOP\Desktop\createAI\createAI_v1\docs\1_Detailed-Development-Specifications\
```

---

## 📝 파일명 규칙

### 형식
```
1-YYYYMMDD-문서명.md
```

### 구성 요소
- **접두사**: `1-` (고정)
- **날짜**: `YYYYMMDD` (예: `20260130`)
- **구분자**: `-`
- **문서명**: 대문자_언더스코어 (예: `FIREBASE_MIDDLEWARE_PLAN`)
- **확장자**: `.md`

### 예시
```
1-20260130-FIREBASE_MIDDLEWARE_PLAN.md
1-20260130-PROJECT_STATUS_FINAL_REPORT.md
1-20260130-FIREBASE_SYSTEM_COMPLETION.md
1-20260103-MULTI-IMAGE-TEXT-PROMPT-GUIDE.md
```

---

## 🎯 적용 범위

### 포함되는 문서
- ✅ 구현 계획 (Implementation Plans)
- ✅ 시스템 분석 보고서 (System Analysis Reports)
- ✅ 완료 보고서 (Completion Reports)
- ✅ 상태 보고서 (Status Reports)
- ✅ 설계 문서 (Design Documents)
- ✅ 미들웨어/API 계획서
- ✅ 버그 수정 보고서
- ✅ 성능 분석 보고서

### 제외되는 문서
- ❌ `task.md` (아티팩트 디렉토리에 유지)
- ❌ `walkthrough.md` (아티팩트 디렉토리에 유지)
- ❌ 임시 작업 메모
- ❌ README.md (프로젝트 루트)

---

## ✅ 이전 작업

다음 최근 문서들이 새 규칙에 맞춰 복사되었습니다:

1. ✅ `1-20260130-FIREBASE_MIDDLEWARE_PLAN.md` (9,351 bytes)
2. ✅ `1-20260130-FIREBASE_SYSTEM_COMPLETION.md` (7,139 bytes)
3. ✅ `1-20260130-PROJECT_STATUS_FINAL_REPORT.md` (10,102 bytes)

### 기존 문서 (유지)
- `1_MULTI-IMAGE-TEXT-PROMPT-GUIDE_20260103.md`
- `1_REFACTORING_MASTER_PLAN_20251021.md`

---

## 🚀 향후 적용

### 새 문서 생성 시
```typescript
// 자동 적용 예시
const today = '20260130';
const docName = 'NEW_FEATURE_PLAN';
const fileName = `1-${today}-${docName}.md`;
const fullPath = `docs/1_Detailed-Development-Specifications/${fileName}`;
```

### AI 어시스턴트 지침
**모든 개발 문서 생성 시:**
1. 날짜 확인 (YYYYMMDD 형식)
2. 의미있는 문서명 생성 (대문자_언더스코어)
3. `1-날짜-문서명.md` 형식으로 파일명 구성
4. `docs/1_Detailed-Development-Specifications/` 경로에 저장

---

## 📊 현재 디렉토리 구조

```
docs/
└── 1_Detailed-Development-Specifications/
    ├── 1-20260130-FIREBASE_MIDDLEWARE_PLAN.md
    ├── 1-20260130-FIREBASE_SYSTEM_COMPLETION.md
    ├── 1-20260130-PROJECT_STATUS_FINAL_REPORT.md
    ├── 1_MULTI-IMAGE-TEXT-PROMPT-GUIDE_20260103.md
    └── 1_REFACTORING_MASTER_PLAN_20251021.md
```

---

## ✅ 규칙 확인

### 체크리스트
- [x] 디렉토리 존재: `docs/1_Detailed-Development-Specifications/`
- [x] 명명 규칙 정의: `1-YYYYMMDD-문서명.md`
- [x] 기존 문서 이전 완료
- [x] AI 어시스턴트 지침 설정
- [x] 규칙 문서 작성 (이 문서)

---

**작성자**: AI Assistant  
**최종 업데이트**: 2026-01-30 11:40
