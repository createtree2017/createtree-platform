# 다중 이미지 + 텍스트 매핑 프롬프트 가이드

## 외부 AI 스타일 크리에이터를 위한 명령어 매뉴얼

> 최종 업데이트: 2026-01-03  
> 테스트 완료: test_tototo 컨셉 (3개 이미지 + 3개 텍스트 정상 작동 확인)

---

## 1. 지원 플레이스홀더 목록

| 플레이스홀더 | 용도 | 지원 형식 |
|------------|------|----------|
| `[IMAGE_COUNT]` | 사용자가 업로드한 총 이미지 개수 | `[IMAGE_COUNT]`, `{{IMAGE_COUNT}}`, `{IMAGE_COUNT}` |
| `[LAYOUT_INSTRUCTION]` | 이미지 개수에 따른 자동 레이아웃 지침 | `[LAYOUT_INSTRUCTION]` |
| `[IMAGE_N]` | N번째 이미지 위치 (1부터 시작) | `[IMAGE_1]`, `[IMAGE_2]`, `[IMAGE_3]`... |
| `[TEXT_N]` | N번째 이미지에 대응하는 사용자 입력 텍스트 | `[TEXT_1]`, `[TEXT_2]`, `[TEXT_3]`... |
| `{변수명}` | 일반 변수 치환 | `{babyName}`, `{{style}}` |

---

## 2. 플레이스홀더 상세 설명

### 2.1 `[IMAGE_COUNT]` - 이미지 개수

사용자가 업로드한 이미지 개수로 자동 치환됩니다.

**입력 템플릿:**
```
Create a composite image with [IMAGE_COUNT] photos.
```

**출력 결과 (사용자가 3개 이미지 업로드 시):**
```
Create a composite image with 3 photos.
```

---

### 2.2 `[LAYOUT_INSTRUCTION]` - 자동 레이아웃 지침

이미지 개수에 따라 시스템이 자동으로 레이아웃 지침을 생성합니다.

**자동 생성 레이아웃 규칙:**

| 이미지 수 | 자동 레이아웃 설명 |
|----------|------------------|
| 1개 | 중앙 배치, 큰 장식 프레임 |
| 2개 | 좌우 나란히 배치 |
| 3개 | 삼각형/지그재그 패턴 배치 |
| 4개 | 2x2 그리드 배치 |
| 5개 | 중앙 1개(큰 것) + 모서리 4개 |
| 6개 이상 | NxN 그리드 자동 계산 |

**예시 - 3개 이미지일 때 자동 생성되는 레이아웃:**

```
Arrange 3 photos in a triangular/zig-zag pattern:
- Top-Left: Place [IMAGE_1] inside a decorative frame. Write the text "[TEXT_1]" clearly below the frame.
- Center-Right: Place [IMAGE_2] inside a matching frame. Write the text "[TEXT_2]" next to or below it.
- Bottom-Left: Place [IMAGE_3] with decorative elements. Write the text "[TEXT_3]" nearby.
```

---

### 2.3 `[IMAGE_N]` / `[TEXT_N]` - 개별 이미지 및 텍스트

각 이미지와 해당 텍스트를 개별적으로 참조할 때 사용합니다.

**치환 과정:**
- `[IMAGE_1]` → `[첨부된 이미지 1]` (AI에게 이미지 참조 표시)
- `[TEXT_1]` → 사용자가 입력한 실제 텍스트 내용

**입력 템플릿:**
```
Place [IMAGE_1] with the caption "[TEXT_1]" below it.
```

**출력 결과 (사용자 입력: 이미지1 + "20주차 우리 아기"):**
```
Place [첨부된 이미지 1] with the caption "20주차 우리 아기" below it.
```

---

## 3. 실전 템플릿 예제

### 예제 1: 크리스마스 앨범 (테스트 완료)

```
# Role
You are an expert layout designer for Christmas-themed photo albums.

# Task
Create a flat-lay composite image integrating [IMAGE_COUNT] user-provided ultrasound photos into a beautiful Christmas background.

# 1. Background & Atmosphere
* **Background Color:** Soft Pastel Sky Blue.
* **Bottom Area:** Festive arrangement of Red/Green/Gold Christmas gift boxes, Gingerbread cookies, and a Red Rudolph-patterned blanket.
* **Decorations:** Candy canes, snowflakes, and sparkling stars scattered harmoniously across the canvas.

# 2. Layout & Composition (Strict Grid System)
You MUST create [IMAGE_COUNT] distinct frames. Do not merge them.
Refer to the following layout plan based on [IMAGE_COUNT] images:

[LAYOUT_INSTRUCTION]

# 3. Text & Image Integration Rules
* **Text Rendering:** You must render the text content explicitly provided in the quotes above. Do not write the variable names like "TEXT_1". Write the *actual content* replaced in that spot.
* **Preservation:** DO NOT alter the content of the ultrasound photos (faces, shapes). Just add the frame border and shadow.
* **Shadows:** Apply soft, natural drop shadows to the photo frames so they look placed on the canvas.
```

**테스트 결과:**
- 입력: 3개 초음파 이미지 + ["20주차 예승이의 하루", "30주차 예승이의 이쁜 머리", "꼬물꼬물 우리 예승이는 엄마를 만나기를 기대하고 기다리고 있어요~"]
- 결과: 3개 프레임에 각각 이미지와 텍스트 정확히 배치됨

---

### 예제 2: 심플 콜라주

