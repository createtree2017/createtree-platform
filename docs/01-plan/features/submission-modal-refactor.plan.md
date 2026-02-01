# Plan: Submission Modal Refactor

## 1. 개요 (Overview)
- **Feature**: `submission-modal-refactor`
- **Goal**: `SubMissionBuilder` 컴포넌트의 로컬 Dialog를 제거하고, 중앙집중식 모달 시스템(`SubMissionFormModal`)으로 전환하여 "세부 미션 수정 시 신규 생성되는 버그"를 해결한다.
- **Scope**: 
  - `client/src/components/admin/MissionManagement.tsx` (수정)
  - `client/src/components/admin/modal/SubMissionFormModal.tsx` (신규 생성)
  - `client/src/components/modal/modalRegistrations.ts` (수정)

## 2. 현상 및 원인 분석 (Analysis)
### 현상
세부 미션 편집 모달에서 "저장" 클릭 후 모달이 닫히지 않고, 다시 "저장" 클릭 시 수정이 아닌 "신규 생성" 요청이 발생함.

### 원인
- `SubMissionBuilder`가 로컬 `useState`로 Dialog를 제어하지만, 저장 성공 시 `modal.close()` (중앙집중식)를 호출함.
- 이로 인해 UI상 모달은 닫히지 않았으나 `editingSubMission` 상태는 `null`로 초기화됨.
- 사용자가 재저장 시 `id`가 없어 `POST` 요청(신규 생성)이 전송됨.

## 3. 구현 계획 (Implementation Plan)

### A. 신규 컴포넌트 생성: `SubMissionFormModal`
- `MissionManagement.tsx` 내의 `<Dialog>...</Dialog>` 및 관련 폼 로직을 추출.
- **Props**:
  - `isOpen`: boolean
  - `onClose`: () => void
  - `missionId`: string (부모 미션 ID)
  - `editingSubMission`: any (수정 시 데이터, 없으면 생성)
  - `onSuccess`: () => void (저장 완료 후 콜백)
- **Features**:
  - `useForm` 및 Validation 로직 이관.
  - `saveSubMissionMutation` 이관.

### B. 모달 레지스트리 등록
- `client/src/components/modal/modalRegistrations.ts` 수정.
- Key: `'subMissionForm'`
- Component: `SubMissionFormModal` (Lazy loading 권장)

### C. `SubMissionBuilder` 리팩토링
- 로컬 `isDialogOpen` 상태 제거.
- `editingSubMission` 로컬 상태 제거.
- `saveSubMissionMutation` 제거.
- "세부 미션 추가" / "수정" 버튼 클릭 핸들러 변경:
  ```typescript
  modal.open('subMissionForm', {
    missionId,
    editingSubMission: subMission, // or null
    onSuccess: () => { ... }
  })
  ```

## 4. 검증 계획 (Verification Plan)
### 자동화 테스트 (Automated Tests)
- 현재 프로젝트에 프론트엔드 테스트 환경(Jest/Vitest)이 구성되어 있지 않으므로 **수동 검증**을 수행한다.

### 수동 검증 (Manual Verification)
1.  **세부 미션 생성**: 관리자 페이지 > 미션 관리 > 세부 미션 추가 버튼 클릭. 모달이 정상적으로 열리는지 확인.
2.  **세부 미션 저장**: 내용 입력 후 저장. 모달이 자동으로 닫히는지 확인.
3.  **세부 미션 수정**: 생성된 미션의 수정 버튼 클릭. 기존 내용이 채워져 있는지 확인.
4.  **버그 재현 테스트**: 내용 수정 후 저장.
    - **Pass**: 모달이 닫히고 목록이 갱신됨. 재저장 시도 불가능(모달이 닫혀서).
    - **Fail**: 모달이 닫히지 않거나, 데이터를 조회했을 때 새 미션이 생겨있음.
