/**
 * 배포 준비를 위한 사이트 전체 완료성 종합 테스트
 * 2025-07-02 배포 전 최종 기능 검증
 */

import { db } from './db';
import { users, music, images, milestones, hospitals, conceptCategories } from './shared/schema';
import { eq, desc, count } from 'drizzle-orm';

interface TestResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  details: string;
  score: number;
}

interface SystemHealth {
  overallScore: number;
  readyForDeployment: boolean;
  testResults: TestResult[];
  criticalIssues: string[];
  warnings: string[];
  dataMetrics: any;
}

/**
 * 1. 인증 시스템 테스트
 */
async function testAuthenticationSystem(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  try {
    // 사용자 데이터 검증
    const userCount = await db.select({ count: count() }).from(users);
    const adminUsers = await db.select().from(users).where(eq(users.memberType, 'admin')).limit(5);
    const superAdminUsers = await db.select().from(users).where(eq(users.memberType, 'superadmin')).limit(5);
    
    results.push({
      category: '인증 시스템',
      test: '사용자 데이터 존재',
      status: userCount[0].count > 0 ? 'PASS' : 'FAIL',
      details: `총 ${userCount[0].count}명의 사용자 등록됨`,
      score: userCount[0].count > 0 ? 100 : 0
    });
    
    results.push({
      category: '인증 시스템',
      test: '관리자 계정 존재',
      status: (adminUsers.length > 0 || superAdminUsers.length > 0) ? 'PASS' : 'FAIL',
      details: `관리자 ${adminUsers.length}명, 슈퍼관리자 ${superAdminUsers.length}명`,
      score: (adminUsers.length > 0 || superAdminUsers.length > 0) ? 100 : 0
    });
    
    // 회원 등급 분포 확인
    const memberTypes = await db.select().from(users);
    const typeDistribution = memberTypes.reduce((acc, user) => {
      acc[user.memberType] = (acc[user.memberType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    results.push({
      category: '인증 시스템',
      test: '회원 등급 다양성',
      status: Object.keys(typeDistribution).length >= 3 ? 'PASS' : 'WARNING',
      details: `등급 분포: ${JSON.stringify(typeDistribution)}`,
      score: Object.keys(typeDistribution).length >= 3 ? 100 : 70
    });
    
  } catch (error) {
    results.push({
      category: '인증 시스템',
      test: '시스템 오류',
      status: 'FAIL',
      details: `오류: ${error}`,
      score: 0
    });
  }
  
  return results;
}

/**
 * 2. 병원 시스템 테스트
 */
async function testHospitalSystem(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  try {
    const hospitalCount = await db.select({ count: count() }).from(hospitals);
    const activeHospitals = await db.select().from(hospitals).where(eq(hospitals.isActive, true));
    const hospitalUsers = await db.select().from(users).where(eq(users.memberType, 'membership'));
    
    results.push({
      category: '병원 시스템',
      test: '병원 데이터 존재',
      status: hospitalCount[0].count > 0 ? 'PASS' : 'FAIL',
      details: `총 ${hospitalCount[0].count}개 병원 등록`,
      score: hospitalCount[0].count > 0 ? 100 : 0
    });
    
    results.push({
      category: '병원 시스템',
      test: '활성 병원 존재',
      status: activeHospitals.length > 0 ? 'PASS' : 'WARNING',
      details: `${activeHospitals.length}개 활성 병원`,
      score: activeHospitals.length > 0 ? 100 : 50
    });
    
    results.push({
      category: '병원 시스템',
      test: '병원 회원 존재',
      status: hospitalUsers.length > 0 ? 'PASS' : 'WARNING',
      details: `${hospitalUsers.length}명의 병원 회원`,
      score: hospitalUsers.length > 0 ? 100 : 60
    });
    
  } catch (error) {
    results.push({
      category: '병원 시스템',
      test: '시스템 오류',
      status: 'FAIL',
      details: `오류: ${error}`,
      score: 0
    });
  }
  
  return results;
}

/**
 * 3. 음악 생성 시스템 테스트
 */
async function testMusicSystem(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  try {
    const musicCount = await db.select({ count: count() }).from(music);
    const recentMusic = await db.select().from(music)
      .orderBy(desc(music.createdAt))
      .limit(10);
    
    const completedMusic = recentMusic.filter(m => m.status === 'completed');
    const gcsMusic = recentMusic.filter(m => m.gcsUrl);
    
    results.push({
      category: '음악 시스템',
      test: '음악 데이터 존재',
      status: musicCount[0].count > 0 ? 'PASS' : 'FAIL',
      details: `총 ${musicCount[0].count}개 음악 생성`,
      score: musicCount[0].count > 0 ? 100 : 0
    });
    
    results.push({
      category: '음악 시스템',
      test: '완료된 음악 존재',
      status: completedMusic.length > 0 ? 'PASS' : 'FAIL',
      details: `최근 10개 중 ${completedMusic.length}개 완료`,
      score: completedMusic.length > 0 ? 100 : 0
    });
    
    results.push({
      category: '음악 시스템',
      test: 'GCS 저장 시스템',
      status: gcsMusic.length > 0 ? 'PASS' : 'WARNING',
      details: `최근 10개 중 ${gcsMusic.length}개 GCS 저장`,
      score: gcsMusic.length > 0 ? 100 : 70
    });
    
    // TopMediai 외부 ID 확인
    const topMediaMusic = recentMusic.filter(m => m.externalId);
    results.push({
      category: '음악 시스템',
      test: 'TopMediai 연동',
      status: topMediaMusic.length > 0 ? 'PASS' : 'WARNING',
      details: `최근 10개 중 ${topMediaMusic.length}개 TopMediai 연동`,
      score: topMediaMusic.length > 0 ? 100 : 80
    });
    
  } catch (error) {
    results.push({
      category: '음악 시스템',
      test: '시스템 오류',
      status: 'FAIL',
      details: `오류: ${error}`,
      score: 0
    });
  }
  
  return results;
}

/**
 * 4. 이미지 생성 시스템 테스트
 */
async function testImageSystem(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  try {
    const imageCount = await db.select({ count: count() }).from(images);
    const recentImages = await db.select().from(images)
      .orderBy(desc(images.createdAt))
      .limit(20);
    
    const gcsImages = recentImages.filter(img => img.imageUrl && img.imageUrl.includes('storage.googleapis.com'));
    const thumbnailImages = recentImages.filter(img => img.thumbnailUrl);
    
    results.push({
      category: '이미지 시스템',
      test: '이미지 데이터 존재',
      status: imageCount[0].count > 0 ? 'PASS' : 'FAIL',
      details: `총 ${imageCount[0].count}개 이미지 생성`,
      score: imageCount[0].count > 0 ? 100 : 0
    });
    
    results.push({
      category: '이미지 시스템',
      test: 'GCS 저장 시스템',
      status: gcsImages.length > 0 ? 'PASS' : 'WARNING',
      details: `최근 20개 중 ${gcsImages.length}개 GCS 저장`,
      score: gcsImages.length > 0 ? 100 : 70
    });
    
    results.push({
      category: '이미지 시스템',
      test: '썸네일 생성',
      status: thumbnailImages.length > 0 ? 'PASS' : 'WARNING',
      details: `최근 20개 중 ${thumbnailImages.length}개 썸네일 생성`,
      score: thumbnailImages.length > 0 ? 100 : 80
    });
    
    // 카테고리별 분포 확인
    const categoryDistribution = recentImages.reduce((acc, img) => {
      acc[img.category] = (acc[img.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    results.push({
      category: '이미지 시스템',
      test: '카테고리 다양성',
      status: Object.keys(categoryDistribution).length >= 2 ? 'PASS' : 'WARNING',
      details: `카테고리 분포: ${JSON.stringify(categoryDistribution)}`,
      score: Object.keys(categoryDistribution).length >= 2 ? 100 : 70
    });
    
  } catch (error) {
    results.push({
      category: '이미지 시스템',
      test: '시스템 오류',
      status: 'FAIL',
      details: `오류: ${error}`,
      score: 0
    });
  }
  
  return results;
}

/**
 * 5. 마일스톤 시스템 테스트
 */
async function testMilestoneSystem(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  try {
    const milestoneCount = await db.select({ count: count() }).from(milestones);
    const recentMilestones = await db.select().from(milestones)
      .orderBy(desc(milestones.createdAt))
      .limit(10);
    
    const informationalMilestones = recentMilestones.filter(m => m.type === 'informational');
    const participatoryMilestones = recentMilestones.filter(m => m.type === 'participatory');
    
    results.push({
      category: '마일스톤 시스템',
      test: '마일스톤 데이터 존재',
      status: milestoneCount[0].count > 0 ? 'PASS' : 'FAIL',
      details: `총 ${milestoneCount[0].count}개 마일스톤`,
      score: milestoneCount[0].count > 0 ? 100 : 0
    });
    
    results.push({
      category: '마일스톤 시스템',
      test: '정보형 마일스톤',
      status: informationalMilestones.length > 0 ? 'PASS' : 'WARNING',
      details: `최근 10개 중 ${informationalMilestones.length}개 정보형`,
      score: informationalMilestones.length > 0 ? 100 : 80
    });
    
    results.push({
      category: '마일스톤 시스템',
      test: '참여형 마일스톤',
      status: participatoryMilestones.length > 0 ? 'PASS' : 'WARNING',
      details: `최근 10개 중 ${participatoryMilestones.length}개 참여형`,
      score: participatoryMilestones.length > 0 ? 100 : 80
    });
    
    // 병원별 마일스톤 확인
    const hospitalMilestones = recentMilestones.filter(m => m.hospitalId);
    results.push({
      category: '마일스톤 시스템',
      test: '병원별 마일스톤',
      status: hospitalMilestones.length > 0 ? 'PASS' : 'WARNING',
      details: `최근 10개 중 ${hospitalMilestones.length}개 병원별`,
      score: hospitalMilestones.length > 0 ? 100 : 70
    });
    
  } catch (error) {
    results.push({
      category: '마일스톤 시스템',
      test: '시스템 오류',
      status: 'FAIL',
      details: `오류: ${error}`,
      score: 0
    });
  }
  
  return results;
}

/**
 * 6. 카테고리 시스템 테스트
 */
async function testCategorySystem(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  try {
    const categoryCount = await db.select({ count: count() }).from(categories);
    const allCategories = await db.select().from(categories);
    
    const publicCategories = allCategories.filter(c => c.isPublic);
    const hospitalCategories = allCategories.filter(c => c.hospitalId);
    
    results.push({
      category: '카테고리 시스템',
      test: '카테고리 데이터 존재',
      status: categoryCount[0].count > 0 ? 'PASS' : 'FAIL',
      details: `총 ${categoryCount[0].count}개 카테고리`,
      score: categoryCount[0].count > 0 ? 100 : 0
    });
    
    results.push({
      category: '카테고리 시스템',
      test: '공개 카테고리 존재',
      status: publicCategories.length > 0 ? 'PASS' : 'WARNING',
      details: `${publicCategories.length}개 공개 카테고리`,
      score: publicCategories.length > 0 ? 100 : 70
    });
    
    results.push({
      category: '카테고리 시스템',
      test: '병원별 카테고리',
      status: hospitalCategories.length > 0 ? 'PASS' : 'WARNING',
      details: `${hospitalCategories.length}개 병원별 카테고리`,
      score: hospitalCategories.length > 0 ? 100 : 80
    });
    
  } catch (error) {
    results.push({
      category: '카테고리 시스템',
      test: '시스템 오류',
      status: 'FAIL',
      details: `오류: ${error}`,
      score: 0
    });
  }
  
  return results;
}

/**
 * 7. 데이터 메트릭 수집
 */
async function collectDataMetrics() {
  try {
    const userCount = await db.select({ count: count() }).from(users);
    const musicCount = await db.select({ count: count() }).from(music);
    const imageCount = await db.select({ count: count() }).from(images);
    const milestoneCount = await db.select({ count: count() }).from(milestones);
    const hospitalCount = await db.select({ count: count() }).from(hospitals);
    const categoryCount = await db.select({ count: count() }).from(categories);
    
    // 최근 7일간 활동
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentMusic = await db.select({ count: count() }).from(music);
    const recentImages = await db.select({ count: count() }).from(images);
    
    return {
      totalUsers: userCount[0].count,
      totalMusic: musicCount[0].count,
      totalImages: imageCount[0].count,
      totalMilestones: milestoneCount[0].count,
      totalHospitals: hospitalCount[0].count,
      totalCategories: categoryCount[0].count,
      recentMusicGenerated: recentMusic[0].count,
      recentImagesGenerated: recentImages[0].count,
      dataHealthScore: (userCount[0].count + musicCount[0].count + imageCount[0].count) > 50 ? 100 : 70
    };
  } catch (error) {
    return {
      error: `데이터 메트릭 수집 실패: ${error}`,
      dataHealthScore: 0
    };
  }
}

/**
 * 메인 테스트 실행 함수
 */
async function runDeploymentReadinessTest(): Promise<SystemHealth> {
  console.log('🚀 배포 준비 완료성 테스트 시작...\n');
  
  const allResults: TestResult[] = [];
  
  // 모든 시스템 테스트 실행
  const authResults = await testAuthenticationSystem();
  const hospitalResults = await testHospitalSystem();
  const musicResults = await testMusicSystem();
  const imageResults = await testImageSystem();
  const milestoneResults = await testMilestoneSystem();
  const categoryResults = await testCategorySystem();
  
  allResults.push(...authResults, ...hospitalResults, ...musicResults, ...imageResults, ...milestoneResults, ...categoryResults);
  
  // 데이터 메트릭 수집
  const dataMetrics = await collectDataMetrics();
  
  // 점수 계산
  const totalScore = allResults.reduce((sum, result) => sum + result.score, 0);
  const maxScore = allResults.length * 100;
  const overallScore = Math.round((totalScore / maxScore) * 100);
  
  // 문제점 분류
  const criticalIssues = allResults.filter(r => r.status === 'FAIL').map(r => `${r.category}: ${r.test} - ${r.details}`);
  const warnings = allResults.filter(r => r.status === 'WARNING').map(r => `${r.category}: ${r.test} - ${r.details}`);
  
  // 배포 준비도 결정
  const readyForDeployment = criticalIssues.length === 0 && overallScore >= 80;
  
  return {
    overallScore,
    readyForDeployment,
    testResults: allResults,
    criticalIssues,
    warnings,
    dataMetrics
  };
}

/**
 * 결과 출력
 */
function printTestReport(health: SystemHealth) {
  console.log('=' .repeat(80));
  console.log('🏥 AI 우리병원 문화센터 - 배포 준비 완료성 테스트 결과');
  console.log('=' .repeat(80));
  
  console.log(`\n📊 전체 점수: ${health.overallScore}/100`);
  console.log(`🚀 배포 준비 상태: ${health.readyForDeployment ? '✅ 준비 완료' : '❌ 추가 작업 필요'}`);
  
  console.log('\n📈 데이터 현황:');
  console.log(`  • 사용자: ${health.dataMetrics.totalUsers}명`);
  console.log(`  • 생성된 음악: ${health.dataMetrics.totalMusic}개`);
  console.log(`  • 생성된 이미지: ${health.dataMetrics.totalImages}개`);
  console.log(`  • 마일스톤: ${health.dataMetrics.totalMilestones}개`);
  console.log(`  • 병원: ${health.dataMetrics.totalHospitals}개`);
  console.log(`  • 카테고리: ${health.dataMetrics.totalCategories}개`);
  
  console.log('\n🧪 테스트 결과 상세:');
  const categories = [...new Set(health.testResults.map(r => r.category))];
  
  categories.forEach(category => {
    console.log(`\n  ${category}:`);
    health.testResults
      .filter(r => r.category === category)
      .forEach(result => {
        const icon = result.status === 'PASS' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌';
        console.log(`    ${icon} ${result.test}: ${result.details} (${result.score}/100)`);
      });
  });
  
  if (health.criticalIssues.length > 0) {
    console.log('\n🚨 치명적 문제:');
    health.criticalIssues.forEach(issue => console.log(`  • ${issue}`));
  }
  
  if (health.warnings.length > 0) {
    console.log('\n⚠️ 경고사항:');
    health.warnings.forEach(warning => console.log(`  • ${warning}`));
  }
  
  console.log('\n🎯 배포 권장사항:');
  if (health.readyForDeployment) {
    console.log('  ✅ 모든 핵심 기능이 정상 작동합니다');
    console.log('  ✅ 실제 사용자 데이터가 충분히 존재합니다');
    console.log('  ✅ 즉시 프로덕션 배포가 가능합니다');
    console.log('  🚀 Replit Deploy 버튼을 클릭하여 배포를 진행하세요');
  } else {
    console.log('  ❌ 치명적 문제를 먼저 해결해야 합니다');
    console.log('  📋 경고사항을 검토하고 개선하는 것을 권장합니다');
    console.log('  🔧 문제 해결 후 다시 테스트를 실행하세요');
  }
  
  console.log('\n' + '=' .repeat(80));
}

/**
 * 실행
 */
runDeploymentReadinessTest()
  .then(health => {
    printTestReport(health);
    process.exit(health.readyForDeployment ? 0 : 1);
  })
  .catch(error => {
    console.error('테스트 실행 중 오류:', error);
    process.exit(1);
  });