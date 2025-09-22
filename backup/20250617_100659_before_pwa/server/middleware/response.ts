import type { Request, Response, NextFunction } from "express";

/**
 * 응답 포맷 표준화 인터페이스
 */
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 응답 헬퍼 함수들을 Response 객체에 추가
 */
export function responseFormatter(req: Request, res: Response, next: NextFunction) {
  // 성공 응답 헬퍼
  res.success = function<T>(data: T, message?: string, pagination?: any) {
    const response: ApiResponse<T> = {
      success: true,
      data
    };

    if (message) {
      response.message = message;
    }

    if (pagination) {
      response.pagination = pagination;
    }

    return this.json(response);
  };

  // 에러 응답 헬퍼
  res.error = function(status: number, message: string) {
    const response: ApiResponse = {
      success: false,
      message
    };

    return this.status(status).json(response);
  };

  // 페이지네이션 응답 헬퍼
  res.paginated = function<T>(data: T[], pagination: any, total: number) {
    const { page, limit } = pagination;
    const totalPages = Math.ceil(total / limit);

    const response: ApiResponse<T[]> = {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };

    return this.json(response);
  };

  next();
}

/**
 * 요청 로깅 미들웨어
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const method = req.method;
  const url = req.originalUrl;
  const userAgent = req.get('User-Agent') || 'unknown';
  const ip = req.ip || req.connection.remoteAddress;
  const userId = (req as any).user?.id || 'anonymous';

  console.log(`[${new Date().toISOString()}] ${method} ${url} - User: ${userId}, IP: ${ip}`);

  // 응답 완료 시 로깅
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    console.log(`[${new Date().toISOString()}] ${method} ${url} ${status} - ${duration}ms`);
  });

  next();
}

// TypeScript 타입 확장
declare global {
  namespace Express {
    interface Response {
      success<T>(data: T, message?: string, pagination?: any): Response;
      error(status: number, message: string): Response;
      paginated<T>(data: T[], pagination: any, total: number): Response;
    }
  }
}