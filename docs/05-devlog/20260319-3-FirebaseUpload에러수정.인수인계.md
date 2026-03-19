# Firebase 업로드 후 URL 저장 API 에러 수정 인수인계

**작성일**: 2026-03-19
**작업 요약**: 클라이언트의 `firebase-upload.ts`에서 발생하는 `Unexpected token '<'` 에러 수정

---

## 1. 문제 원인 (Root Cause)
- 프론트엔드(`client/src/services/firebase-upload.ts`)에서 Firebase 업로드 완료 후, 서버 DB에 URL을 남기기 위해 `fetch('/api/images/save-url')`을 호출함.
- 백엔드(`server/routes.ts`) 로직 상 `imageRouter`는 `/api` 하위에 바로 마운트 되어 있었음 (`app.use('/api', imageRouter);`).
- 따라서 실제 서버 라우트 주소는 `/api/save-url` 이었음.
- 잘못된 경로(`/api/images/save-url`)로 요청 시 백엔드는 매칭되는 라우트가 없어 404를 반환하는 대신, SPA 처리를 위해 `index.html`을 반환함(`<!doctype html>...`).
- 프론트엔드 코드에서는 이를 `res.json()`으로 파싱하려다 JSON 형식이 아니어서 `SyntaxError: Unexpected token '<'` 발생. (이미지 자체는 Firebase에 성공적으로 올라갔기 때문에 실제 생성 프로세스는 정상 동작함)

## 2. 변경 내용
| 파일명 | 변경 전 | 변경 후 |
|---|---|---|
| `client/src/services/firebase-upload.ts` | `fetch('/api/images/save-url', ...)` | `fetch('/api/save-url', ...)` |

## 3. 동작 확인 상태
| 항목 | 상태 | 비고 |
|------|:---:|------|
| API 경로 오타 수정 | ✅ | `/api/save-url`로 통일 |

**다음 작업자 참고사항**:
- 현재 로컬 서버가 자동으로 이 변경 사항을 감지하고 리로드했을 것입니다. 다음번 이미지 생성 시 해당 에러 로그가 더 이상 출력되지 않는지 확인 가능합니다.
