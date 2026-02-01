# Thumbnail Update Failure - Root Cause Analysis

## 문제 정의

**현상**: 제작소 제출 후 에디터에서 프로젝트를 변경하고 저장해도 썸네일이 업데이트되지 않음

**재현 경로**:
1. 세부미션 제출 모달 열기
2. 제작소 제출 → 에디터로 이동
3. 에디터에서 프로젝트 변경 (예: 임신 이미지 → 캐릭터 스티커)
4. 저장 후 모달로 복귀
5. **결과**: 썸네일이 여전히 이전 이미지(임신 이미지) 표시

## 가설

### 가설 1: 서버가 동일한 URL을 반환
- 서버가 PDF를 재생성하지만 **같은 파일명/경로** 사용
- 브라우저는 URL이 동일하면 캐시된 이미지 사용
- **검증 방법**: 네트워크 탭에서 API 응답 확인

### 가설 2: React Query가 refetch하지 않음
- `invalidateQueries`가 실제로 실행되지 않음
- 또는 실행되었으나 stale time 설정 때문에 무시됨
- **검증 방법**: React Query DevTools로 쿼리 상태 확인

### 가설 3: 서버가 아직 PDF를 생성 중
- 비동기 PDF 생성이 완료되기 전에 API가 이전 URL 반환
- **검증 방법**: 서버 로그 + 타이밍 확인

### 가설 4: 이미지 URL에 캐시 버스터 필요
- 서버가 같은 URL을 반환하는 것이 정상 동작
- 클라이언트에서 타임스탬프를 추가해야 함
- **검증 방법**: URL에 `?t=timestamp` 추가 후 테스트

## 진단 계획

### Step 1: 네트워크 요청 확인
콘솔에서 현재 데이터 확인:
```javascript
// 제출 전 데이터
console.log('[BEFORE]', submission.submissionData);

// 제출 후 refetch된 데이터
console.log('[AFTER]', newSubmission.submissionData);
```

### Step 2: URL 비교
- `studioPdfUrl` 변경 여부
- `studioPreviewUrl` 변경 여부
- 타임스탬프나 버전 정보 포함 여부

### Step 3: 서버 API 확인
- `/api/projects/:id/save` 응답 확인
- PDF 생성이 동기/비동기인지 확인

### Step 4: 다른 위치에서도 확인
- 관리자 UI에서도 같은 문제인지
- 갤러리 뷰에서도 같은 문제인지

## 예상 솔루션

### Solution A: 서버에서 버전 쿼리 파라미터 추가
```
/uploads/pdf/project_123.pdf?v=1738397171000
```

### Solution B: 클라이언트에서 캐시 버스터 추가
```typescript
<img src={addCacheBuster(studioPreviewUrl)} />
```

### Solution C: 강제 리로드
```typescript
await queryClient.refetchQueries({ 
  queryKey: ['/api/missions', missionId],
  type: 'active' 
});
```

---
생성 시각: 2026-02-01 16:06
