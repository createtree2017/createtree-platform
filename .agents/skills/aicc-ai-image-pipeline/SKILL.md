---
name: aicc-ai-image-pipeline
description: "CT_aicc AI 이미지 생성 파이프라인 스킬. Use for OpenAI/Gemini image generation, model registry, reference-image handling, Firebase/GCS uploaded buffers, image-to-image vs text-to-image routing, aspect ratio support, fallback behavior, throttling, and image generation bug fixes."
---

# AI 이미지 파이프라인 스킬

## 핵심 기준

이미지 생성은 사용자 입력 원본, Firebase/GCS 저장, OpenAI/Gemini 호출, 관리자 갤러리, 결과 저장이 연결된 민감한 경로다. 모델명과 지원 파라미터는 추측하지 말고 공식 문서 또는 기존 capability registry를 확인한다.

## 작업 전 확인

- `shared/model-capabilities` 계열, 이미지 생성 라우트, OpenAI/Gemini adapter, Firebase upload middleware를 우선 확인한다.
- 최근 이미지 관련 인수인계 문서를 확인한다. 특히 참조 이미지 누락, text-only 오판, 모델 권한 오류, throttling 이슈를 재확인한다.
- OpenAI 관련 최신 스펙이 필요하면 공식 OpenAI docs를 확인한다.

## 구현 규칙

- 참조 이미지가 있으면 OpenAI 계열은 edit/image-to-image 경로, Gemini 계열은 inlineData 포함 경로를 보장한다.
- Firebase URL 업로드와 Multer 파일 업로드는 서버 내부에서 동일한 참조 이미지 구조로 정규화한다.
- 모델별 비율과 해상도는 provider capability에 맞게 제한한다.
- 실제 API 호출 검증은 비용과 시간이 발생하므로 smoke 단계에서만 수행하고, 자동화 정책 변경은 사용자 확인을 받는다.
- 원본 첨부와 생성 결과물은 관리자 갤러리에서 섞이지 않게 한다.

## 검증

- 참조 이미지 포함/미포함, text-to-image/image-to-image, OpenAI/Gemini fallback, Firebase buffer 경로를 각각 확인한다.
- 스킬 내용이 바뀌면 `npm run skills:sync`와 `npm run skills:check`를 실행한다.
