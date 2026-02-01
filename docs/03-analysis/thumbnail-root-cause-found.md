# 썸네일 업데이트 실패 - 근본 원인 발견!

## 문제 정의
에디터에서 프로젝트를 변경하고 저장해도, 모달로 돌아오면 **이전 썸네일**이 표시됨

## 근본 원인 (콘솔 로그로 확인)

### 타임라인

1. **사용자가 모달에서 임신 사진 업로드**
   - `slotsData`에 `imageUrl: "임신사진.jpg"` 저장

2. **"제작하기" 버튼 클릭**
   ```javascript
   sessionStorage.setItem('submission_draft_111111222222_135', JSON.stringify(slotsData));
   // ← 임신 사진이 포함된 draft 저장!
   ```

3. **에디터에서 캐릭터 스티커로 변경 후 저장**
   - 서버: 새 프로젝트 생성 (ID: 45)
   - 서버: `studioPdfUrl`, `studioPreviewUrl` 업데이트
   - 하지만 **sessionStorage의 draft는 여전히 임신 사진 포함!**

4. **모달로 복귀**
   ```javascript
   // useState 초기화 시:
   const saved = sessionStorage.getItem('submission_draft_111111222222_135');
   // ← 오래된 draft 복원! (임신 사진)
   
   // 서버 동기화 useEffect:
   if (isDraftRestored.current) {
     return; // ← draft가 있으면 서버 데이터 무시!
   }
   ```

5. **결과**: 서버는 캐릭터 스티커 데이터를 가지고 있지만, UI는 오래된 draft의 임신 사진 표시

## 핵심 문제

**Draft는 "에디터 진입 전" 상태를 저장했지만, "에디터 저장 후" 상태를 반영하지 못함**

```
시간 축:
[모달] → [Draft 저장: 임신 사진] → [에디터] → [서버 업데이트: 캐릭터 스티커] → [모달 복귀] 
                 ↓                                                                    ↓
           sessionStorage                                                    여전히 임신 사진!
```

## 해결 방법

### Option A: 에디터 저장 시 draft 업데이트 (권장)
`party.tsx`의 `onSaveSuccess`에서:
```typescript
// 저장 성공 후
const draftKey = `submission_draft_${missionId}_${subMissionId}`;
const currentDraft = sessionStorage.getItem(draftKey);
if (currentDraft) {
  const parsed = JSON.parse(currentDraft);
  parsed[studioIndex] = {
    ...parsed[studioIndex],
    studioProjectId: savedProjectId,
    studioPreviewUrl: newPreviewUrl,
    studioPdfUrl: newPdfUrl,
    studioProjectTitle: newTitle
  };
  sessionStorage.setItem(draftKey, JSON.stringify(parsed));
}
```

### Option B: autoSelectProject 파라미터 있으면 draft 무시
`mission-detail.tsx`의 useState 초기화:
```typescript
// URL에 autoSelectProject가 있으면 draft 무시하고 서버 데이터 사용
const params = new URLSearchParams(window.location.search);
if (params.get('autoSelectProject')) {
  sessionStorage.removeItem(draftKey); // draft 삭제
  // 서버 데이터로 초기화
}
```

### Option C: Draft를 사용하지 않음
제작소 제출의 경우 draft를 저장하지 않음 (단순하지만 데이터 손실 위험)

---

**권장: Option A + Option B 조합**
- 에디터에서 저장 시 draft 업데이트
- 만약 업데이트 실패해도 autoSelectProject로 서버 데이터 강제 사용

---
생성 시각: 2026-02-01 16:14
