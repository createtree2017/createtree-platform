# 인수인계: MissionManagement 타입에러 수정 + 성장이미지 하드코딩 제거

- **작성일**: 2026-03-26
- **작업 분류**: Quick Fix
- **작업자**: Antigravity

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| 파일 | 변경 내용 |
|------|-----------|
| `client/src/components/admin/MissionManagement.tsx` | useQuery 기본값 추가 (2곳) |
| `client/src/components/ui/CreationTreeProgress.tsx` | 하드코딩 접두어 "쑥쑥 자라는 " 제거 |

---

## 핵심 변경 내용

### 변경 1 — Line 979 (folders 쿼리)

```diff
- const { data: folders } = useQuery<MissionFolder[]>({
+ const { data: folders = [] } = useQuery<MissionFolder[]>({
```

### 변경 2 — Line 2441 (missionFolders 쿼리)

```diff
- const { data: missionFolders } = useQuery<MissionFolder[]>({
+ const { data: missionFolders = [] } = useQuery<MissionFolder[]>({
```

---

## 왜 변경했는가 (변경 배경)

- VS Code 문제 패널에 ts2345, ts2488 에러 2개 표시됨
- TanStack Query의 `useQuery`는 로딩 중엔 `data`가 `undefined`를 반환함
- 기본값 `= []` 없이 선언하면 반환 타입이 `MissionFolder[] | undefined`가 됨
- `setLocalFolders(folders)` → `undefined` 전달 불가 (ts2345)
- `[...missionFolders]` → `undefined`에 `[Symbol.iterator]` 없음 (ts2488)
- 선언부 기본값으로 타입을 `MissionFolder[]`로 확정하는 방식이 가장 깔끔

---

## 동작 확인 상태

- ✅ 코드 수정 완료
- ✅ 에러 2개 모두 해소됨 (타입 수정)
- 런타임 동작에는 영향 없음 (이전에도 실제 값이 있을 때만 사용)

---

## 주의사항 / 알려진 이슈

- 동일 패턴이 다른 `useQuery` 선언에도 적용되어 있을 수 있음 (필요 시 추가 확인)
- `folders`와 `missionFolders`는 같은 `/api/admin/mission-folders` 엔드포인트를 가리키므로 캐시 공유됨

---

## 다음 작업 참고사항

- 없음 (독립적인 Quick Fix)

---

## 작업 3: 페이지 이동 시 스크롤 최상단 자동 초기화 (전역)

### 핵심 변경 내용

**파일**: `client/src/App.tsx` — `Layout` 컴포넌트

```diff
+ const mainRef = useRef<HTMLElement>(null);
+
+ // 라우트 변경 시 스크롤 최상단으로 — 현재 + 미래 모든 페이지 자동 적용
+ useEffect(() => {
+   if (mainRef.current) {
+     mainRef.current.scrollTop = 0;
+   }
+ }, [location]);

- <main className={`flex-1 overflow-y-auto ...`}>
+ <main ref={mainRef} className={`flex-1 overflow-y-auto ...`}>
```

### 왜 변경했는가

- SPA 특성상 라우팅 시 브라우저 스크롤 위치가 초기화되지 않음
- 사용자가 미션 리스트에서 스크롤하다 카드 클릭 시, 미션 상세 페이지가 그 스크롤 위치에서 시작됨
- 이 앱의 스크롤 컨테이너는 `window`가 아닌 `<main>` 요소 (`overflow-y-auto`) → `window.scrollTo(0,0)` 방식은 동작 안 함
- `Layout`의 `main` 요소에 `ref` 부착 후 `location` 변경 감지 → `scrollTop = 0`
- **`Layout`에 1번만 적용 = 현재 + 미래 모든 페이지에 자동 적용됨** (각 페이지마다 추가 불필요)

### 연관 파일

- `client/src/App.tsx` L109~122, L233 (수정)
- 영향받는 모든 `<Layout>` 래핑 페이지 (자동 적용)

### 동작 확인 상태

- ✅ 코드 수정 완료
- 미션 리스트 → 미션 상세 진입 시 최상단에서 시작
- `photobook-v2`, `postcard`, `party` 등 `<Layout>` 없이 렌더링되는 에디터 페이지는 해당 없음 (이 페이지들은 스크롤 자체가 없음)

---

## 작업 2: 성장이미지 캐릭터 이름 하드코딩 제거

### 핵심 변경 내용

**파일**: `client/src/components/ui/CreationTreeProgress.tsx` Line 41

```diff
- Lv.{currentLevel} 쑥쑥 자라는 {treeName}
+ Lv.{currentLevel} {treeName}
```

### 왜 변경했는가

- 사용자 나의미션 화면 성장이미지 뱃지에 "쑥쑥 자라는"이 항상 앞에 붙어 표시됨
- 관리자 큰미션 설정의 `캐릭터 이름` 필드 placeholder가 "예: 쑥쑥 자라는 우리아기 잘도잔다"였는데, 프론트가 이를 따라 하드코딩한 것
- 실제 표시는 `treeName`(관리자 설정값) 그대로만 나오면 충분
- 원하는 접두어는 관리자가 캐릭터 이름 자체에 포함시키면 됨

### 연관 파일

