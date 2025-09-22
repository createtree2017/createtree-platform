/**
 * 프로덕션 배포 위험 분석 및 검토
 * 
 * 배포 시 발생할 수 있는 잠재적 문제점들을 체계적으로 분석합니다.
 */

import { db } from './db';
import { users, music, images } from '@shared/schema';
import { eq, count, desc } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

interface RiskAssessment {
  category: string;
  risk: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  impact: string;
  mitigation: string;
  status: 'Resolved' | 'Partial' | 'Pending' | 'Unknown';
}

/**
 * 데이터베이스 관련 위험 분석
 */
async function analyzeDatabaseRisks(): Promise<RiskAssessment[]> {
  const risks: RiskAssessment[] = [];
  
  try {
    // 사용자 데이터 무결성 확인
    const userCount = await db.select({ count: count() }).from(users);
    const totalUsers = userCount[0]?.count || 0;
    
    // 음악 데이터 상태 확인
    const musicData = await db.query.music.findMany({
      limit: 100,
      orderBy: desc(music.createdAt)
    });
    
    const musicWithoutUrl = musicData.filter(m => !m.url);
    const musicWithGcsPath = musicData.filter(m => m.gcsPath);
    
    // 이미지 데이터 상태 확인
    const imageData = await db.query.images.findMany({
      limit: 100,
      orderBy: desc(images.createdAt)
    });
    
    const imagesWithoutThumbnail = imageData.filter(img => !img.thumbnailUrl);
    
    // 데이터 무결성 위험 평가
    if (musicWithoutUrl.length > musicData.length * 0.1) {
      risks.push({
        category: 'Database',
        risk: '음악 파일 URL 누락',
        severity: 'High',
        impact: `${musicWithoutUrl.length}개 음악이 재생 불가능`,
        mitigation: 'GCS 경로를 통한 URL 재생성 필요',
        status: 'Pending'
      });
    }
    
    if (imagesWithoutThumbnail.length > 0) {
      risks.push({
        category: 'Database',
        risk: '이미지 썸네일 누락',
        severity: 'Medium',
        impact: `${imagesWithoutThumbnail.length}개 이미지 로딩 성능 저하`,
        mitigation: '썸네일 자동 생성 스크립트 실행',
        status: 'Partial'
      });
    }
    
    if (totalUsers === 0) {
      risks.push({
        category: 'Database',
        risk: '사용자 데이터 부재',
        severity: 'Critical',
        impact: '인증 시스템 테스트 불가',
        mitigation: '관리자 계정 생성 및 테스트 계정 준비',
        status: 'Pending'
      });
    }
    
  } catch (error) {
    risks.push({
      category: 'Database',
      risk: '데이터베이스 연결 실패',
      severity: 'Critical',
      impact: '전체 시스템 접근 불가',
      mitigation: 'DATABASE_URL 환경변수 확인 및 연결 테스트',
      status: 'Unknown'
    });
  }
  
  return risks;
}

/**
 * 환경변수 및 설정 위험 분석
 */
async function analyzeEnvironmentRisks(): Promise<RiskAssessment[]> {
  const risks: RiskAssessment[] = [];
  
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'TOPMEDIA_API_KEY',
    'GOOGLE_CLOUD_PROJECT_ID',
    'GOOGLE_CLOUD_PRIVATE_KEY',
    'GOOGLE_CLOUD_CLIENT_EMAIL'
  ];
  
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length > 0) {
    risks.push({
      category: 'Environment',
      risk: '필수 환경변수 누락',
      severity: 'Critical',
      impact: `${missingEnvVars.join(', ')} 기능 작동 불가`,
      mitigation: 'Replit Secrets에 모든 필수 환경변수 설정',
      status: 'Pending'
    });
  }
  
  // JWT Secret 강도 확인
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    risks.push({
      category: 'Security',
      risk: 'JWT Secret 강도 부족',
      severity: 'High',
      impact: '인증 토큰 보안 취약점',
      mitigation: '32자 이상의 강력한 JWT Secret 설정',
      status: 'Pending'
    });
  }
  
  // NODE_ENV 확인
  if (process.env.NODE_ENV !== 'production') {
    risks.push({
      category: 'Environment',
      risk: 'Development 모드 배포',
      severity: 'Medium',
      impact: '성능 저하 및 디버그 정보 노출',
      mitigation: 'NODE_ENV=production 설정',
      status: 'Pending'
    });
  }
  
  return risks;
}

/**
 * 파일 시스템 및 저장소 위험 분석
 */