```
Create a beautiful photo collage with [IMAGE_COUNT] photos.

Layout:
[LAYOUT_INSTRUCTION]

Important Rules:
- Each photo must have its corresponding text rendered EXACTLY as provided.
- Use decorative frames for each photo.
- Add soft shadows for depth.
- Maintain the original image content without alterations.
```

---

### 예제 3: 수동 레이아웃 (고급 - 자동 레이아웃 미사용)

자동 `[LAYOUT_INSTRUCTION]` 대신 직접 레이아웃을 지정할 수 있습니다:

```
Create a beautiful album page with exactly 3 ultrasound photos.

Layout specification:
1. **Left frame (50% width):** Display [IMAGE_1] prominently in a gold ornate frame.
   Below it, write "[TEXT_1]" in elegant script font.

2. **Right-top frame (25% width):** Display [IMAGE_2] in a circular frame with soft vignette.
   Caption: "[TEXT_2]"

3. **Right-bottom frame (25% width):** Display [IMAGE_3] with vintage sepia filter effect.
   Caption: "[TEXT_3]"

Background: Soft cream color with subtle floral patterns.
```

---

### 예제 4: 유동적 이미지 개수 대응

사용자가 1~5개 중 몇 개를 업로드할지 모를 때:

```
# Photo Album Generator

Create a harmonious album layout for [IMAGE_COUNT] ultrasound photos.

## Layout Rules
[LAYOUT_INSTRUCTION]

## Style Guidelines
- Use pastel pink and blue color scheme
- Each photo frame should have rounded corners
- Add small decorative hearts around the frames
- Text should be in a soft handwritten font style

## Critical Requirements
1. Every uploaded image MUST appear in the final result
2. Every text caption MUST be rendered exactly as provided
3. Do NOT add extra images or text not provided by the user
```

---

## 4. 치환 순서 (중요!)

시스템은 다음 순서로 플레이스홀더를 처리합니다:

```
1단계: [IMAGE_COUNT], [LAYOUT_INSTRUCTION] → 동적 레이아웃 먼저 처리
       ↓
2단계: [IMAGE_N], [TEXT_N] → 개별 이미지/텍스트 치환
       ↓
3단계: {변수}, {{변수}} → 일반 변수 치환
       ↓
4단계: 시스템 프롬프트 → 마지막에 추가
```

**참고:** `[LAYOUT_INSTRUCTION]` 내부에도 `[IMAGE_N]`, `[TEXT_N]`이 포함되어 있으므로 2단계에서 함께 치환됩니다.

---

## 5. 주의사항

### 권장사항

| 항목 | 설명 |
|-----|------|
| 번호 시작 | 이미지 번호는 **1부터 시작** (0이 아님) |
| 텍스트 감싸기 | 텍스트는 반드시 **큰따옴표로 감싸서** 표시: `"[TEXT_1]"` |
| 자동 레이아웃 | `[LAYOUT_INSTRUCTION]` 사용 시 내부에 `[IMAGE_N]`, `[TEXT_N]`이 자동 포함됨 |
| 다양한 개수 대응 | 1~5개 이미지 모두 고려한 템플릿 작성 권장 |
| 명확한 지시 | AI에게 "텍스트를 정확히 렌더링하라"는 지시 포함 권장 |

### 피해야 할 것

| 항목 | 이유 |
|-----|------|
| `[IMAGE_0]`, `[TEXT_0]` 사용 | 번호는 1부터 시작, 0은 무효 |
| 매핑되지 않은 플레이스홀더 | 자동으로 빈 문자열로 제거됨 |
| 리터럴로 `[IMAGE_1]` 출력 시도 | 항상 치환되므로 불가능 |

---

## 6. 관리자 설정: enable_image_text

컨셉 설정에서 `enable_image_text` 옵션을 활성화해야 다중 이미지+텍스트 모드가 작동합니다.

| 설정값 | 동작 |
|-------|-----|
| `true` | 사용자에게 각 이미지별 텍스트 입력 UI 표시, `[TEXT_N]` 치환 활성화 |
| `false` | 단일 이미지 모드, 텍스트 입력 UI 없음 |

---

## 7. 디버깅 가이드

### 로그 파일 위치
```
/tmp/image-generation.log
```

### 로그에서 확인할 수 있는 정보
- API 진입 시점
- 파일 업로드 정보 (파일명, 크기)
- imageTexts 파싱 결과
- imageMappings 생성 결과
- buildPromptWithImageMappings 호출 전/후 프롬프트
- 최종 프롬프트 전문
- AI 호출 정보 (모델명, 이미지 수)
- 생성 결과 URL

### 로그 확인 명령어
```bash
# 최근 로그 100줄 확인
tail -100 /tmp/image-generation.log

# 특정 키워드 검색
grep "imageMappings" /tmp/image-generation.log

# 에러만 검색
grep "ERROR\|❌" /tmp/image-generation.log
```

---

## 8. 기술 스펙 요약

| 항목 | 값 |
|-----|---|
| 최대 지원 이미지 수 | 제한 없음 (6개 이상은 자동 그리드) |
| 텍스트 길이 제한 | 없음 (단, AI 토큰 한도 고려) |
| 지원 이미지 형식 | PNG, JPG, WebP |
| 프롬프트 빌더 함수 | `buildPromptWithImageMappings()` |
| 관련 파일 | `server/utils/prompt.ts` |

---

## 9. 변경 이력

| 날짜 | 변경 내용 |
|-----|----------|
| 2026-01-03 | 최초 문서 작성, test_tototo 컨셉 테스트 완료 |
| 2026-01-03 | 영구 로깅 시스템 구축 완료 |
