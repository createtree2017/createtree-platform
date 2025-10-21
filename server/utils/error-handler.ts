import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger';

/**
 * 커스텀 에러 클래스
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true,
    public details?: any
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 에러 핸들러 (Express 미들웨어)
 */
export function errorHandler(
  error: Error | AppError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 이미 응답이 시작된 경우
  if (res.headersSent) {
    return next(error);
  }

  // Zod 검증 에러
  if (error instanceof ZodError) {
    logger.warn('Validation error', {
      path: req.path,
      errors: error.errors,
    });
    
    return res.status(400).json({
      success: false,
      error: '입력값 검증에 실패했습니다',
      details: error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // 커스텀 AppError
  if (error instanceof AppError) {
    logger.error('Application error', {
      statusCode: error.statusCode,
      message: error.message,
      path: req.path,
      details: error.details,
    });
    
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      ...(error.details && { details: error.details }),
    });
  }

  // 기타 예상치 못한 에러
  logger.error('Unexpected error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
  });
  
  return res.status(500).json({
    success: false,
    error: '서버 오류가 발생했습니다',
    ...(process.env.NODE_ENV === 'development' && {
      details: {
        message: error.message,
        stack: error.stack,
      },
    }),
  });
}

/**
 * 404 핸들러
 */
export function notFoundHandler(req: Request, res: Response) {
  logger.warn('Route not found', { path: req.path });
  
  res.status(404).json({
    success: false,
    error: '요청한 리소스를 찾을 수 없습니다',
    path: req.path,
  });
}

/**
 * 에러 래퍼 헬퍼 (try-catch 제거)
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 에러 처리 헬퍼 (라우터 내부용)
 */
export function handleError(error: unknown, res: Response, context?: string): void {
  if (res.headersSent) {
    return;
  }

  logger.error(`Error in ${context || 'unknown context'}`, { error });

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: '입력값 검증에 실패했습니다',
      details: error.errors,
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      ...(error.details && { details: error.details }),
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: '서버 오류가 발생했습니다',
  });
}

/**
 * 특정 상황별 에러 생성 헬퍼
 */
export const createError = {
  unauthorized: (message = '인증이 필요합니다') => 
    new AppError(401, message),
  
  forbidden: (message = '권한이 없습니다') => 
    new AppError(403, message),
  
  notFound: (message = '리소스를 찾을 수 없습니다') => 
    new AppError(404, message),
  
  badRequest: (message = '잘못된 요청입니다', details?: any) => 
    new AppError(400, message, true, details),
  
  conflict: (message = '이미 존재하는 리소스입니다') => 
    new AppError(409, message),
  
  tooManyRequests: (message = '요청 한도를 초과했습니다') => 
    new AppError(429, message),
  
  internal: (message = '서버 오류가 발생했습니다') => 
    new AppError(500, message, false),
};
