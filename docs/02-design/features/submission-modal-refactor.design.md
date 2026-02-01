# Design: Submission Modal Refactor

## 1. 컴포넌트 설계: `SubMissionFormModal`

### 위치
`client/src/components/admin/modal/SubMissionFormModal.tsx`

### Props 인터페이스
```typescript
interface SubMissionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  missionId: string; // 부모 미션 ID (UUID)
  editingSubMission?: any | null; // 수정 모드일 때 데이터, 없으면 생성 모드
  onSuccess?: () => void; // 저장 성공 시 콜백 (리스트 갱신 등)
}
```

### 내부 로직 (Migration)
`MissionManagement.tsx`의 `SubMissionBuilder`에서 다음 로직을 가져옵니다.

1.  **Form State**: `useForm` (zodResolver schema 포함)
    -   `defaultValues` 설정 로직 (수정 모드 vs 생성 모드 분기)
2.  **Mutations**: 
    -   `saveSubMissionMutation`
    -   `loadPartyTemplates` (템플릿 불러오기)
3.  **UI Components**:
    -   `<Dialog>` -> `<Dialog>` (ModalRoot에서 렌더링되지만 내부 구조 유지)
    -   `RichTextEditor`, `Input`, `Select`, `Switch` 등 폼 필드

### 주요 변경 사항
- **중앙집중식 모달 사용 부**: `SubMissionFormModal` 내부에서 또 다른 모달(예: 템플릿 선택, 확인 창)을 열 때 `useModal()` 훅을 사용합니다.
- **닫기 처리**: 저장 성공 시 `onSuccess` 호출 후 `onClose` (props) 호출.

## 2. 모달 레지스트리 수정

### 위치
`client/src/components/modal/modalRegistrations.ts`

### 등록
```typescript
import { registerLazyModal } from './ModalRegistry';

export function initializeModalRegistry() {
  // ... 기존 등록 ...
  registerLazyModal('subMissionForm', () => import('../admin/modal/SubMissionFormModal'));
}
```

## 3. 기존 컴포넌트 수정: `SubMissionBuilder`

### 위치
`client/src/components/admin/MissionManagement.tsx`

### 제거할 코드
- `isDialogOpen` state
- `editingSubMission` state
- `saveSubMissionMutation`
- `form` 관련 코드 (schema, useForm)
- `<Dialog>` JSX 부분

### 수정할 코드
- **추가 버튼**:
  ```typescript
  <Button onClick={() => modal.open('subMissionForm', { 
    missionId, 
    onSuccess: () => queryClient.invalidateQueries(...) 
  })}>...</Button>
  ```
- **수정 버튼**:
  ```typescript
  <Button onClick={() => modal.open('subMissionForm', { 
    missionId, 
    editingSubMission: subMission,
    onSuccess: () => queryClient.invalidateQueries(...) 
  })}>...</Button>
  ```

## 4. 데이터 흐름도 (Data Flow)

**Before (Buggy):**
[SubMissionBuilder] -> (Local State) -> [Dialog] -> [Save Mutation] -> [Success] -> modal.close()(Fail to close local) -> [List Refresh]

**After (Fixed):**
[SubMissionBuilder] -> modal.open() -> [ModalProvider] -> [SubMissionFormModal] -> [Save Mutation] -> [Success] -> onClose()(Success) -> [List Refresh]

## 5. 단계별 적용 순서
1.  `SubMissionFormModal.tsx` 파일 생성 및 코드 이관 implementation.
2.  `modalRegistrations.ts`에 등록.
3.  `SubMissionBuilder`에서 로컬 로직 제거 및 연동.
