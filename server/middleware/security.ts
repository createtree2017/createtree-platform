/**
 * 프로덕션 보안 미들웨어
 * HTTPS 강제, 보안 헤더 설정, CORS 정책 강화
 */

import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

/**
 * HTTPS 강제 리디렉션 미들웨어
 */
export function forceHTTPS() {
  return (req: Request, res: Response, next: NextFunction) => {
    // 프로덕션 환경에서만 HTTPS 강제
    if (process.env.NODE_ENV === 'production' && !req.secure && req.get('X-Forwarded-Proto') !== 'https') {
      return res.redirect(301, `https://${req.get('Host')}${req.url}`);
    }
    next();
  };
}

/**
 * 보안 헤더 설정
 */
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdn.jsdelivr.net",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdn.jsdelivr.net",
        ],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        connectSrc: [
          "'self'",
          "https://api.openai.com",
          "https://api.topmediai.com",
          "https://storage.googleapis.com",
          "https://createtree-upload.storage.googleapis.com",
          "https://fonts.googleapis.com",
          "https://fonts.gstatic.com",
          "https://cdn.jsdelivr.net",
          "https://*.firebaseio.com",
          "https://*.googleapis.com",
          "https://*.sentry.io",
          "wss://*.firebaseio.com",
        ],
        mediaSrc: ["'self'", "https:", "blob:"],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: []
      }
    },
    hsts: {
      maxAge: 31536000, // 1년
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    frameguard: {
      action: process.env.NODE_ENV === 'production' ? 'deny' : 'sameorigin'
    },
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  });
}

/**
 * 프로덕션 CORS 정책
 */
export function productionCORS() {
  const allowedOrigins = [
    process.env.PRODUCTION_DOMAIN || 'https://ai-culture-center.replit.app',
    'https://createtree-platform-production.up.railway.app',
    'https://localhost:3000',
    `https://localhost:${process.env.PORT || 5000}`
  ];

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    // 프로덕션에서는 허용된 도메인만 접근 가능
    if (process.env.NODE_ENV === 'production') {
      if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    } else {
      // 개발 환경에서는 모든 origin 허용
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset'
    );

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    next();
  };
}

/**
 * API 키 검증 미들웨어
 */
export function validateApiKeys() {
  return (req: Request, res: Response, next: NextFunction) => {
    const missingKeys: string[] = [];

    // 필수 API 키 확인
    if (!process.env.TOPMEDIA_API_KEY) {
      missingKeys.push('TOPMEDIA_API_KEY');
    }

    if (!process.env.JWT_SECRET) {
      missingKeys.push('JWT_SECRET');
    }

    if (!process.env.DATABASE_URL) {
      missingKeys.push('DATABASE_URL');
    }

    if (missingKeys.length > 0) {
      console.error('❌ 누락된 환경 변수:', missingKeys);
      return res.status(500).json({
        error: 'Server Configuration Error',
        message: '서버 설정이 완료되지 않았습니다. 관리자에게 문의하세요.',
        missingKeys: process.env.NODE_ENV === 'development' ? missingKeys : undefined
      });
    }

    next();
  };
}

/**
 * 요청 로깅 미들웨어 (보안 이벤트 추적)
 */
export function securityLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    // 의심스러운 요청 패턴 감지
    const suspiciousPatterns = [
      /\/admin(?!\/api)/,  // admin 경로 직접 접근
      /\.\./,              // Path traversal 시도
      /<script/i,          // XSS 시도
      /union.*select/i,    // SQL injection 시도
      /eval\(/,            // Code injection 시도
    ];

    const isSuspicious = suspiciousPatterns.some(pattern =>
      pattern.test(req.url) || pattern.test(JSON.stringify(req.body))
    );

    if (isSuspicious) {
      console.warn(`🚨 의심스러운 요청 감지:`, {
        ip: clientIp,
        method: req.method,
        url: req.url,
        userAgent,
        body: req.body,
        timestamp: new Date().toISOString()
      });
    }

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      // 실패한 인증 시도 로깅
      if (req.path.includes('/auth/') && res.statusCode >= 400) {
        console.warn(`🔐 인증 실패:`, {
          ip: clientIp,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration,
          userAgent
        });
      }

      // 느린 요청 로깅 (5초 이상)
      if (duration > 5000) {
        console.warn(`⏰ 느린 요청:`, {
          method: req.method,
          path: req.path,
          duration,
          status: res.statusCode
        });
      }
    });

    next();
  };
}

/**
 * IP 화이트리스트/블랙리스트 미들웨어
 */
export function ipFilter() {
  const blockedIPs = new Set<string>([
    // 알려진 악성 IP들을 여기에 추가
  ]);

  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || req.socket.remoteAddress || '';

    if (blockedIPs.has(clientIp as string)) {
      console.warn(`🚫 차단된 IP 접근 시도: ${clientIp}`);
      return res.status(403).json({
        error: 'Access Denied',
        message: '접근이 거부되었습니다.'
      });
    }

    next();
  };
}