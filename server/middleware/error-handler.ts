import type { Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";

/**
 * 공통 에러 핸들링 미들웨어
 * 모든 라우트에서 발생하는 에러를 통합 처리
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 기본 에러 정보 설정
  const status = err.statusCode || err.status || 500;
  const message = err.message || "서버 내부 오류";
  
  // Sentry에 에러 전송 (자동으로 스택 트레이스 포함)
  Sentry.captureException(err, {
    tags: {
      status,
      path: req.path,
      method: req.method,
    },
    user: {
      id: (req as any).user?.id?.toString() || 'anonymous',
      email: (req as any).user?.email || undefined,
      memberType: (req as any).user?.memberType || undefined,
    },
  });
  
  // 에러 로깅 (콘솔에도 상세하게 출력)
  console.error(`[ERROR ${status}] ${req.method} ${req.path}:`, {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    user: (req as any).user?.id || 'anonymous',
    timestamp: new Date().toISOString()
  });

  // 개발 환경에서만 스택 트레이스 포함
  const errorResponse: any = {
    success: false,
    message
  };

  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  return res.status(status).json(errorResponse);
}

/**
 * 404 에러 핸들러
 */
export function notFoundHandler(req: Request, res: Response) {
  return res.status(404).json({
    success: false,
    message: "요청한 리소스를 찾을 수 없습니다"
  });
}

/**
 * 비동기 함수 래퍼 - try-catch를 자동으로 처리
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}