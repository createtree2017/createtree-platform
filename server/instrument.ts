import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    
    // DEBUG 모드 활성화 (네트워크 전송 로그 확인)
    debug: true,
    
    // 성능 모니터링
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    
    // 프로파일링
    profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    integrations: [
      nodeProfilingIntegration(),
    ],
    
    // 에러 필터링 (개발 환경에서도 모든 에러 전송)
    beforeSend(event, hint) {
      // 개발 환경에서도 모든 에러 전송
      console.log("📤 [Sentry] 에러 전송 시도:", event.message || event.exception?.values?.[0]?.value);
      console.log("📤 [Sentry] Event ID:", event.event_id);
      console.log("📤 [Sentry] Environment:", event.environment);
      return event;
    },
  });

  console.log("✅ [Sentry] 초기화 완료 - DSN 설정됨");
  console.log(`📊 [Sentry] 환경: ${process.env.NODE_ENV || "development"}`);
} else {
  console.warn("⚠️ [Sentry] SENTRY_DSN 환경변수가 설정되지 않았습니다.");
}
