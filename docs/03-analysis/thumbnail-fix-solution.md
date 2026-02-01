# 썸네일 업데이트 실패 - 해결 완료

## 근본 원인
에디터에서 프로젝트를 변경하고 저장해도 **오래된 draft**가 복원되어 새 서버 데이터를 덮어씀

## 타임라인 (문제 상황)
1. 사용자가 임신 사진 업로드
2. "제작하기" 클릭 → **draft 저장 (임신 사진 포함)**
3. 에디터에서 캐릭터 스티커로 변경 → 저장
4. 모달 복귀 → **오래된 draft 복원 (임신 사진)**
5. 서버는 캐릭터 스티커 가지고 있지만, UI는 임신 사진 표시 ❌

## 해결 방법 (Two-Layer Fix)

### Layer 1: Party.tsx - Draft 업데이트
**파일**: `client/src/pages/party.tsx`

에디터에서 저장 성공 시 draft 업데이트:
```typescript
// 미션 수행 중인 경우: draft 업데이트 (서버 데이터와 동기화)
if (missionContextRef.current?.subMissionId && missionContextRef.current?.themeMissionId) {
  const draftKey = `submission_draft_${missionContextRef.current.themeMissionId}_${missionContextRef.current.subMissionId}`;
  const existingDraft = sessionStorage.getItem(draftKey);
  
  if (existingDraft) {
    const draftData = JSON.parse(existingDraft);
    const updatedDraft = draftData.map((slot: any) => {
      if (slot.type === 'studio_submit') {
        return {
          ...slot,
          studioProjectId: savedProjectId,
          studioProjectTitle: projectTitleRef.current || '작업물',
        };
      }
      return slot;
    });
    sessionStorage.setItem(draftKey, JSON.stringify(updatedDraft));
    console.log('[Party] Draft 업데이트 완료');
  }
}
```

### Layer 2: Mission-Detail.tsx - autoSelectProject 시 Draft 무시
**파일**: `client/src/pages/mission-detail.tsx`

`autoSelectProject` URL 파라미터가 있으면 draft 완전히 무시:
```typescript
const [slotsData, setSlotsData] = useState<SlotData[]>(() => {
  const params = new URLSearchParams(window.location.search);
  const autoSelectId = params.get('autoSelectProject');

  const draftKey = `submission_draft_${missionId}_${subMission.id}`;
  const saved = sessionStorage.getItem(draftKey);

  // autoSelectProject가 있으면 draft 무시하고 삭제
  if (autoSelectId) {
    console.log('[RESTORE] autoSelectProject 감지:', autoSelectId);
    console.log('[RESTORE] Draft 무시하고 서버 데이터 사용');
    sessionStorage.removeItem(draftKey); // ← 핵심: draft 삭제!
    // 서버 데이터로 초기화 (아래로 fall through)
  } else if (saved) {
    // draft 복원
  }
  
  // 서버 데이터로 초기화...
});
```

## 결과

### Before (❌)
```
[제작하기] → [Draft 저장: 임신] → [에디터: 스티커 저장] → [복귀: 임신 표시 ❌]
```

### After (✅)
```
[제작하기] → [Draft 저장: 임신] → [에디터: 스티커 저장 + Draft 업데이트] → [복귀: 스티커 표시 ✅]
```

**또는** (Layer 2가 작동)
```
[제작하기] → [Draft 저장: 임신] → [에디터: 스티커 저장] → [복귀: autoSelect → Draft 삭제 → 서버 데이터 사용 → 스티커 표시 ✅]
```

## 검증 방법

1. 세부미션 모달 열기
2. "제작하기" 클릭 (draft 저장됨)
3. 에디터에서 다른 이미지로 변경 → 저장
4. 모달로 복귀
5. **콘솔 로그 확인**:
   - `[Party] Draft 업데이트 완료` ← Layer 1 작동
   - `[RESTORE] autoSelectProject 감지` ← Layer 2 작동
6. **썸네일이 새 이미지로 표시되는지 확인** ✅

---
생성 시각: 2026-02-01 16:14  
해결 완료: 2026-02-01 16:19
