/**
 * API Rate Limiting 미들웨어
 * 분당 100회 요청 제한으로 API 남용 방지
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
  firstRequest: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

class RateLimiter {
  private requests = new Map<string, RateLimitRecord>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    
    // 5분마다 만료된 기록 정리
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const clientId = this.getClientId(req);
      const now = Date.now();
      
      // 현재 클라이언트 기록 조회
      let record = this.requests.get(clientId);
      
      // 새로운 윈도우이거나 첫 요청인 경우
      if (!record || now > record.resetTime) {
        record = {
          count: 1,
          resetTime: now + this.config.windowMs,
          firstRequest: now
        };
        this.requests.set(clientId, record);
        this.setHeaders(res, record);
        return next();
      }
      
      // 요청 수 증가
      record.count++;
      
      // 한도 초과 확인
      if (record.count > this.config.maxRequests) {
        this.setHeaders(res, record);
        return res.status(429).json({
          error: 'Too Many Requests',
          message: this.config.message,
          retryAfter: Math.ceil((record.resetTime - now) / 1000),
          limit: this.config.maxRequests,
          windowMs: this.config.windowMs
        });
      }
      
      this.setHeaders(res, record);
      next();
    };
  }

  private getClientId(req: Request): string {
    // IP 주소 기반 식별 (프록시 고려)
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? 
      (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]) :
      req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    
    // 인증된 사용자는 사용자 ID 포함
    const userId = (req as any).user?.id;
    
    return userId ? `user:${userId}` : `ip:${ip}`;
  }

  private setHeaders(res: Response, record: RateLimitRecord): void {
    res.setHeader('X-RateLimit-Limit', this.config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));
    res.setHeader('X-RateLimit-Window', this.config.windowMs);
  }

  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.requests.entries());
    for (const [clientId, record] of entries) {
      if (now > record.resetTime) {
        this.requests.delete(clientId);
      }
    }
  }

  getStats(): { totalClients: number; activeRequests: number } {
    const now = Date.now();
    let activeRequests = 0;
    
    const records = Array.from(this.requests.values());
    for (const record of records) {
      if (now <= record.resetTime) {
        activeRequests += record.count;
      }
    }
    
    return {
      totalClients: this.requests.size,
      activeRequests
    };
  }
}

// 기본 API Rate Limiter (분당 100회)
export const apiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1분
  maxRequests: 100,
  message: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
});

// 인증 API Rate Limiter (분당 10회)
export const authRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1분
  maxRequests: 10,
  message: '로그인 시도가 너무 많습니다. 1분 후 다시 시도해주세요.'
});

// 이미지 생성 API Rate Limiter (분당 5회)
export const imageGenerationRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1분
  maxRequests: 5,
  message: '이미지 생성 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
});

// 음악 생성 API Rate Limiter (분당 3회)
export const musicGenerationRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1분
  maxRequests: 3,
  message: '음악 생성 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
});