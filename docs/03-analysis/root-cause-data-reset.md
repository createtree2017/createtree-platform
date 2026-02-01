# Root Cause Analysis: Data Persistence Failure

## Problem
사용자가 제작 에디터에서 저장 후 미션 페이지로 돌아오면, 모달이 열리지만 **모든 데이터가 초기화된 상태**로 나타남.

## 진단 결과

### ✅ 정상 작동하는 부분
1. **Draft 저장**: "제작하기" 버튼 클릭 시 `sessionStorage`에 데이터 저장 확인됨
2. **Redirect**: `party.tsx`의 `onSaveSuccess` (line 361)에서 올바른 URL로 리다이렉트 확인됨
3. **Modal 자동 열기**: `MissionDetailPage`의 `useEffect`가 URL 파라미터를 감지하고 모달 오픈 확인됨

### ❌ 문제의 근본 원인 발견!

**Line 1011의 `key` prop이 문제의 원인입니다:**

```typescript
<SubmissionForm
  key={selectedSubMission.id}  // ← 이것이 문제!
  subMission={selectedSubMission}
  ...
/>
```

#### 왜 문제인가?

1. **컴포넌트 완전 재생성**
   - `key` prop은 React에게 "이 값이 바뀌면 완전히 새로운 컴포넌트로 취급하라"고 지시함
   - 사용자가 에디터에서 돌아올 때:
     - `selectedSubMission`이 `null` → `SubMission 객체`로 변경
     - **하지만** `key`는 동일한 `selectedSubMission.id`
     - 문제는: 모달이 닫혔다가 다시 열릴 때 Dialog 내부의 모든 것이 UNMOUNT → REMOUNT됨

2. **Ref 초기화**
   - `SubmissionForm`이 완전히 새로 마운트되면:
   ```typescript
   const isDraftRestored = useRef(false); // ← 항상 false로 시작!
   ```
   - Draft를 복원한 후 `isDraftRestored.current = true`로 설정해도
   - 컴포넌트가 재마운트되면 다시 `false`로 리셋됨

3. **결과**
   - `useState` 초기화 함수는 Draft를 **한 번** 불러옴 → `sessionStorage.removeItem()`으로 제거
   - 하지만 `useEffect`(line 1466)가 실행될 때는 `isDraftRestored.current`가 **이미 false**
   - 따라서 서버 데이터로 덮어쓰기가 발생!

### 추가 확인 사항

**컴포넌트 Remount 타이밍 문제:**
- Dialog가 `open={!!selectedSubMission}`로 제어됨
- 사용자가 에디터에서 돌아오면:
  1. `selectedSubMission === null` (처음)
  2. `useEffect` 실행 → `setSelectedSubMission(targetSubMission)`
  3. Dialog 열림 → `SubmissionForm` **최초 마운트**
  4. Draft 복원, `isDraftRestored.current = true`
  5. **하지만** 만약 어떤 이유로든 `mission` 객체가 refetch되면...
  6. `subMission` prop이 변경 → `useEffect`(line 1466) 재실행
  7. 이 시점에 `isDraftRestored.current`는 true여야 하는데, 왜 작동하지 않을까?

#### 🔍 진짜 문제

`useEffect` 의존성 배열을 다시 확인:
```typescript
}, [subMission.submission, availableTypes.length]);
```

`subMission.submission`이 변경되면 이 effect가 실행됩니다. Query가 refetch되면 **새로운 mission 객체**가 반환되고, React는 이를 "변경"으로 간주할 수 있습니다.

## 해결 방안

### Option 1: `key` prop 제거 (권장)
**이유:** `key`는 불필요하며 오히려 역효과를 냄. Dialog open/close로 이미 마운트/언마운트가 제어되고 있음.

### Option 2: Draft 복원을 `useEffect`에서도 처리
현재는 `useState` 초기화에서만 draft를 불러옴. 대신 `useEffect`를 추가하여 URL 파라미터 변경 시 draft를 다시 확인하고 복원.

### Option 3: 보호 로직 강화
`isDraftRestored` 대신 실제 `sessionStorage`를 직접 확인하여 Draft가 있으면 항상 우선시.

## 권장 수정

**1단계: `key` prop 제거**
**2단계: Draft 복원을 지속적으로 보호**
- `useEffect` 내에서 `sessionStorage`를 직접 확인
- Draft가 존재하면 서버 데이터 동기화를 건너뜀

---
생성 시각: 2026-02-01 15:16
