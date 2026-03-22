---
description: Neon DB → Railway PostgreSQL 데이터베이스 이관 워크플로우
---

# Neon DB → Railway PostgreSQL 이관 워크플로우

> **명령어**: `/migrate-db-to-railway`
> **선행 조건**: Railway 대시보드에서 PostgreSQL 서비스가 이미 추가되어 있어야 함
> **참고 사례**: createTree 메인 사이트(createAI_v1) 이관 완료 (2026.03.22)

---

## 🚨 이관 전 필수 확인사항

1. Railway 대시보드에서 **PostgreSQL 서비스 추가 완료** 여부 확인
2. Railway DB의 **DATABASE_URL** 확보 (Variables 탭에서 복사)
3. 현재 Neon DB에 접속 가능한 상태인지 확인
4. **git status** 깨끗한 상태에서 시작 (작업 전 커밋)

---

## 📋 이관 절차 (총 6단계)

### STEP 1: 현재 DB 구조 파악 (5분)

1. 프로젝트의 DB 연결 파일 찾기:
   ```
   - db/index.ts 또는 db/index.js 확인
   - 현재 사용 중인 드라이버 확인 (@neondatabase/serverless, drizzle-orm/neon-serverless 등)
   ```

2. 스키마 파일 확인:
   ```
   - shared/schema.ts 또는 db/schema.ts 확인
   - 테이블 목록과 구조 파악
   ```

3. .env 파일에서 현재 DATABASE_URL 확인 (Neon URL)

4. package.json에서 DB 관련 패키지 확인:
   - `@neondatabase/serverless` 존재 여부
   - `drizzle-orm`, `drizzle-kit` 버전
   - `ws` (WebSocket) 패키지 존재 여부

### STEP 2: Railway DB에 스키마 Push (5분)

1. `.env` 파일에 Railway DB URL 추가 (기존 Neon URL은 주석으로 백업):
   ```env
   # 기존 Neon (백업용)
   # DATABASE_URL=postgresql://...neon.tech/...
   
   # Railway PostgreSQL
   DATABASE_URL=postgresql://postgres:...@...railway.internal:5432/railway
   RAILWAY_DATABASE_URL=postgresql://postgres:...@...railway.app:5432/railway
   ```
   - `DATABASE_URL`: Railway 내부 연결용 (프로덕션)
   - `RAILWAY_DATABASE_URL`: 외부 연결용 (로컬 개발/스크립트용)
   - **주의**: 로컬에서 스크립트 실행 시에는 외부 URL(`railway.app`)을 사용해야 함

2. drizzle-kit으로 Railway DB에 스키마 Push:
   ```bash
   npx drizzle-kit push --config=./drizzle.config.ts
   ```
   - 이 단계에서 `.env`의 `DATABASE_URL`을 Railway 외부 URL로 임시 변경해야 할 수 있음

### STEP 3: 데이터 마이그레이션 스크립트 작성 및 실행 (15분)

1. `scripts/migrate-to-railway.ts` 파일 생성:

```typescript
/**
 * Neon DB → Railway PostgreSQL 데이터 마이그레이션 스크립트
 * 
 * 원칙:
 * 1. 소스(Neon)는 읽기만, 절대 수정하지 않음
 * 2. Railway DB의 실제 컬럼과 Neon DB 컬럼의 교집합만 복사
 * 3. 시퀀스(auto-increment) 복원 필수
 */
import 'dotenv/config';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

// ⚠️ 환경변수에서 소스(Neon)와 타겟(Railway) URL을 명확히 구분
const SOURCE_URL = process.env.NEON_DATABASE_URL;   // Neon (소스)
const TARGET_URL = process.env.RAILWAY_DATABASE_URL; // Railway (타겟)

if (!SOURCE_URL) throw new Error('NEON_DATABASE_URL이 없습니다');
if (!TARGET_URL) throw new Error('RAILWAY_DATABASE_URL이 없습니다');

const sourcePool = new NeonPool({ connectionString: SOURCE_URL });
const targetPool = new PgPool({ connectionString: TARGET_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log('🚀 Neon → Railway 데이터 마이그레이션 시작');
  
  // 1. 소스 DB에서 모든 테이블 목록 가져오기
  const tablesResult = await sourcePool.query(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename
  `);
  const tables = tablesResult.rows.map(r => r.tablename);
  console.log(`📋 발견된 테이블: ${tables.length}개`);
  
  for (const table of tables) {
    try {
      // 2. 소스 테이블 행 수 확인
      const srcCount = await sourcePool.query(`SELECT COUNT(*) as cnt FROM "${table}"`);
      const rowCount = parseInt(srcCount.rows[0].cnt);
      
      if (rowCount === 0) {
        console.log(`⏭️  ${table}: 0행 — 스킵`);
        continue;
      }
      
      // 3. 타겟 테이블 컬럼 확인 (교집합 복사)
      const targetCols = await targetPool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
      `, [table]);
      const targetColNames = new Set(targetCols.rows.map(r => r.column_name));
      
      // 4. 소스 테이블 컬럼 확인
      const sourceCols = await sourcePool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
      `, [table]);
      
      // 5. 교집합 컬럼만 선택
      const commonCols = sourceCols.rows
        .map(r => r.column_name)
        .filter(c => targetColNames.has(c));
      
      if (commonCols.length === 0) {
        console.log(`⚠️  ${table}: 공통 컬럼 없음 — 스킵`);
        continue;
      }
      
      // 6. 타겟 테이블 비우기
      await targetPool.query(`TRUNCATE TABLE "${table}" CASCADE`);
      
      // 7. 데이터 복사 (배치 처리)
      const colList = commonCols.map(c => `"${c}"`).join(', ');
      const data = await sourcePool.query(`SELECT ${colList} FROM "${table}"`);
      
      let inserted = 0;
      for (const row of data.rows) {
        try {
          const values = commonCols.map((_, i) => `$${i + 1}`).join(', ');
          const params = commonCols.map(c => row[c]);
          await targetPool.query(
            `INSERT INTO "${table}" (${colList}) VALUES (${values})`,
            params
          );
          inserted++;
        } catch (e) {
          // NaN, 무효 데이터 등은 스킵
          console.log(`   ⚠️ ${table} 행 스킵: ${(e as any).message.substring(0, 80)}`);
        }
      }
      
      console.log(`✅ ${table}: ${inserted}/${rowCount}행 복사 완료`);
      
      // 8. 시퀀스 복원 (id 컬럼이 있는 경우)
      if (commonCols.includes('id')) {
        try {
          await targetPool.query(`
            SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), 
            COALESCE((SELECT MAX(id) FROM "${table}"), 1))
          `);
        } catch { /* 시퀀스 없는 테이블은 무시 */ }
      }
    } catch (e) {
      console.error(`❌ ${table} 실패: ${(e as any).message}`);
    }
  }
  
  console.log('\n🎉 마이그레이션 완료!');
  await sourcePool.end();
  await targetPool.end();
  process.exit(0);
}

