# Environment Verification Scripts

이 디렉토리는 프로젝트 환경 검증을 위한 자동화 스크립트를 포함합니다.

## 📄 파일 목록

### `verify-env.ts`
서버 시작 전 필수 환경 설정과 의존성을 검증하는 스크립트입니다.

**검증 항목:**
- Node.js 버전 확인 (v18 이상 필요)
- 필수 환경변수 존재 여부 (`DATABASE_URL`, `SESSION_SECRET`, `JWT_SECRET`)
- package.json 유효성 검증
- node_modules 설치 상태 확인
- Git 상태 확인 (node_modules 변경사항 감지)

**사용법:**
```bash
# 수동 실행
npm run verify

# npm install 후 자동 실행 (postinstall hook 설정 시)
npm install
```

**package.json 설정 방법:**
```json
{
  "scripts": {
    "verify": "tsx scripts/verify-env.ts",
    "postinstall": "npm run verify",
    "dev": "npm run verify && tsx server/index.ts"
  }
}
```

## 🎯 목적

Critical Incident Report (2026-01-29)의 재발 방지 대책으로 작성되었습니다.

**주요 목표:**
1. Git 작업 후 의존성 불일치 조기 감지
2. 필수 환경변수 누락 방지
3. 서버 시작 전 환경 무결성 검증

## 📚 관련 문서

- [Critical Incident Report](file:///C:/Users/TOP/.gemini/antigravity/brain/c74ed5eb-fcbb-477f-aedf-1b1c45332a51/CRITICAL_INCIDENT_REPORT.md)
