# Firebase Direct Upload 원본 첨부 분리 최종 계획 인수인계

작성일: 2026-04-30

## 1. 결론

관리자 이미지 갤러리는 "사이트에서 생성된 최종 이미지"를 모니터링하는 화면으로 유지한다.

Firebase Direct Upload로 올라간 사용자 첨부 원본은 생성 결과물이 아니므로 `images` 테이블과 관리자 이미지 갤러리에 섞지 않는다. 원본 첨부가 관리자 확인 대상이 될 수는 있지만, 기본 이미지 갤러리가 아니라 별도의 "원본 첨부 감사/참조 업로드" 화면 또는 API에서 제한적으로 조회하는 구조가 장기적으로 가장 안전하고 운영 효율이 좋다.

이번 개발의 핵심은 두 겹의 안전장치다.

1. 기존에 `images` 테이블에 들어간 legacy Firebase 원본 row는 관리자 이미지 갤러리에서 제외한다.
2. 앞으로 `/api/save-url`이 저장하는 Firebase 원본 첨부는 신규 `image_reference_uploads` 테이블에 저장한다.

## 2. 재확인한 원인

2026-04-25 이후, 특히 2026-04-28 이후부터 `9059056@gmail.com` 계정에서만 관리자 이미지 갤러리에 `fd0d999...jpg` 같은 원본 첨부 파일명이 보였다.

DB 확인 기준으로 `style = firebase-direct` 또는 `category_id = firebase_upload`인 row는 `9059056@gmail.com` 사용자에 집중되어 있었다. 반면 병원 관리자 계정 `moonobgy@gmail.com`의 프로덕션 생성 로그에서는 Firebase URL 저장 흐름이 보이지 않았고, 생성 결과물만 갤러리에 추가되었다.

프로덕션 번들 확인 결과 `VITE_ENABLE_FIREBASE_UPLOAD`가 빌드 시점에 `undefined`로 들어가 있었다. 따라서 운영 배포본에서는 대부분의 사용자가 Firebase Direct Upload를 시도하지 않고 서버 업로드 흐름을 타는 것이 정상적인 관측이다.

즉, 현상은 계정 등급별 의도된 차이가 아니라 환경/빌드/세션 조건 차이로 인해 `9059056@gmail.com` 사용 환경에서만 Firebase Direct Upload + `/api/save-url` 저장이 성공하면서 드러난 구조적 문제다.

## 3. 최종 설계

### 3.1 데이터 분리

- `images`
  - 생성된 최종 이미지 전용
  - 사용자 갤러리와 관리자 이미지 갤러리의 기본 데이터 소스
  - 생성 결과의 `title`, `style`, `categoryId`, `conceptId`, `transformedUrl`, `thumbnailUrl` 관리

- `image_reference_uploads`
  - Firebase Direct Upload로 사용자가 첨부한 생성 입력 원본 전용
  - `userId`, `imageUrl`, `storagePath`, `fileName`, `fileSize`, `mimeType`, `provider`, `purpose`, `status`, `metadata` 저장
  - 추후 생성 결과 이미지와 연결할 수 있도록 `generatedImageId` 필드 준비

### 3.2 관리자 화면 정책

- 기존 관리자 이미지 갤러리 `/api/admin/images`
  - 생성 결과만 표시
  - `categoryId = firebase_upload` 제외
  - `style = firebase-direct` 제외

- 원본 첨부 확인 기능
  - 기본 관리자 이미지 갤러리에 섞지 않는다.
  - 필요 시 후속 단계에서 `image_reference_uploads` 기반의 별도 관리자 탭을 만든다.
  - 이 화면은 관리자/슈퍼관리자 권한, 검색, 사용자 필터, 보존 기간, 삭제 정책을 갖춘 감사 화면으로 설계한다.

### 3.3 운영 활성화 정책

Firebase Direct Upload는 모든 사용자에게 동일한 조건으로 적용하는 방향이 장기적으로 좋다. 다만 운영 중인 이미지 생성 서비스이므로 아래 순서가 안전하다.

