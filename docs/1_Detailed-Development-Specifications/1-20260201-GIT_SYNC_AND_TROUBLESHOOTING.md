# Git 동기화 및 보안 사고 해결 보고서

## 1. 사고 개요
*   **일자:** 2026-02-01
*   **문제:** 다중 개발 환경(PC, Replit, 노트북) 간 동기화 실패, `package.json` 등 핵심 구성 파일 누락, `PUSH_REJECTED` 오류, 그리고 보안 키 파일(`createtree-*.json`) 노출로 인한 Git Push 차단.
*   **해결:** 누락된 파일 복구, `.gitignore` 설정 수정, Git 히스토리에서 보안 키 제거, 그리고 표준화된 동기화 절차 확립.

---

## 2. 원인 분석

### A. 잘못된 `.gitignore` 설정
*   **문제:** `.gitignore` 파일에 `*.json`이라는 너무 광범위한 규칙이 추가됨.
*   **결과:** 프로젝트의 핵심 파일인 `package.json`, `tsconfig.json` 등이 무시되어 저장소에서 사라짐. 이로 인해 Replit 등 다른 환경에서 실행 불가 상태 발생.

### B. Git 히스토리 충돌 (Push Rejected)
*   **문제:** PC와 Replit 환경의 기록이 갈라짐(Diverged). Replit에는 로컬 커밋이 있고, 서버에는 PC에서 올린 새로운 커밋이 있어 서로 충돌함.
*   **결과:** `git push`가 `PUSH_REJECTED` 오류로 막힘.

### C. 보안 키 노출 (GitHub 차단)
*   **문제:** `*.json` 무시 규칙을 제거하는 과정에서 Google Cloud 인증 키(`createtree-*.json`, `attached_assets/*.json`)가 실수로 커밋에 포함됨.
*   **결과:** GitHub의 Secret Scanning이 이를 감지하고 Push를 차단함 (오류: `GH013: Repository rule violations - Push cannot contain secrets`).
*   **복합 문제:** 단순히 새 커밋에서 파일을 지우는 것만으로는, 이미 과거 커밋(`ea21fae...`)에 포함된 보안 키를 제거할 수 없어 차단이 지속됨.

---

## 3. 해결 과정

### 1단계: 파일 복구 및 설정 수정
*   백업에서 `package.json`, `package-lock.json`, `tsconfig.json` 복구 완료.
*   `.gitignore` 수정: 무차별적인 `*.json` 대신, 보안 키 파일명(`createtree-*.json`)만 구체적으로 무시하도록 변경.

### 2단계: Git 히스토리 초기화 (핵심 해결책)
*   과거 커밋에 박제된 보안 키를 제거하기 위해 `Reset` 전략 사용. `HEAD~3` 등으로는 해결되지 않아 가장 확실한 방법 사용:
    ```bash
    git reset --mixed origin/main
    ```
*   이 명령어는 **로컬의 작업 파일은 그대로 유지**한 채, 꼬인 Git 기록만 서버의 깨끗한 상태로 되돌림.
*   이후 보안 파일만 확실하게 제외(Unstage)하고, 안전한 파일만 다시 커밋함.

### 3단계: 동기화 완료
*   깨끗한 커밋을 GitHub에 Push 성공.
*   Replit, PC, 노트북 모든 환경에서 에러 없이 동기화됨을 확인.

---

## 4. 재발 방지 가이드 (황금 수칙)

### 수칙 1: "선(先) Pull" 작업 습관
하이브리드 환경(사무실 PC, 집 노트북, Replit)에서 충돌을 막기 위해 반드시 아래 순서를 지킬 것.

1.  **시작할 때 (출근/작업시작):**
    ```bash
    git pull origin main
    ```
    *(내 PC를 최신 서버 상태와 맞춤)*

2.  **작업 진행:**
    *   열심히 코딩...

3.  **끝날 때 (퇴근/작업종료):**
    ```bash
    git add .
    git commit -m "작업 내용 메시지"
    git push origin main
    ```

### 수칙 2: 스마트한 `.gitignore` 관리
*   **절대 금지:** `*.json` 처럼 중요한 설정 파일까지 숨겨버릴 수 있는 광범위한 규칙 사용 금지.
*   **권장 사항:** 무시할 파일은 반드시 구체적인 이름으로 명시.
    ```gitignore
    # 좋은 예
    createtree-*.json
    secrets/*.json
    .env
    ```

### 수칙 3: 보안 파일 관리
*   인증 키(`createtree-*.json` 등) 파일은 **절대 Git에 올리지 말 것**.
*   가능하면 Replit Secrets나 환경 변수(`.env`)를 사용하여 관리.
*   만약 실수로 올렸다면, 단순 삭제가 아니라 **히스토리 삭제(Reset/Rebase)**가 필요함을 인지할 것.

---

## 5. 환경별 참고사항

### PC (createAI_v1_home)
*   메인 개발 환경.
*   현재 기준이 되는 "Master" 상태.

### Replit
*   클라우드 개발 환경.
*   UI 버튼(`Sync Changes`)이 충돌로 막힐 경우, **Shell** 탭에서 수동으로 `git pull` 명령어 사용 권장.

### 노트북
*   보조 환경.
*   오랜만에 켰을 때 기록 차이가 너무 크다면, `git fetch` 후 `git reset --hard origin/main`으로 덮어쓰는 것이 안전함.
