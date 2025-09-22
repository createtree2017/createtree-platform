/**
 * TopMediai API 재시도 로직 및 안정성 강화
 * Exponential Backoff 알고리즘으로 API 장애 시 자동 복구
 */

interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  retryAfter?: number;
}

export class TopMediaRetryManager {
  private static instance: TopMediaRetryManager;
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly circuitBreakerThreshold = 5;
  private readonly circuitBreakerTimeout = 5 * 60 * 1000; // 5분
  
  private constructor() {}
  
  static getInstance(): TopMediaRetryManager {
    if (!TopMediaRetryManager.instance) {
      TopMediaRetryManager.instance = new TopMediaRetryManager();
    }
    return TopMediaRetryManager.instance;
  }
  
  /**
   * 재시도 로직이 적용된 API 호출
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const config: RetryOptions = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      ...options
    };
    
    // Circuit Breaker 확인
    if (this.isCircuitOpen()) {
      throw new Error('TopMediai API 서비스가 일시적으로 중단되었습니다. 잠시 후 다시 시도해주세요.');
    }
    
    let lastError: Error;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // 성공 시 실패 카운터 리셋
        this.resetFailureCount();
        return result;
        
      } catch (error) {
        lastError = error as Error;
        this.recordFailure();
        
        // 마지막 시도인 경우 에러 던지기
        if (attempt === config.maxRetries) {
          break;
        }
        
        // 특정 에러는 재시도하지 않음
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        
        // 지연 시간 계산 (Exponential Backoff)
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
          config.maxDelay
        );
        
        // Jitter 추가 (±25% 랜덤)
        const jitteredDelay = delay * (0.75 + Math.random() * 0.5);
        
        console.log(`TopMediai API 재시도 ${attempt + 1}/${config.maxRetries} - ${Math.round(jitteredDelay)}ms 후 재시도`);
        await this.sleep(jitteredDelay);
      }
    }
    
    throw lastError!;
  }
  
  /**
   * Circuit Breaker 상태 확인
   */
  private isCircuitOpen(): boolean {
    return this.failureCount >= this.circuitBreakerThreshold &&
           (Date.now() - this.lastFailureTime) < this.circuitBreakerTimeout;
  }
  
  /**
   * 실패 기록
   */
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
  }
  
  /**
   * 실패 카운터 리셋
   */
  private resetFailureCount(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
  
  /**
   * 재시도하지 않을 에러 판별
   */
  private isNonRetryableError(error: any): boolean {
    // 인증 오류 (401, 403)
    if (error.status === 401 || error.status === 403) {
      return true;
    }
    
    // 잘못된 요청 (400)
    if (error.status === 400) {
      return true;
    }
    
    // 요청 크기 초과 (413)
    if (error.status === 413) {
      return true;
    }
    
    return false;
  }
  
  /**
   * 지연 함수
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * API 상태 확인
   */
  async checkApiHealth(): Promise<boolean> {
    try {
      const response = await fetch('https://api.topmediai.com/v1/health', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.TOPMEDIA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 서비스 상태 가져오기
   */
  getServiceStatus(): {
    isHealthy: boolean;
    failureCount: number;
    isCircuitOpen: boolean;
    lastFailureTime: number;
  } {
    return {
      isHealthy: this.failureCount === 0,
      failureCount: this.failureCount,
      isCircuitOpen: this.isCircuitOpen(),
      lastFailureTime: this.lastFailureTime
    };
  }
}