1. 코드 배포: 관리자 갤러리 legacy 원본 제외 + `/api/save-url` 신규 테이블 저장/fallback 적용
2. DB 마이그레이션: `image_reference_uploads` 테이블 생성
3. Railway 변수 보강
   - `ENABLE_FIREBASE_DIRECT_UPLOAD=true`
   - `VITE_ENABLE_FIREBASE_UPLOAD=true`
   - `VITE_FIREBASE_STORAGE_BUCKET=createtreeai.firebasestorage.app`
   - `VITE_FIREBASE_AUTH_DOMAIN=createtreeai.firebaseapp.com`
   - 필요 시 `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_MEASUREMENT_ID`도 운영과 로컬을 맞춘다.
4. 재빌드/재배포: `VITE_*` 값은 빌드 타임 값이므로 변수 추가 후 반드시 새 번들을 배포한다.
5. canary 검증: 슈퍼관리자, 병원 관리자, 일반 사용자 계정으로 각각 같은 컨셉을 생성해 저장 경로를 비교한다.

## 4. 이번 구현 내용

### 4.1 `shared/schema.ts`

신규 테이블 `imageReferenceUploads`를 추가했다.

- 테이블명: `image_reference_uploads`
- 생성 입력 원본의 Firebase URL과 Storage path를 저장한다.
- 생성 결과와 연결할 수 있도록 `generatedImageId`를 준비했다.
- 사용자/생성결과/상태/생성일 인덱스를 추가했다.
- 같은 Firebase 파일이 중복 기록되지 않도록 `storagePath`는 unique index로 관리한다.

### 4.2 `server/routes/image.ts`

`POST /api/save-url` 저장 흐름을 변경했다.

- 우선 `image_reference_uploads`에 저장한다.
- 새 테이블이 아직 운영 DB에 없으면 기존 `images` 저장 방식으로 fallback한다.
- fallback된 legacy row도 관리자 갤러리에서 제외되도록 `style = firebase-direct`, `categoryId = firebase_upload`를 유지한다.
- 응답에는 `storageMode`를 포함한다.
  - 신규 저장: `storageMode = reference_uploads`
  - fallback 저장: `storageMode = legacy_images`

### 4.3 `server/routes/admin-routes.ts`

`GET /api/admin/images`에 legacy 원본 첨부 제외 필터를 추가했다.

- 총 개수 조회와 목록 조회에 동일 필터를 적용했다.
- 페이지 수와 화면 목록의 기준이 어긋나지 않도록 했다.

### 4.4 `client/src/services/firebase-upload.ts`

`/api/save-url` 응답의 `uploadId`, `imageId`, `storageMode`를 받을 수 있도록 타입과 로그를 확장했다.

## 5. 검증 계획

### 5.1 개발 서버 정적 검증

- `git diff --check`
- `npm run check`
- `npm run build`

### 5.2 기능 검증

`!!테스트!!` 승인 후 브라우저에서 진행한다.

1. 로컬 개발 서버에서 `9059056@gmail.com`으로 이미지 생성
2. `/api/save-url` 응답이 `storageMode = reference_uploads`인지 확인
3. 관리자 이미지 갤러리에 원본 첨부가 섞이지 않는지 확인
4. 병원 관리자 계정으로 같은 컨셉 생성
5. 관리자 이미지 갤러리에 생성 결과만 추가되는지 확인
6. 사용자 갤러리에는 기존처럼 생성 결과만 보이는지 확인

### 5.3 운영 배포 전 체크리스트

- Railway 변수 추가 여부 확인
- DB 마이그레이션 적용 여부 확인
- Firebase Storage Rules에서 `uploads/{uid}/...` 경로 소유권 조건 확인
- CORS 설정 확인
- 배포 후 실제 번들에서 `VITE_ENABLE_FIREBASE_UPLOAD`가 `true`로 들어갔는지 확인

## 6. 남은 후속 작업

1. `image_reference_uploads` 운영 DB 마이그레이션 적용
2. 기존 `images`에 저장된 legacy `firebase_upload` row를 신규 테이블로 이관할지 결정
3. 관리자용 원본 첨부 감사 탭이 필요한지 결정
4. 원본 첨부 보존 기간 정책 수립
5. 생성 결과 이미지와 참조 업로드 row를 연결하는 후속 작업 검토

## 7. 주의사항

- 이번 변경은 `git add`, `git commit`, `git push`를 수행하지 않았다.
- 운영 DB 마이그레이션은 별도 승인 후 진행해야 한다.
- 브라우저 직접 화면 검증은 `!!테스트!!` 요청이 있을 때 수행한다.
- 사용자가 대화에 노출한 API 키와 비밀값은 보안상 교체를 권장한다.