main();
```

2. `.env`에 두 DB URL 모두 설정:
   ```env
   NEON_DATABASE_URL=postgresql://...neon.tech/...   (기존 Neon URL)
   RAILWAY_DATABASE_URL=postgresql://...railway.app/... (Railway 외부 URL)
   ```

3. 스크립트 실행:
   ```bash
   npx tsx scripts/migrate-to-railway.ts
   ```

4. 결과 확인: 모든 테이블에 ✅ 표시되는지 확인

### STEP 4: 드라이버 교체 (5분)

1. `db/index.ts` (또는 해당 DB 연결 파일) 수정:

   **변경 전 (Neon)**:
   ```typescript
   import { Pool, neonConfig } from '@neondatabase/serverless';
   import { drizzle } from 'drizzle-orm/neon-serverless';
   import ws from 'ws';
   neonConfig.webSocketConstructor = ws;
   ```

   **변경 후 (Railway/표준 pg)**:
   ```typescript
   import { Pool } from 'pg';
   import { drizzle } from 'drizzle-orm/node-postgres';
   ```

2. Pool 설정 변경:
   ```typescript
   export const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     max: 20,
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 5000,
     ssl: process.env.DATABASE_URL?.includes('railway.internal')
       ? false
       : { rejectUnauthorized: false },
   });
   ```

3. `pg` 패키지 설치 (없으면):
   ```bash
   npm install pg @types/pg
   ```

### STEP 5: 로컬 테스트 (5분)

1. `.env`의 `DATABASE_URL`을 Railway 외부 URL로 설정
2. 서버 재시작:
   ```bash
   npm run dev
   ```
3. 브라우저에서 주요 페이지 확인:
   - 메인 페이지 데이터 로딩
   - 로그인/로그아웃
   - 주요 기능 동작

### STEP 6: 배포 및 정리 (5분)

1. git 커밋 & 푸시:
   ```bash
   git add -A
   git commit -m "feat: migrate DB from Neon to Railway PostgreSQL"
   git push origin develop
   ```

2. develop → main PR 생성 & 머지 (프로덕션 배포)

3. 프로덕션 Railway 환경변수 확인:
   - `DATABASE_URL`이 Railway 내부 URL(`railway.internal`)을 가리키는지 확인

4. 정리 (선택):
   - `scripts/migrate-to-railway.ts` 삭제
   - `package.json`에서 `@neondatabase/serverless`, `ws` 제거
   - `npm install` 재실행

---

## ⚠️ 주의사항

1. **데이터 유실 방지**: 마이그레이션 전후 반드시 행 수 비교
2. **Neon URL 백업**: `.env`에 주석으로 기존 URL 보관 (롤백용)
3. **시퀀스 복원 필수**: auto-increment ID가 기존 max값 이상으로 설정되어야 함
4. **SSL 설정**: Railway 내부(`railway.internal`)는 SSL 불필요, 외부(`railway.app`)는 SSL 필요
5. **환경변수 구분**: 로컬 개발 시 외부 URL, 프로덕션 시 내부 URL 사용

---

## 📝 체크리스트

- [ ] Railway PostgreSQL 서비스 추가 완료
- [ ] Railway DATABASE_URL 확보
- [ ] 기존 Neon URL 백업
- [ ] drizzle-kit push로 스키마 생성
- [ ] 마이그레이션 스크립트 실행 및 행 수 확인
- [ ] db/index.ts 드라이버 교체
- [ ] pg 패키지 설치
- [ ] 로컬 테스트 통과
- [ ] git 커밋 & 푸시
- [ ] 프로덕션 배포 & 확인
- [ ] Neon 유료 플랜 해지
- [ ] 레거시 코드/패키지 정리
