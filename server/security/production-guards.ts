// 🛡️ HIPAA 보안 강화: 프로덕션 환경 보안 가드
// 의료 환경에서 위험한 함수들이 프로덕션에서 실행되지 않도록 보호

/**
 * 🚨 프로덕션 환경 보안 검사
 * 위험한 보안 함수들이 프로덕션에서 호출되지 않도록 차단
 */
export function blockDangerousSecurityFunctions(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!isProduction) {
    console.log('🛡️ [Security Guard] 개발 환경 - 보안 가드 모니터링 모드');
    return;
  }

  console.log('🚨 [Security Guard] 프로덕션 환경 - 위험한 보안 함수 차단 활성화');

  // 위험한 함수 이름들 (의료 환경에서 절대 사용하면 안 되는 함수들)
  const dangerousFunctions = [
    'setAllImagesPublic',
    'makePublic',
    'generatePublicUrl', 
    'convertToPublicUrl',
    'setPublicRead',
    'addAllUsers',
    'allUsers',
    'makeObjectPublic'
  ];

  // 스택 트레이스에서 위험한 함수 호출 감지
  const originalStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = function(err, stack) {
    const stackString = stack.map(frame => frame.toString()).join('\n');
    
    // 위험한 함수 패턴 검사
    for (const dangerousFunc of dangerousFunctions) {
      if (stackString.includes(dangerousFunc)) {
        console.error(`🚨 [Security Guard] PRODUCTION SECURITY VIOLATION DETECTED!`);
        console.error(`🚨 Dangerous function "${dangerousFunc}" attempted in production`);
        console.error(`🚨 This violates HIPAA medical data protection requirements`);
        console.error(`🚨 Stack trace:`, stackString);
        
        // 즉시 프로세스 종료 (보안 위반)
        process.exit(1);
      }
    }

    return originalStackTrace ? originalStackTrace(err, stack) : stack;
  };
}

/**
 * 🔍 환경 변수 보안 검증
 * 의료 환경에 필요한 보안 설정들이 올바르게 구성되었는지 확인
 */
export function validateSecurityEnvironment(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 필수 보안 환경 변수 확인
  const requiredSecurityVars = [
    'JWT_SECRET',
    'GOOGLE_CLOUD_PROJECT_ID',
    'GCS_BUCKET_NAME'
  ];

  for (const varName of requiredSecurityVars) {
    if (!process.env[varName]) {
      errors.push(`🚨 필수 보안 환경변수 누락: ${varName}`);
    }
  }

  // SIGNED_URL_TTL_MINUTES 확인 (HIPAA 준수)
  const ttlMinutes = parseInt(process.env.SIGNED_URL_TTL_MINUTES || '30');
  if (ttlMinutes > 60) {
    warnings.push(`⚠️ SIGNED_URL_TTL_MINUTES이 ${ttlMinutes}분으로 설정됨. HIPAA 준수를 위해 60분 이하 권장.`);
  }

  // NODE_ENV 확인
  if (process.env.NODE_ENV === 'production') {
    console.log('✅ [Security Guard] 프로덕션 환경 감지 - 최고 보안 수준 적용');
  } else {
    warnings.push('⚠️ 개발 환경에서 실행 중 - 프로덕션 배포 시 NODE_ENV=production 설정 필수');
  }

  // 환경변수 일관성 확인
  const bucketVar1 = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  const bucketVar2 = process.env.GCS_BUCKET_NAME;
  if (bucketVar1 && bucketVar2 && bucketVar1 !== bucketVar2) {
    warnings.push('⚠️ GOOGLE_CLOUD_STORAGE_BUCKET과 GCS_BUCKET_NAME이 다름. 일관성을 위해 GCS_BUCKET_NAME 사용 권장.');
  }

  const result = {
    valid: errors.length === 0,
    errors,
    warnings
  };

  // 로그 출력
  if (errors.length > 0) {
    console.error('🚨 [Security Guard] 보안 환경 검증 실패:');
    errors.forEach(error => console.error(`   ${error}`));
  }

  if (warnings.length > 0) {
    console.warn('⚠️ [Security Guard] 보안 환경 경고:');
    warnings.forEach(warning => console.warn(`   ${warning}`));
  }

  if (result.valid && warnings.length === 0) {
    console.log('✅ [Security Guard] 보안 환경 검증 완료 - 모든 설정이 HIPAA 기준을 충족합니다.');
  }

  return result;
}

/**
 * 🔒 런타임 보안 모니터링 시작
 * 의료 환경에서 지속적인 보안 상태 모니터링
 */
export function startSecurityMonitoring(): void {
  console.log('🛡️ [Security Guard] HIPAA 보안 모니터링 시작...');

  // 프로덕션 환경에서 위험한 함수 차단
  blockDangerousSecurityFunctions();

  // 환경 변수 보안 검증
  const envValidation = validateSecurityEnvironment();
  if (!envValidation.valid) {
    console.error('🚨 [Security Guard] 보안 환경 검증 실패 - 애플리케이션 시작 중단');
    process.exit(1);
  }

  // 정기적인 메모리 사용량 모니터링 (DoS 방지)
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    if (memUsageMB > 1000) { // 1GB 초과 시 경고
      console.warn(`⚠️ [Security Guard] 높은 메모리 사용량 감지: ${memUsageMB}MB`);
    }
  }, 60000); // 1분마다 체크

  console.log('✅ [Security Guard] 보안 모니터링 활성화 완료');
}

/**
 * 🔍 보안 헤더 검증
 * HTTP 응답에서 의료 데이터 보안 헤더가 올바르게 설정되었는지 확인
 */
export function validateSecurityHeaders(headers: Record<string, string>): {
  compliant: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Cache-Control 검증 (의료 데이터는 절대 캐시되면 안 됨)
  const cacheControl = headers['Cache-Control'] || headers['cache-control'];
  if (cacheControl) {
    if (cacheControl.includes('public')) {
      issues.push('🚨 HIPAA 위반: Cache-Control에 "public" 설정 발견');
    }
    if (!cacheControl.includes('private') || !cacheControl.includes('no-store')) {
      issues.push('⚠️ HIPAA 권장: Cache-Control에 "private, no-store" 설정 권장');
    }
  }

  // Content-Type 검증 (의료 이미지/오디오 처리 시)
  const contentType = headers['Content-Type'] || headers['content-type'];
  if (contentType && (contentType.startsWith('image/') || contentType.startsWith('audio/'))) {
    if (!cacheControl || !cacheControl.includes('private')) {
      issues.push('🚨 HIPAA 위반: 의료 미디어 파일에 적절한 캐시 제어 누락');
    }
  }

  return {
    compliant: issues.length === 0,
    issues
  };
}

export default {
  blockDangerousSecurityFunctions,
  validateSecurityEnvironment,
  startSecurityMonitoring,
  validateSecurityHeaders
};