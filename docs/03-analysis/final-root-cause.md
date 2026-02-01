# 최종 근본 원인 분석

## 발견된 사실

### ✅ 복원은 성공합니다
로그 증거:
```
[RESTORE] draftKey: submission_draft_111111222222_135
[RESTORE] sessionStorage에서 가져온 데이터: 있음 (길이: 729)
[RESTORE] 드래프트 복원 성공! sessionStorage 정리 완료
```

### ❌ 하지만 컴포넌트가 여러 번 마운트됩니다

**타이밍 순서:**

1. **첫 번째 마운트**
   - `useState` 초기화 → draft 발견
   - draft 복원 성공
   - **`sessionStorage.removeItem(draftKey)`** 실행 ← 문제의 원인!
   - `isDraftRestored.current = true` 설정
   - 화면에 복원된 데이터 표시

2. **Dialog가 리렌더링되거나 React Query가 refetch**
   - `SubmissionForm` 컴포넌트 **언마운트**
   
3. **두 번째 마운트**
   - `useState` 초기화 **다시 실행**
   - `isDraftRestored = useRef(false)` ← **새로운 ref, false로 초기화!**
   - `sessionStorage.getItem(draftKey)` → **이미 삭제되어 null 반환**
   - draft 없음 → 기존 제출 데이터 또는 빈 상태로 초기화
   - **데이터 초기화!**

## 핵심 문제

**sessionStorage를 너무 빨리 삭제합니다!**

현재 로직:
```typescript
sessionStorage.removeItem(draftKey); // ← 복원 직후 바로 삭제
```

이것은 **일회용**으로 설계되었지만, **컴포넌트가 여러 번 마운트**되는 상황을 고려하지 못했습니다.

## 해결 방법

### Option 1: Dialog가 닫힐 때만 삭제 (권장)
- 복원 시 sessionStorage를 **유지**
- Dialog `onOpenChange={false}` 시점에 정리

### Option 2: 타이머로 지연 삭제
- 복원 후 5초 뒤에 삭제 (단, 여러 마운트가 5초 안에 발생하면 여전히 문제)

### Option 3: localStorage 사용
- sessionStorage 대신 localStorage 사용
- 명시적으로 "완료" 표시를 하기 전까지 유지

---
생성 시각: 2026-02-01 15:43
