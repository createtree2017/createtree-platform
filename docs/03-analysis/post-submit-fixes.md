# Post-Submit Behavior Fixes

## 문제 1: 제출 후 모달 자동 재오픈

### 원인
- `navigate()` 호출 시 URL에 `openSubMission=135` 쿼리 파라미터가 추가됨
- 제출 후 모달 닫혔으나, 해당 파라미터가 남아있어 자동으로 다시 열림

### 해결
`closeSubMissionModal`에서 URL 쿼리 파라미터 정리:
```typescript
// URL 쿼리 파라미터 정리 (자동 재오픈 방지)
const url = new URL(window.location.href);
url.searchParams.delete('openSubMission');
url.searchParams.delete('autoSelectProject');
window.history.replaceState({}, '', url.toString());
```

---

## 문제 2: 썸네일이 즉시 갱신되지 않음

### 원인
1. 제출 시 모달이 **동기적으로(즉시)** 닫혔음
2. 캐시 무효화가 완료되기 전에 모달이 닫혀, 오래된 데이터가 표시됨
3. 브라우저 이미지 캐시 (같은 URL이면 새 이미지를 가져오지 않음)

### 해결책 1: 비동기 캐시 무효화 후 모달 닫기
**Before:**
```typescript
onSubmit={(data) => {
  submitMutation.mutate({ ... });
  closeSubMissionModal(); // ← 즉시 닫음 (잘못됨)
}}
```

**After:**
```typescript
onSubmit={(data) => {
  submitMutation.mutate({ ... });
  // closeSubMissionModal() 제거!
  // onSuccess에서 처리
}}

// submitMutation.onSuccess에서:
onSuccess: async () => {
  await queryClient.invalidateQueries(...); // 캐시 무효화 완료 대기
  toast({ ... });
  closeSubMissionWithHistory(); // ← 캐시 갱신 후 닫기
}
```

### 해결책 2: 캐시 버스팅 유틸리티 추가
`lib/utils.ts`에 `addCacheBuster()` 함수 추가:
```typescript
export function addCacheBuster(url: string | undefined | null): string {
  if (!url) return '';
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${Date.now()}`;
}
```

필요 시 이미지 URL에 적용하여 강제 갱신 가능.

---

## 결과
✅ 제출 후 모달이 자동으로 다시 열리지 않음  
✅ 썸네일이 즉시 갱신됨 (캐시 무효화 후 모달 닫기)

---

생성 시각: 2026-02-01 15:56