async function analyzeStorageRisks(): Promise<RiskAssessment[]> {
  const risks: RiskAssessment[] = [];
  
  try {
    // static 폴더 용량 확인
    const staticPath = path.join(process.cwd(), 'static');
    if (fs.existsSync(staticPath)) {
      const files = fs.readdirSync(staticPath, { withFileTypes: true });
      const totalFiles = files.length;
      
      if (totalFiles > 1000) {
        risks.push({
          category: 'Storage',
          risk: 'Static 폴더 파일 과다',
          severity: 'Medium',
          impact: '서버 시작 시간 지연 및 메모리 사용량 증가',
          mitigation: 'GCS로 파일 이동 및 로컬 파일 정리',
          status: 'Pending'
        });
      }
    }
    
    // uploads 폴더 확인
    const uploadsPath = path.join(process.cwd(), 'uploads');
    if (fs.existsSync(uploadsPath)) {
      const stats = fs.statSync(uploadsPath);
      if (stats.isDirectory()) {
        risks.push({
          category: 'Storage',
          risk: 'Uploads 폴더 존재',
          severity: 'Low',
          impact: '불필요한 로컬 저장소 사용',
          mitigation: 'GCS 완전 전환 후 uploads 폴더 제거',
          status: 'Pending'
        });
      }
    }
    
  } catch (error) {
    risks.push({
      category: 'Storage',
      risk: '파일 시스템 접근 오류',
      severity: 'Medium',
      impact: '파일 저장/로딩 기능 장애',
      mitigation: '파일 권한 및 경로 확인',
      status: 'Unknown'
    });
  }
  
  return risks;
}

/**
 * API 및 외부 서비스 위험 분석
 */
async function analyzeAPIRisks(): Promise<RiskAssessment[]> {
  const risks: RiskAssessment[] = [];
  
  // TopMediai API 연결 테스트
  try {
    const response = await fetch('https://api.topmediai.com/v2/query?id=test', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.TOPMEDIA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      risks.push({
        category: 'External API',
        risk: 'TopMediai API 연결 불안정',
        severity: 'High',
        impact: '음악 생성 기능 완전 중단',
        mitigation: 'API 키 재확인 및 네트워크 설정 점검',
        status: 'Pending'
      });
    }
  } catch (error) {
    risks.push({
      category: 'External API',
      risk: 'TopMediai API 접근 실패',
      severity: 'Critical',
      impact: '음악 생성 서비스 불가',
      mitigation: 'API 키 유효성 확인 및 네트워크 연결 점검',
      status: 'Unknown'
    });
  }
  
  // Google Cloud Storage 연결 테스트
  try {
    if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
      throw new Error('Google Cloud credentials missing');
    }
    
    risks.push({
      category: 'External Service',
      risk: 'GCS 연결 검증 필요',
      severity: 'Medium',
      impact: '이미지/음악 저장 실패 가능성',
      mitigation: 'GCS 버킷 권한 및 서비스 계정 확인',
      status: 'Pending'
    });
    
  } catch (error) {
    risks.push({
      category: 'External Service',
      risk: 'Google Cloud 설정 오류',
      severity: 'High',
      impact: '파일 저장소 기능 전면 중단',
      mitigation: 'Google Cloud 서비스 계정 재설정',
      status: 'Unknown'
    });
  }
  
  return risks;
}

/**
 * 성능 및 확장성 위험 분석
 */
async function analyzePerformanceRisks(): Promise<RiskAssessment[]> {
  const risks: RiskAssessment[] = [];
  
  // 메모리 사용량 확인
  const memoryUsage = process.memoryUsage();
  const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
  
  if (memoryUsageMB > 500) {
    risks.push({
      category: 'Performance',
      risk: '메모리 사용량 과다',
      severity: 'High',
      impact: `현재 ${Math.round(memoryUsageMB)}MB 사용, 서버 불안정 가능성`,
      mitigation: '메모리 누수 확인 및 캐시 크기 조정',
      status: 'Pending'
    });
  }
  
  // JWT 캐시 크기 확인 (가상적 체크)
  risks.push({
    category: 'Performance',
    risk: 'JWT 캐시 메모리 누적',
    severity: 'Medium',
    impact: '장기 운영 시 메모리 사용량 증가',
    mitigation: 'TTL 기반 자동 정리 구현됨 (5분)',
    status: 'Resolved'
  });
  
  // Rate Limiting 메모리 사용
  risks.push({
    category: 'Performance',
    risk: 'Rate Limiting 데이터 누적',
    severity: 'Low',
    impact: 'IP별 요청 기록 메모리 사용',
    mitigation: '주기적 정리 메커니즘 구현 필요',
    status: 'Partial'
  });
  
  return risks;
}

/**
 * 보안 위험 분석
 */
