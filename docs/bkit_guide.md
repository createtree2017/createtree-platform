
# bkit (Vibecoding Kit) 활용 가이드 for CreateTree Platform

> **작성일**: 2026-02-01
> **버전**: v1.4.7 기준
> **작성자**: bkit AI

---

## 1. 개요 (Overview)

bkit은 **AI 네이티브 개발 방법론(PDCA)**을 적용하여 프로젝트의 계획, 설계, 구현, 검증 과정을 체계적으로 관리하는 도구입니다. **CreateTree Platform** (`createAI_v1_home`)은 이미 **Dynamic Level (Fullstack)** 구조를 갖추고 있으므로, bkit을 통해 기존 개발 프로세스를 더욱 체계화하고 문서화할 수 있습니다.

### 핵심 가치
1.  **Thinking before Coding**: 구현 전 계획/설계 강제 -> 재작업 최소화
2.  **Documentation as Code**: `docs/` 폴더에 모든 의사결정 기록 -> 히스토리 관리 용이
3.  **Process Automation**: 반복적인 문서 작업 및 검증 자동화

---

## 2. 사용 가능한 명령어 목록 (Command List)

bkit v1.4.7 및 Gemini Extension에서 확인된 전체 명령어 목록입니다.

### 2.1 🔄 PDCA Skills (핵심 프로세스)
> 기능 개발의 라이프사이클을 관리합니다. 가장 빈번하게 사용됩니다.

| 명령어 | 설명 | 생성/수정 파일 |
| :--- | :--- | :--- |
| `/pdca status` | 현재 프로젝트의 PDCA 진행 상태(할 일, 진행 중)를 요약하여 보여줍니다. | - |
| `/pdca plan {feature}` | 기능 구현을 위한 **계획(Plan)** 문서를 생성합니다. | `docs/01-plan/features/{feature}.plan.md` |
| `/pdca design {feature}` | 계획 기반의 기술 **설계(Design)** 문서를 생성합니다. (DB, API, UI 등) | `docs/02-design/features/{feature}.design.md` |
| `/pdca do {feature}` | 설계 기반의 **구현(Implementation)** 가이드를 작성합니다. | `docs/03-do/features/{feature}.do.md` |
| `/pdca analyze {feature}` | 구현된 코드와 설계 문서 간의 차이(**Gap**)를 분석합니다. | `docs/03-analysis/{feature}.analysis.md` |
| `/pdca iterate {feature}` | 분석 결과 점수가 90점 미만일 경우, **자동 수정** 루프를 실행합니다. | (코드 및 문서 수정) |
| `/pdca report {feature}` | 기능 구현이 완료된 후 **최종 리포트**를 생성합니다. (완료 처리) | `docs/04-report/{feature}.report.md` |
| `/pdca next` | 현재 상태에서 수행해야 할 **다음 단계**를 가이드합니다. | - |

### 2.2 📊 Level Skills (프로젝트 초기화/업그레이드)
> 프로젝트의 기술적 난이도와 구조를 정의합니다. CreateTree는 **Dynamic**에 해당합니다.

| 명령어 | 설명 | 대상 |
| :--- | :--- | :--- |
| `/starter` | 정적 웹사이트, 랜딩 페이지 등 간단한 구조 | HTML/CSS/JS |
| `/dynamic` | **DB, 백엔드 API, 인증이 포함된 풀스택 앱 (권장)** | **React+Express+Node.js** |
| `/enterprise` | 마이크로서비스(MSA), Kubernetes 등 대규모 구조 | MSA, K8s, Terraform |

### 2.3 🚀 Pipeline Skills (전체 개발 로드맵)
> 프로젝트 전체의 거시적인 진행 단계를 관리합니다.

| 명령어 | 설명 |
| :--- | :--- |
| `/development-pipeline start` | 9단계 개발 파이프라인(Schema~Deployment)을 시작합니다. |
| `/development-pipeline status` | 현재 파이프라인 단계와 진척도를 확인합니다. |
| `/development-pipeline next` | 다음 파이프라인 단계로 진입을 안내합니다. |