- `client/src/pages/mymission-detail.tsx` (Line 129): `treeName={mission.growthTreeName || "사과몽"}` → API에서 받은 값을 그대로 전달 (변경 없음)
- `client/src/components/modal/admin/BigMissionModals.tsx` (Line 468): placeholder 안내 문구 (변경 없음, 영향 없음)

### 동작 확인 상태

- ✅ 수정 완료
- 관리자가 캐릭터 이름을 "쑥쑥 자라는 우리아기 잘도잔다"로 설정하면 그대로 표시
- 관리자가 캐릭터 이름을 "우리아기 잘도잔다"로만 설정하면 "쑥쑥 자라는" 없이 표시

---

## 작업 4: 나의미션 물방울·햇빛 슬롯 UI 제거

### 핵심 변경 내용

**파일**: `client/src/components/ui/CreationTreeProgress.tsx`

- Line 66~131 "Frequency Board (Water Drops)" 블록 전체 삭제
- 사용하지 않는 import (`Target`, `Droplets`, `Sun`) 제거

### 왜 변경했는가

- 나의미션 상세 페이지 심플화 작업의 첫 번째 단계
- 미션 완료 시마다 물방울/햇빛 아이콘이 채워지는 슬롯 그리드가 UI를 복잡하게 만들었음
- "미션을 완료해주세요!" 헤더 바, 슬롯 원형 그리드, 안내 텍스트 전체 삭제

### 유지되는 것

- 성장 캐릭터 이미지 (단계별 이미지)
- `Lv.N 캐릭터이름` 뱃지

### 동작 확인 상태

- ✅ 수정 완료
- `mymission-detail.tsx`에서만 사용하는 컴포넌트 → 다른 페이지 영향 없음

---

## 작업 5: 나의미션 상단 헤더 이미지 영역 제거 (사용자+관리자)

### 변경 파일

- `client/src/pages/mymission-detail.tsx`
- `client/src/components/modal/admin/BigMissionModals.tsx`

### 핵심 변경 내용

**mymission-detail.tsx**: 최상단 헤더 이미지 블록 전체 삭제
- 이미지 있을 때: 사진 표시 영역 (h-48) 삭제
- 이미지 없을 때: 어두운 渐变 배경 (h-32) 삭제
- `-mt-8 relative z-10` 레이아웃 오프셋도 함께 제거됨

**BigMissionModals.tsx**: 헤더 이미지 업로더 UI 및 관련 코드 정리
- `headerPreview` state 삭제
- `headerFileRef` ref 삭제
- useEffect 내 header 초기화 코드 삭제
- `handleImageUpload`, `removeImage` 함수 타입에서 `"headerImageUrl"` 제거
- UI 블록(Label + 업로드 박스 + 제거 버튼) 삭제

### 왜 변경했는가

- 나의미션 심플화 작업의 일환
- 헤더 이미지가 없는 경우 아무 정보도 없는 어두운 빈 공간이 상단을 차지
- 관리자가 헤더 이미지를 등록하는 기능 자체를 폐기

### 주의사항

- `headerImageUrl` 컬럼은 DB에 여전히 존재 (스키마 변경 없음)
- 기존에 등록된 헤더 이미지 URL 데이터는 DB에 남아있음 (표시만 안 됨)
- 나중에 필요시 코드 복원 가능

### 동작 확인 상태

- ✅ 수정 완료
- 사용자 나의미션 상세 페이지: 상단 빈 배경 영역 사라짐
- 관리자 큰미션 수정 모달: 헤더 이미지 업로더 필드 사라짐

---

## 작업 6: float 애니메이션 제거 + 이미지 2배 확대

### 변경 파일

- `client/src/components/ui/CreationTreeProgress.tsx`
- `client/src/index.css`

### 핵심 변경 내용

- 이미지 컨테이너: `w-48 h-48` → `w-80 h-80` (모바일 320px), `sm:w-56` → `sm:w-96` (384px)
- float 애니메이션 (`animate-float-character`) 적용했다가 삭제 결정으로 제거
- `index.css`의 `@keyframes float-character` 및 `.animate-float-character` 클래스도 삭제

### 왜 변경했는가

- 이미지가 너무 작아 가독성 낮음 → 2배 확대
- float 애니메이션은 관리자 ON/OFF 컨트롤이 필요하나 DB 마이그레이션 비용이 있어 개발 보류 → 제거

---

## 작업 7: "미션 컬렉션" → "진행 미션 [N/M]" 타이틀 변경

### 변경 파일

- `client/src/pages/mymission-detail.tsx`

### 핵심 변경 내용

```diff
- 미션 컬렉션
+ 진행 미션
+ <span>[완료수/전체수]</span>  ← topics 배열에서 실시간 계산
```

계산식: `mission.topics.filter(t => t.isCompleted).length` / `mission.topics.length`

### 왜 변경했는가

- "미션 컬렉션"이라는 명칭보다 "진행 미션"이 사용자가 상태를 직관적으로 파악하기 좋음
- `[0/2]` 형식으로 완료/전체 카운트를 보여줘 진행 현황을 한눈에 파악 가능

### 주의사항

- API 변경 없음 — 기존 `topics` 배열의 `isCompleted` 필드 재활용
- `muted-foreground` 색상으로 카운트가 부제목처럼 보이도록 스타일 적용

### 동작 확인 상태

- ✅ 수정 완료