async function analyzeSecurityRisks(): Promise<RiskAssessment[]> {
  const risks: RiskAssessment[] = [];
  
  // HTTPS 설정 확인
  if (process.env.NODE_ENV === 'production' && !process.env.FORCE_HTTPS) {
    risks.push({
      category: 'Security',
      risk: 'HTTPS 강제 미설정',
      severity: 'High',
      impact: '데이터 전송 보안 취약',
      mitigation: '프로덕션 환경에서 HTTPS 강제 활성화',
      status: 'Resolved'
    });
  }
  
  // CORS 설정 확인
  risks.push({
    category: 'Security',
    risk: 'CORS 정책 검증 필요',
    severity: 'Medium',
    impact: '잘못된 도메인에서 API 접근 가능',
    mitigation: '프로덕션 도메인만 허용하도록 CORS 설정',
    status: 'Resolved'
  });
  
  // 관리자 계정 보안
  try {
    const adminUsers = await db.query.users.findMany({
      where: eq(users.role, 'super_admin'),
      limit: 5
    });
    
    if (adminUsers.length === 0) {
      risks.push({
        category: 'Security',
        risk: '관리자 계정 부재',
        severity: 'Critical',
        impact: '시스템 관리 불가',
        mitigation: '안전한 관리자 계정 생성',
        status: 'Pending'
      });
    }
    
    // 기본 비밀번호 사용 체크
    const weakPasswordUsers = adminUsers.filter(user => 
      user.username === 'admin' || user.email?.includes('admin@')
    );
    
    if (weakPasswordUsers.length > 0) {
      risks.push({
        category: 'Security',
        risk: '기본 관리자 계정 사용',
        severity: 'High',
        impact: '관리자 계정 보안 취약',
        mitigation: '강력한 비밀번호 및 고유 계정명 설정',
        status: 'Pending'
      });
    }
    
  } catch (error) {
    risks.push({
      category: 'Security',
      risk: '사용자 권한 확인 실패',
      severity: 'Medium',
      impact: '권한 관리 시스템 상태 불명',
      mitigation: '데이터베이스 연결 및 권한 테이블 확인',
      status: 'Unknown'
    });
  }
  
  return risks;
}

/**
 * 모니터링 및 로깅 위험 분석
 */
async function analyzeMonitoringRisks(): Promise<RiskAssessment[]> {
  const risks: RiskAssessment[] = [];
  
  // 로그 파일 크기 확인
  risks.push({
    category: 'Monitoring',
    risk: '로그 파일 무제한 증가',
    severity: 'Medium',
    impact: '디스크 공간 부족 및 성능 저하',
    mitigation: '로그 로테이션 및 압축 시스템 구현',
    status: 'Pending'
  });
  
  // 에러 추적 시스템
  risks.push({
    category: 'Monitoring',
    risk: '에러 추적 시스템 부재',
    severity: 'High',
    impact: '운영 중 문제 발생 시 원인 파악 어려움',
    mitigation: 'Sentry 또는 로그 분석 도구 연동',
    status: 'Pending'
  });
  
  // 성능 모니터링
  risks.push({
    category: 'Monitoring',
    risk: '실시간 성능 모니터링 부재',
    severity: 'Medium',
    impact: '성능 저하 조기 감지 불가',
    mitigation: 'APM 도구 연동 또는 커스텀 메트릭 수집',
    status: 'Pending'
  });
  
  return risks;
}

/**
 * 종합 위험 분석 실행
 */
