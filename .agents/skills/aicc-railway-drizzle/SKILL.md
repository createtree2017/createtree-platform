---
name: aicc-railway-drizzle
description: "CT_aicc Railway PostgreSQL and Drizzle ORM safety skill. Use for schema changes, migrations, Railway deployment variables, production DB safety, pg driver scripts, Drizzle push decisions, DB troubleshooting, and data integrity fixes."
---

# AICC Railway Drizzle 스킬

## 핵심 기준

운영 DB는 Railway PostgreSQL이다. DB 스키마, migration, 운영 데이터 수정은 서비스 장애로 이어질 수 있으므로 대상 DB와 적용 범위를 명확히 확인한다.

## 작업 전 확인

- DB 스키마 파일, migration 폴더, 관련 route/service, 최신 DB 관련 인수인계 문서를 확인한다.
- 운영 DB 직접 수정, migration 적용, Postgres MCP 상시 활성화는 운영 정책 변경에 준해 사용자 확인이 필요하다.
- `.env`, API 키, 서비스 계정 파일은 읽거나 노출하지 않는다.

## 구현 규칙

- 파일 기반 `tsx` 스크립트 패턴을 우선하고, 인라인 `tsx -e`는 사용하지 않는다.
- schema 변경 시 서버/공유 타입/API 응답/프론트 사용처까지 같이 확인한다.
- 데이터 삭제, 대량 수정, production migration은 별도 확인 없이 실행하지 않는다.
- Railway 변수, build/start command, 서비스 분리 기준 변경은 사용자 확인 후 반영한다.

## 검증

- 가능한 범위에서 타입체크, migration dry review, 관련 API 검증을 수행한다.
- 스킬이나 자동화 규칙 변경 후 `npm run skills:sync`와 `npm run skills:check`를 실행한다.
