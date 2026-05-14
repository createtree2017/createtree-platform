# Codex 스킬 목록

> 이 문서는 `.agents/scripts/generate_skills_index.py`로 자동 생성됩니다. 스킬을 추가, 삭제, 수정한 뒤에는 `npm run skills:sync`를 실행하세요.

## 운영 규칙

- 스킬의 실제 내용은 각 폴더의 `SKILL.md`를 기준으로 합니다.
- 기능 개발, 기존 기능 변경, 업데이트 완료 시 AI는 `Skill Impact Check`를 수행합니다.
- 스킬이 추가, 삭제, 변경되면 `SKILLS_INDEX.md`를 재생성하고 `npm run skills:check`로 검증합니다.

## 설치된 스킬

| 폴더 | 스킬명 | 표시명 | 기능 요약 | 자동 호출 |
| --- | --- | --- | --- | --- |
| accessibility | accessibility | 접근성 점검 | WCAG·키보드·폼 접근성 점검 | false |
| aicc-ai-image-pipeline | aicc-ai-image-pipeline | AICC 이미지 파이프라인 | OpenAI·Gemini 이미지 생성 안전 기준 | true |
| aicc-capacitor-fcm | aicc-capacitor-fcm | AICC Capacitor FCM | Android 앱·FCM 푸시 운영 기준 | true |
| aicc-railway-drizzle | aicc-railway-drizzle | AICC Railway Drizzle | Railway DB·Drizzle 변경 안전 기준 | true |
| createtree-aicc-platform | createtree-aicc-platform | AI문화센터 플랫폼 | CT_aicc 앱·관리자·운영 작업 기준 | true |
| performance | performance | 성능 최적화 | 로딩·번들·렌더링 성능 점검 | false |
| react-best-practices | vercel-react-best-practices | Vercel React 품질 | React 컴포넌트 성능·구조 점검 | false |
| security-best-practices | security-best-practices | Security Best Practices | Security reviews and secure-by-default guidance | false |
| use-railway | use-railway | Railway 운영 | Railway 배포·환경변수·장애 점검 | false |
| web-design-guidelines | web-design-guidelines | 웹 디자인 가이드 | UI·UX·접근성 기본 품질 점검 | false |
| web-quality-audit | web-quality-audit | 웹 품질 감사 | 성능·접근성·SEO 종합 점검 | false |
