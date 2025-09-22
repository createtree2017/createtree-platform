/**
 * JWT 토큰 캐싱 시스템 - 성능 최적화
 * 토큰 검증 결과를 메모리에 캐시하여 데이터베이스 조회 최소화
 */

interface CachedUser {
  id: number;
  userId: number;
  email: string | null;
  username: string;
  fullName: string | null;
  memberType: string | null;
  hospitalId: number | null;
  cachedAt: number;
}

interface TokenCache {
  [token: string]: CachedUser;
}

class JWTCache {
  private cache: TokenCache = {};
  private readonly TTL = 5 * 60 * 1000; // 5분 캐시
  private readonly MAX_CACHE_SIZE = 1000; // 최대 1000개 토큰 캐시

  /**
   * 캐시에서 사용자 정보 조회
   */
  get(token: string): CachedUser | null {
    const cached = this.cache[token];
    
    if (!cached) {
      return null;
    }
    
    // TTL 확인
    if (Date.now() - cached.cachedAt > this.TTL) {
      delete this.cache[token];
      return null;
    }
    
    return cached;
  }
  
  /**
   * 캐시에 사용자 정보 저장
   */
  set(token: string, user: CachedUser): void {
    // 캐시 크기 제한
    if (Object.keys(this.cache).length >= this.MAX_CACHE_SIZE) {
      this.cleanup();
    }
    
    this.cache[token] = {
      ...user,
      cachedAt: Date.now()
    };
  }
  
  /**
   * 특정 토큰 삭제
   */
  delete(token: string): void {
    delete this.cache[token];
  }
  
  /**
   * 만료된 캐시 항목 정리
   */
  private cleanup(): void {
    const now = Date.now();
    const tokensToDelete: string[] = [];
    
    for (const [token, cached] of Object.entries(this.cache)) {
      if (now - cached.cachedAt > this.TTL) {
        tokensToDelete.push(token);
      }
    }
    
    tokensToDelete.forEach(token => delete this.cache[token]);
    
    // 여전히 크기가 크면 가장 오래된 항목들 삭제
    if (Object.keys(this.cache).length >= this.MAX_CACHE_SIZE) {
      const sortedEntries = Object.entries(this.cache)
        .sort(([,a], [,b]) => a.cachedAt - b.cachedAt);
      
      const toDelete = sortedEntries.slice(0, this.MAX_CACHE_SIZE / 2);
      toDelete.forEach(([token]) => delete this.cache[token]);
    }
  }
  
  /**
   * 전체 캐시 초기화
   */
  clear(): void {
    this.cache = {};
  }
  
  /**
   * 캐시 통계
   */
  getStats(): { size: number; ttl: number; maxSize: number } {
    return {
      size: Object.keys(this.cache).length,
      ttl: this.TTL,
      maxSize: this.MAX_CACHE_SIZE
    };
  }
}

// 싱글톤 인스턴스
export const jwtCache = new JWTCache();

// 정기적인 캐시 정리 (5분마다)
setInterval(() => {
  jwtCache['cleanup']();
}, 5 * 60 * 1000);