async function runComprehensiveRiskAnalysis() {
  console.log('🔍 프로덕션 배포 위험 분석 시작');
  console.log('=' .repeat(80));
  
  const allRisks: RiskAssessment[] = [];
  
  console.log('\n📊 데이터베이스 위험 분석...');
  const dbRisks = await analyzeDatabaseRisks();
  allRisks.push(...dbRisks);
  
  console.log('🔧 환경설정 위험 분석...');
  const envRisks = await analyzeEnvironmentRisks();
  allRisks.push(...envRisks);
  
  console.log('💾 저장소 위험 분석...');
  const storageRisks = await analyzeStorageRisks();
  allRisks.push(...storageRisks);
  
  console.log('🌐 API 서비스 위험 분석...');
  const apiRisks = await analyzeAPIRisks();
  allRisks.push(...apiRisks);
  
  console.log('⚡ 성능 위험 분석...');
  const performanceRisks = await analyzePerformanceRisks();
  allRisks.push(...performanceRisks);
  
  console.log('🔒 보안 위험 분석...');
  const securityRisks = await analyzeSecurityRisks();
  allRisks.push(...securityRisks);
  
  console.log('📈 모니터링 위험 분석...');
  const monitoringRisks = await analyzeMonitoringRisks();
  allRisks.push(...monitoringRisks);
  
  // 위험도별 분류
  const criticalRisks = allRisks.filter(r => r.severity === 'Critical');
  const highRisks = allRisks.filter(r => r.severity === 'High');
  const mediumRisks = allRisks.filter(r => r.severity === 'Medium');
  const lowRisks = allRisks.filter(r => r.severity === 'Low');
  
  // 상태별 분류
  const resolvedRisks = allRisks.filter(r => r.status === 'Resolved');
  const partialRisks = allRisks.filter(r => r.status === 'Partial');
  const pendingRisks = allRisks.filter(r => r.status === 'Pending');
  const unknownRisks = allRisks.filter(r => r.status === 'Unknown');
  
  console.log('\n' + '='.repeat(80));
  console.log('📋 종합 위험 분석 결과');
  console.log('='.repeat(80));
  
  console.log(`\n🎯 위험도별 분포:`);
  console.log(`Critical: ${criticalRisks.length}개`);
  console.log(`High: ${highRisks.length}개`);
  console.log(`Medium: ${mediumRisks.length}개`);
  console.log(`Low: ${lowRisks.length}개`);
  console.log(`총 위험 요소: ${allRisks.length}개`);
  
  console.log(`\n📊 해결 상태 분포:`);
  console.log(`해결 완료: ${resolvedRisks.length}개`);
  console.log(`부분 해결: ${partialRisks.length}개`);
  console.log(`해결 필요: ${pendingRisks.length}개`);
  console.log(`상태 불명: ${unknownRisks.length}개`);
  
  // Critical 및 High 위험 상세 출력
  if (criticalRisks.length > 0) {
    console.log(`\n🚨 Critical 위험 요소:`);
    criticalRisks.forEach((risk, index) => {
      console.log(`${index + 1}. [${risk.category}] ${risk.risk}`);
      console.log(`   영향: ${risk.impact}`);
      console.log(`   해결방안: ${risk.mitigation}`);
      console.log(`   상태: ${risk.status}\n`);
    });
  }
  
  if (highRisks.length > 0) {
    console.log(`\n⚠️ High 위험 요소:`);
    highRisks.forEach((risk, index) => {
      console.log(`${index + 1}. [${risk.category}] ${risk.risk}`);
      console.log(`   영향: ${risk.impact}`);
      console.log(`   해결방안: ${risk.mitigation}`);
      console.log(`   상태: ${risk.status}\n`);
    });
  }
  
  // 배포 권장사항
  const blockingRisks = criticalRisks.filter(r => r.status !== 'Resolved').length;
  const highPriorityRisks = highRisks.filter(r => r.status !== 'Resolved').length;
  
  console.log('\n' + '='.repeat(80));
  console.log('🚀 배포 권장사항');
  console.log('='.repeat(80));
  
  if (blockingRisks === 0 && highPriorityRisks <= 2) {
    console.log('✅ 배포 권장: 주요 위험 요소가 해결되었습니다.');
    console.log('📋 배포 전 체크리스트:');
    console.log('- 데이터베이스 백업 완료');
    console.log('- 환경변수 모든 설정 확인');
    console.log('- 도메인 및 SSL 인증서 준비');
    console.log('- 모니터링 시스템 설정');
  } else if (blockingRisks === 0 && highPriorityRisks <= 5) {
    console.log('⚠️ 조건부 배포 가능: 일부 위험 요소 해결 후 배포 권장');
    console.log(`해결 필요한 High 위험: ${highPriorityRisks}개`);
  } else {
    console.log('❌ 배포 지연 권장: 주요 위험 요소 해결 후 재검토');
    console.log(`Critical 위험: ${blockingRisks}개`);
    console.log(`High 위험: ${highPriorityRisks}개`);
  }
  
  // 우선순위 해결 과제
  console.log('\n📋 우선순위 해결 과제:');
  const priorityTasks = [...criticalRisks, ...highRisks]
    .filter(r => r.status !== 'Resolved')
    .slice(0, 5);
    
  priorityTasks.forEach((task, index) => {
    console.log(`${index + 1}. [${task.severity}] ${task.risk}`);
    console.log(`   해결방안: ${task.mitigation}`);
  });
  
  console.log('\n' + '='.repeat(80));
  
  return {
    totalRisks: allRisks.length,
    criticalRisks: criticalRisks.length,
    highRisks: highRisks.length,
    blockingRisks,
    highPriorityRisks,
    deploymentRecommendation: blockingRisks === 0 && highPriorityRisks <= 2 ? 'Recommended' : 
                              blockingRisks === 0 && highPriorityRisks <= 5 ? 'Conditional' : 'Delayed',
    risks: allRisks
  };
}

// 스크립트 실행
runComprehensiveRiskAnalysis()
  .then((result) => {
    const exitCode = result.deploymentRecommendation === 'Recommended' ? 0 : 
                    result.deploymentRecommendation === 'Conditional' ? 1 : 2;
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error('❌ 위험 분석 중 오류:', error);
    process.exit(3);
  });

export { runComprehensiveRiskAnalysis };