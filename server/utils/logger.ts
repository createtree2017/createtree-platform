import winston from 'winston';
import path from 'path';
import fs from 'fs';

// 로그 디렉토리 생성
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * 로그 레벨
 * error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6
 */
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

/**
 * 환경에 따른 로그 레벨
 */
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

/**
 * 로그 색상
 */
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

/**
 * 로그 포맷
 */
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

/**
 * 콘솔 출력 포맷 (개발 환경)
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${
      info.stack ? `\n${info.stack}` : ''
    }`
  )
);

/**
 * Transports (로그 출력 대상)
 */
const transports: any[] = [
  // 에러 로그 (error.log)
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // 전체 로그 (combined.log)
  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // HTTP 로그 (http.log)
  new winston.transports.File({
    filename: path.join(logDir, 'http.log'),
    level: 'http',
    maxsize: 5242880,
    maxFiles: 3,
  }),
];

// 개발 환경에서는 콘솔 출력 추가
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

/**
 * Winston Logger 인스턴스
 */
export const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  exitOnError: false,
});

/**
 * 스트림 (Morgan 연동용)
 */
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

/**
 * 헬퍼 함수들
 */

// 사용자 액션 로깅
export function logUserAction(userId: number, action: string, details?: any) {
  logger.info('User action', {
    userId,
    action,
    ...details,
  });
}

// API 요청 로깅
export function logApiRequest(
  method: string,
  path: string,
  userId?: number,
  statusCode?: number,
  duration?: number
) {
  logger.http('API request', {
    method,
    path,
    userId,
    statusCode,
    duration,
  });
}

// DB 쿼리 로깅 (개발 환경)
export function logDbQuery(query: string, duration?: number) {
  if (process.env.NODE_ENV === 'development') {
    logger.debug('DB query', {
      query: query.substring(0, 200),
      duration,
    });
  }
}

// 외부 API 호출 로깅
export function logExternalApi(
  service: string,
  endpoint: string,
  method: string,
  statusCode?: number,
  duration?: number
) {
  logger.info('External API call', {
    service,
    endpoint,
    method,
    statusCode,
    duration,
  });
}

// 파일 업로드 로깅
export function logFileUpload(
  userId: number,
  filename: string,
  size: number,
  mimetype: string
) {
  logger.info('File upload', {
    userId,
    filename,
    size,
    mimetype,
  });
}

// 에러 로깅 (상세)
export function logError(
  error: Error,
  context?: string,
  userId?: number,
  additionalInfo?: any
) {
  logger.error('Application error', {
    message: error.message,
    stack: error.stack,
    context,
    userId,
    ...additionalInfo,
  });
}

// 보안 이벤트 로깅
export function logSecurityEvent(
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details?: any
) {
  logger.warn('Security event', {
    event,
    severity,
    ...details,
  });
}

// 레거시 함수 (하위 호환성 유지)
export function logDebug(message: string, ...args: any[]): void {
  logger.debug(message, ...args);
}

export function logInfo(message: string, ...args: any[]): void {
  logger.info(message, ...args);
}

export function logWarn(message: string, ...args: any[]): void {
  logger.warn(message, ...args);
}

/**
 * 프로덕션 환경에서 console.log 대체
 */
if (process.env.NODE_ENV === 'production') {
  console.log = (...args) => logger.info(args.join(' '));
  console.error = (...args) => logger.error(args.join(' '));
  console.warn = (...args) => logger.warn(args.join(' '));
  console.debug = (...args) => logger.debug(args.join(' '));
}