### 2.4 🛠 Utility Skills (도구 및 학습)
> 개발 보조 및 플러그인 학습 도구입니다.

| 명령어 | 설명 |
| :--- | :--- |
| `/zero-script-qa` | 테스트 스크립트 작성 없이, 로그 기반으로 **QA 테스트**를 수행합니다. |
| `/code-review` | 현재 코드의 품질, 보안, 컨벤션 준수 여부를 **리뷰**합니다. |
| `/claude-code-learning` | Claude Code (및 bkit) 사용법을 대화형으로 학습합니다. |

---

## 3. CreateTree Platform 활용 방안

현재 **CreateTree Platform**은 `client/` (React+Vite)와 `server/` (Express+Node.js)가 분리된 **Monorepo 형태의 Dynamic Project**입니다.

### 3.1 추천 워크플로우 (Proposed Workflow)

기존 개발 방식에 bkit을 "스며들게" 하는 전략을 추천합니다.

**Step 1: 기능 정의 (Plan)**
*   새로운 기능(예: "모바일 앨범") 개발 시작 시, 코딩부터 하지 않고 계획을 세웁니다.
*   `> /pdca plan 모바일_앨범_기능`
*   결과물: `docs/01-plan/features/mobile-album.plan.md` 생성됨. 여기에 요구사항 정리.

**Step 2: 기술 설계 (Design)**
*   기존 시스템(`server/routes`, `shared/db` 등)과의 연동성을 고려하여 설계를 문서화합니다.
*   `> /pdca design 모바일_앨범_기능`
*   결과물: `docs/02-design/features/mobile-album.design.md` 생성됨. API 명세 및 테이블 스키마 확정.

**Step 3: 구현 가이드 (Do)**
*   설계 문서를 바탕으로 구현 순서와 체크리스트를 만듭니다.
*   `> /pdca do 모바일_앨범_기능`
*   결과물: `docs/03-do/features/mobile-album.do.md` 생성됨. 이 문서를 보며 개발 진행.

**Step 4: 검증 및 수정 (Check & Act)**
*   개발 완료 후, 설계대로 잘 되었는지 AI에게 검사를 맡깁니다.
*   `> /pdca analyze 모바일_앨범_기능`
*   만약 누락된 부분이 있다면 `> /pdca iterate`로 자동 수정.

### 3.2 디렉터리 구조 매핑

bkit의 표준 구조와 CreateTree의 현황을 매핑하여 사용합니다.

| bkit 문서 | CreateTree 연관 경로 | 비고 |
| :--- | :--- | :--- |
| **Plan** | `docs/01-plan/` | 신규 생성 필요 |
| **Design** | `docs/02-design/` | 신규 생성 필요 |
| **Schema** | `shared/schema.ts` (Drizzle) | 기존 코드 활용 |
| **API** | `server/routes/` | 기존 코드 활용 |
| **Frontend** | `client/src/pages/` | 기존 코드 활용 |

### 3.3 도입 효과

1.  **히스토리 자산화**: 개발자가 바뀌거나 시간이 지나도 `docs/` 폴더만 보면 "왜 이렇게 개발했는지" 알 수 있습니다.
2.  **커뮤니케이션 비용 절감**: "이거 어떻게 만들까요?"라는 질문 대신 "Design 문서 확인해주세요"로 대체 가능합니다.
3.  **AI 협업 효율 극대화**: AI에게 맥락(Context)을 매번 설명할 필요 없이, 이미 작성된 Plan/Design 문서를 읽게 하면 정확도가 비약적으로 상승합니다.

---

## 4. 커스터마이징 포인트 (Advanced)

`~/.gemini/extensions/bkit/templates/` 폴더 내의 템플릿 파일들을 수정하여 **CreateTree 전용 양식**을 만들 수 있습니다.

*   `design.template.md`: 기본 기술 스택을 React+Vite+Express+Drizzle로 고정해두면, 매번 기술 스택을 지정할 필요가 없습니다.
*   `plan.template.md`: 회사 내부의 기획 필수 항목(예: 비즈니스 임팩트 등)을 추가할 수 있습니다.
