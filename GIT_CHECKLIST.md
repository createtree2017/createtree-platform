# 🚨 Git 작업 후 필수 체크리스트

> [!CAUTION]
> `git reset`, `git checkout`, `git pull` 등을 실행한 후에는 **반드시** 아래 절차를 따르세요!

## 왜 필요한가요?

Git 명령어는 **코드만 변경**하고 `node_modules`는 그대로 남겨둡니다.  
이로 인해 코드와 설치된 패키지 간 버전 불일치가 발생할 수 있습니다.

**실제 사례 (2026-01-29):**
- `git reset` 후 서버 시작 실패 (`TypeError: cors is not a function`)
- 원인: 과거 코드 + 미래의 node_modules 상태
- 해결 시간: 30분

## ✅ 필수 실행 절차 (Windows PowerShell)

```powershell
# 1️⃣ node_modules 폴더 삭제 (시간이 좀 걸릴 수 있습니다)
Remove-Item -Recurse -Force node_modules

# 2️⃣ package-lock.json 삭제
Remove-Item -Force package-lock.json

# 3️⃣ 깨끗한 상태로 재설치 (1-2분 소요)
npm install

# 4️⃣ 서버 시작
npm run dev
```

## 🚀 빠른 복구 (한 줄 명령어)

Windows PowerShell에서 복사-붙여넣기:

```powershell
Remove-Item -Recurse -Force node_modules; Remove-Item -Force package-lock.json; npm install; npm run dev
```

## 🔍 문제가 계속되면?

### Option 1: npm 캐시 완전 초기화
```powershell
npm cache clean --force
npm install
```

### Option 2: 환경 검증 스크립트 실행
```bash
npm run verify
```

### Option 3: Critical Incident Report 참고
[CRITICAL_INCIDENT_REPORT.md](file:///C:/Users/TOP/.gemini/antigravity/brain/c74ed5eb-fcbb-477f-aedf-1b1c45332a51/CRITICAL_INCIDENT_REPORT.md) 참고

## 📌 이 문서를 저장하세요!

이 파일을 프로젝트 루트에 `GIT_CHECKLIST.md`로 저장하고,  
팀원들과 공유하여 동일한 문제를 예방하세요.

---

**작성일**: 2026-01-29  
**근거 문서**: [Critical Incident Report](file:///C:/Users/TOP/.gemini/antigravity/brain/c74ed5eb-fcbb-477f-aedf-1b1c45332a51/CRITICAL_INCIDENT_REPORT.md)