## 8. 이번 작업 검증 결과

- `git diff --check`
  - 통과
- `npm run check`
  - 실패
  - 이번 작업 파일의 신규 타입 오류가 아니라, 기존 관리자/페르소나/포토북/서버 서비스 영역의 누적 타입 오류가 다수 출력되었다.
  - 대표 파일: `client/src/components/admin/BannerManagement.tsx`, `client/src/components/admin/PersonaCategoryManagement.tsx`, `client/src/components/photobook-v2/TopBar.tsx`, `server/services/milestones.ts`
- `npm run build`
  - 최초 실행은 샌드박스 내 esbuild 프로세스 실행이 `spawn EPERM`으로 막혀 실패
  - 동일 명령을 승인된 샌드박스 외부 실행으로 재시도하여 통과

현재 코드 레벨에서 확인된 핵심 결과는 다음과 같다.

1. 관리자 이미지 갤러리 조회는 legacy Firebase 원본 row를 제외한다.
2. `/api/save-url`은 신규 `image_reference_uploads` 테이블 저장을 우선한다.
3. 신규 테이블이 아직 운영 DB에 없어도 legacy 저장으로 fallback하여 이미지 생성 흐름을 중단하지 않는다.
4. 운영에서 Firebase Direct Upload를 전체 사용자에게 켜려면 Railway 변수 보강, DB 마이그레이션, 재빌드/재배포가 반드시 필요하다.

## 9. 마이그레이션 준비 결과

`db/migrations/20260430_create_image_reference_uploads.sql` 파일을 추가했다.

개발 DB 적용 시에는 전체 스키마 push가 아니라 아래 단일 SQL만 적용하는 방식이 안전하다.

```bash
psql "$DATABASE_URL" -f db/migrations/20260430_create_image_reference_uploads.sql
```

Windows PowerShell에서 현재 `.env`의 `DATABASE_URL`을 사용해 적용할 경우에는 별도 환경 로더가 필요하다. 운영 DB와 개발 DB URL이 섞일 수 있으므로, 적용 전에는 반드시 대상 DB URL을 눈으로 확인한다.

적용 후 확인 SQL은 다음과 같다.

```sql
SELECT to_regclass('public.image_reference_uploads') AS table_name;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'image_reference_uploads'
ORDER BY indexname;
```

운영 Railway DB 적용은 별도 승인 후 진행한다.

이번 마이그레이션 준비 검증 결과는 다음과 같다.

- `git diff --check`
  - 통과
- `npm run build`
  - 최초 실행은 샌드박스 내 esbuild 프로세스 실행이 `spawn EPERM`으로 막혀 실패
  - 동일 명령을 승인된 샌드박스 외부 실행으로 재시도하여 통과
- DB 적용
  - 이후 사용자 승인에 따라 운영 Railway DB에 단일 마이그레이션을 적용했다.
  - 적용 전 `public.images` 존재와 `public.image_reference_uploads` 미존재를 확인했다.
  - 적용 후 `public.image_reference_uploads` 테이블 생성을 확인했다.
  - `storage_path` unique index 포함 필수 인덱스 생성을 확인했다.

## 10. 운영 DB 단일 마이그레이션 적용 기록

사용자 승인 문구: `!!승인!! 운영 DB에 단일 마이그레이션 적용해`

적용 명령:

```bash
node scripts/migrations/apply-image-reference-uploads-migration.cjs
```

적용 결과:

- 대상 DB명: `railway`
- 사전 확인:
  - `public.images`: 존재
  - `public.image_reference_uploads`: 미존재
- 적용 후 확인:
  - `public.image_reference_uploads`: 존재
  - `image_reference_uploads_pkey`: 존재
  - `image_reference_uploads_user_id_idx`: 존재
  - `image_reference_uploads_generated_image_id_idx`: 존재
  - `image_reference_uploads_storage_path_idx`: 존재, UNIQUE
  - `image_reference_uploads_status_idx`: 존재
  - `image_reference_uploads_created_at_idx`: 존재

직접 DB에 적용한 것은 신규 테이블과 인덱스 생성뿐이며, 기존 `images` 데이터는 수정하지 않았다.
