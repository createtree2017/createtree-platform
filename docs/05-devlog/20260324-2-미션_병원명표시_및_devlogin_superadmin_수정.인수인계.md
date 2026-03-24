# 20260324-2-미션_병원명표시_및_devlogin_superadmin_수정.인수인계.md

## 📅 날짜: 2026-03-24

---

## 📝 작업 내용 요약

### 1. 미션 리스트 병원명(거래처명) 배지 추가
`client/src/pages/missions.tsx`의 미션 카드에서 상태 뱃지(진행중, 선물) 앞에 병원명을 표시하도록 수정했습니다.
- **문화센터 탭** (카드 그리드) 과 **히스토리 탭** (목록) 두 곳 모두 적용
- `mission.hospital` 데이터가 있을 때만 병원명 배지 렌더링 (없으면 미표시)
- 스타일: `bg-slate-700/60` 다크 둥근 배지

### 2. `/api/dev/auto-login` superadmin 수정
`server/routes/dev-login.ts`에서 자동 로그인 대상 계정을 `"admin"` → `"superadmin"`으로 변경했습니다.
- **문제**: `memberType: "admin"`으로 조회하면 병원 관리자(이즈맘산부인과 등)로 로그인됨 → 관리자 기능 테스트 불가
- **해결**: `memberType: "superadmin"`으로 조건 변경, admin fallback 완전 제거
- superadmin 계정 없을 시 404 에러 반환

---

## 📂 변경 파일 목록

| 파일 경로 | 수정 내용 |
|---|---|
| `client/src/pages/missions.tsx` | 미션 카드 병원명 배지 추가 (두 곳) |
| `server/routes/dev-login.ts` | auto-login 대상을 superadmin으로 변경 |

---

## ✅ 동작 확인 상태

- [x] `/api/dev/auto-login` → superadmin 계정으로 로그인
- [x] 미션 리스트 카드에 병원명 배지 표시 (hospital 있는 미션만)

## ⚠️ 주의사항

- `hospital` 데이터가 없는 미션(공개 미션 등)은 병원명 배지가 자동으로 숨겨짐 → 정상 동작
- superadmin 계정이 DB에 없으면 auto-login이 404 반환

---
