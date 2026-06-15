# Codex 프로젝트 지침

이 저장소는 `GEMINI.md`를 프로젝트의 기준 지침 파일로 사용한다.

Codex는 작업을 시작하기 전에 반드시 아래 문서를 읽고 따른다.

- `GEMINI.md`
- `docs/05-devlog/` 경로의 최신 인수인계 문서

## 언어 규칙

- 모든 문서 작성, 작업 보고, 진행 상황 공유, 최종 답변은 한국어로 진행한다.
- 코드 식별자, 파일명, 명령어, 로그, 외부 API 명칭처럼 원문 유지가 필요한 항목은 그대로 표기할 수 있다.

## 우선 적용 규칙

`GEMINI.md`의 규칙은 이 프로젝트의 작업 지침으로 간주하며, Codex는 이를 활성 지침으로 따른다.

특히 아래 규칙을 반드시 준수한다.

- 사용자 메시지에 `!!질문!!`이 포함되어 있으면 파일 또는 코드를 수정하지 않는다.
- 사용자 메시지에 `!!승인!!`이 포함되어 있으면 코드 및 파일 수정이 허용된다.
- 사용자가 명시적으로 `!!푸시!!`를 사용하지 않는 한 `git add`, `git commit`, `git push`를 실행하지 않는다.
- 사용자 메시지에 `!!테스트!!`가 포함되어 있고 화면 검증이 필요한 작업이면 브라우저 기반 검증을 수행한다.

Codex의 상위 시스템 또는 개발자 지침과 `GEMINI.md`가 충돌하는 경우에는 상위 Codex 지침을 따른다. 단, 가능한 범위 안에서 `GEMINI.md`의 프로젝트별 작업 방식을 최대한 유지한다.

## UI/UX 개발 기준

- 모든 사용자-facing UI와 기능 설정은 모바일 화면을 1차 기준으로 설계한다.
- 모바일에서 터치하기 쉽고, 읽기 쉽고, 반복 사용이 편한 흐름을 우선한다.
- 기능 선택, 수량 조절, 신청, 제출, 확인 같은 주요 행동은 모바일에서 최소한의 조작으로 완료되도록 설계한다.
- 데스크톱 화면은 모바일 기준 UX를 해치지 않는 범위에서 확장형 레이아웃으로 보강한다.

## Repo-local 스킬 운영

- 이 저장소의 Codex 스킬은 `.agents/skills/`를 기준 위치로 사용한다.
- 설치된 스킬 목록은 `.agents/skills/SKILLS_INDEX.md`에서 확인한다.
- 스킬 추가, 삭제, 수정 후에는 `npm run skills:sync`로 목록을 재생성하고 `npm run skills:check`로 검증한다.
- 자동 호출은 `createtree-aicc-platform`, `aicc-ai-image-pipeline`, `aicc-capacitor-fcm`, `aicc-railway-drizzle` 같은 프로젝트 전용 핵심 스킬만 기본값으로 둔다.
- 공통 품질 스킬(`security-best-practices`, `react-best-practices`, `web-design-guidelines`, `web-quality-audit`, `performance`, `accessibility`, `use-railway`)은 `$스킬명`으로 명시 호출할 때만 사용한다.
- 기능 개발, 기존 기능 변경, 업데이트 완료 시 Codex는 `Skill Impact Check`를 자동 수행한다.
- 배포/DB/보안/개인정보/의료광고/AI provider/금전/자동화 권한 정책 변경은 사용자 확인 후 스킬에 반영한다.
