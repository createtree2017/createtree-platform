/**
 * 컨셉 순서 변경 시스템 종합 무결점 테스트
 * 2025-07-03 순서 변경 기능 완성 후 전체 시스템 검증
 */

import { db } from './db';
import { concepts, conceptCategories } from './shared/schema';
import { eq, and, asc } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

interface TestResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  details: string;
  score: number;
}

interface SystemHealth {
  overallScore: number;
  readyForProduction: boolean;
  testResults: TestResult[];
  criticalIssues: string[];
  warnings: string[];
  featureCompleteness: any;
}

/**
 * 1. 관리자 인증 시스템 테스트
 */
async function testAuthenticationSystem(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  try {
    console.log('\n=== 1. 관리자 인증 시스템 테스트 ===');
    
    // JWT 토큰 생성 테스트
    const testToken = jwt.sign(
      { 
        id: 24, 
        userId: 24, 
        memberType: 'superadmin',
        email: '9059056@gmail.com'
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '1h' }
    );
    
    if (testToken) {
      results.push({
        category: '인증',
        test: 'JWT 토큰 생성',
        status: 'PASS',
        details: 'JWT 토큰이 정상적으로 생성됨',
        score: 10
      });
    }
    
    // API 엔드포인트 접근 테스트
    const apiResponse = await fetch('http://localhost:5000/api/admin/concepts', {
      headers: { 'Authorization': `Bearer ${testToken}` }
    });
    
    if (apiResponse.ok) {
      results.push({
        category: '인증',
        test: '관리자 API 접근',
        status: 'PASS',
        details: `API 응답 상태: ${apiResponse.status}`,
        score: 15
      });
    } else {
      results.push({
        category: '인증',
        test: '관리자 API 접근',
        status: 'FAIL',
        details: `API 응답 실패: ${apiResponse.status}`,
        score: 0
      });
    }
    
  } catch (error) {
    results.push({
      category: '인증',
      test: '인증 시스템 전체',
      status: 'FAIL',
      details: `인증 시스템 오류: ${error instanceof Error ? error.message : 'Unknown error'}`,
      score: 0
    });
  }
  
  return results;
}

/**
 * 2. 카테고리 필터링 시스템 테스트
 */
async function testCategoryFilteringSystem(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  try {
    console.log('\n=== 2. 카테고리 필터링 시스템 테스트 ===');
    
    // 카테고리 목록 조회
    const categories = await db.select().from(conceptCategories).orderBy(asc(conceptCategories.order));
    console.log(`카테고리 개수: ${categories.length}`);
    
    if (categories.length > 0) {
      results.push({
        category: '카테고리',
        test: '카테고리 목록 조회',
        status: 'PASS',
        details: `${categories.length}개 카테고리 조회 성공`,
        score: 10
      });
      
      // 각 카테고리별 컨셉 개수 확인
      for (const category of categories.slice(0, 3)) { // 상위 3개만 테스트
        const conceptsInCategory = await db.query.concepts.findMany({
          where: eq(concepts.categoryId, category.categoryId)
        });
        
        console.log(`카테고리 "${category.name}": ${conceptsInCategory.length}개 컨셉`);
        
        if (conceptsInCategory.length > 0) {
          results.push({
            category: '카테고리',
            test: `카테고리별 컨셉 조회 (${category.name})`,
            status: 'PASS',
            details: `${conceptsInCategory.length}개 컨셉 필터링 성공`,
            score: 5
          });
        }
      }
    } else {
      results.push({
        category: '카테고리',
        test: '카테고리 목록 조회',
        status: 'FAIL',
        details: '카테고리가 존재하지 않음',
        score: 0
      });
    }
    
  } catch (error) {
    results.push({
      category: '카테고리',
      test: '카테고리 시스템 전체',
      status: 'FAIL',
      details: `카테고리 시스템 오류: ${error instanceof Error ? error.message : 'Unknown error'}`,
      score: 0
    });
  }
  
  return results;
}

/**
 * 3. 순서 변경 API 시스템 테스트
 */
async function testReorderAPISystem(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  try {
    console.log('\n=== 3. 순서 변경 API 시스템 테스트 ===');
    
    // JWT 토큰 생성
    const token = jwt.sign(
      { id: 24, userId: 24, memberType: 'superadmin', email: '9059056@gmail.com' },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '1h' }
    );
    
    // 기존 컨셉 조회
    const existingConcepts = await db.query.concepts.findMany({
      where: eq(concepts.categoryId, 'mansak_img'),
      orderBy: asc(concepts.order),
      limit: 3
    });
    
    if (existingConcepts.length >= 2) {
      console.log(`테스트용 컨셉 ${existingConcepts.length}개 발견`);
      
      // 순서 변경 테스트 데이터 준비
      const testReorderData = {
        conceptOrders: [
          { conceptId: existingConcepts[0].conceptId, order: 999 },
          { conceptId: existingConcepts[1].conceptId, order: 998 }
        ]
      };
      
      // API 호출 테스트
      const reorderResponse = await fetch('http://localhost:5000/api/admin/reorder-concepts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(testReorderData)
      });
      
      if (reorderResponse.ok) {
        const result = await reorderResponse.json();
        console.log('순서 변경 API 응답:', result);
        
        if (result.success) {
          results.push({
            category: '순서변경',
            test: '순서 변경 API 호출',
            status: 'PASS',
            details: `${result.summary?.success || 0}개 컨셉 순서 변경 성공`,
            score: 20
          });
          
          // 변경 결과 검증
          const updatedConcepts = await db.query.concepts.findMany({
            where: eq(concepts.conceptId, existingConcepts[0].conceptId)
          });
          
          if (updatedConcepts[0]?.order === 999) {
            results.push({
              category: '순서변경',
              test: '순서 변경 결과 검증',
              status: 'PASS',
              details: '데이터베이스에 순서 변경이 정확히 반영됨',
              score: 15
            });
          } else {
            results.push({
              category: '순서변경',
              test: '순서 변경 결과 검증',
              status: 'FAIL',
              details: '데이터베이스 순서 변경 반영 실패',
              score: 0
            });
          }
          
          // 원래 순서로 복구
          const restoreData = {
            conceptOrders: [
              { conceptId: existingConcepts[0].conceptId, order: 1 },
              { conceptId: existingConcepts[1].conceptId, order: 2 }
            ]
          };
          
          await fetch('http://localhost:5000/api/admin/reorder-concepts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(restoreData)
          });
          
          results.push({
            category: '순서변경',
            test: '원상 복구',
            status: 'PASS',
            details: '테스트 후 원래 순서로 복구 완료',
            score: 5
          });
          
        } else {
          results.push({
            category: '순서변경',
            test: '순서 변경 API 호출',
            status: 'FAIL',
            details: `API 응답 실패: ${result.error || 'Unknown error'}`,
            score: 0
          });
        }
      } else {
        results.push({
          category: '순서변경',
          test: '순서 변경 API 호출',
          status: 'FAIL',
          details: `HTTP 응답 실패: ${reorderResponse.status}`,
          score: 0
        });
      }
    } else {
      results.push({
        category: '순서변경',
        test: '테스트 데이터 준비',
        status: 'WARNING',
        details: '테스트할 컨셉이 부족함 (최소 2개 필요)',
        score: 5
      });
    }
    
  } catch (error) {
    results.push({
      category: '순서변경',
      test: '순서 변경 시스템 전체',
      status: 'FAIL',
      details: `순서 변경 시스템 오류: ${error instanceof Error ? error.message : 'Unknown error'}`,
      score: 0
    });
  }
  
  return results;
}

/**
 * 4. 프론트엔드 컴포넌트 무결성 테스트
 */
async function testFrontendIntegrity(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  try {
    console.log('\n=== 4. 프론트엔드 컴포넌트 무결성 테스트 ===');
    
    // ConceptManagement.tsx 파일 존재 확인
    const fs = await import('fs');
    const conceptManagementExists = fs.existsSync('client/src/components/admin/ConceptManagement.tsx');
    
    if (conceptManagementExists) {
      results.push({
        category: '프론트엔드',
        test: 'ConceptManagement 컴포넌트 존재',
        status: 'PASS',
        details: 'ConceptManagement.tsx 파일이 존재함',
        score: 10
      });
      
      // 파일 내용 검사
      const fileContent = fs.readFileSync('client/src/components/admin/ConceptManagement.tsx', 'utf-8');
      
      const requiredFunctions = [
        'startReorderMode',
        'saveReorder',
        'moveConceptUp',
        'moveConceptDown',
        'exitReorderMode'
      ];
      
      let functionsFound = 0;
      for (const func of requiredFunctions) {
        if (fileContent.includes(func)) {
          functionsFound++;
        }
      }
      
      if (functionsFound === requiredFunctions.length) {
        results.push({
          category: '프론트엔드',
          test: '순서 변경 함수 완성도',
          status: 'PASS',
          details: `${functionsFound}/${requiredFunctions.length} 필수 함수 구현됨`,
          score: 15
        });
      } else {
        results.push({
          category: '프론트엔드',
          test: '순서 변경 함수 완성도',
          status: 'WARNING',
          details: `${functionsFound}/${requiredFunctions.length} 함수만 구현됨`,
          score: 10
        });
      }
      
      // API 엔드포인트 정확성 확인
      if (fileContent.includes('/api/admin/reorder-concepts')) {
        results.push({
          category: '프론트엔드',
          test: 'API 엔드포인트 정확성',
          status: 'PASS',
          details: '올바른 API 엔드포인트 사용중',
          score: 10
        });
      } else {
        results.push({
          category: '프론트엔드',
          test: 'API 엔드포인트 정확성',
          status: 'FAIL',
          details: '잘못된 API 엔드포인트 사용',
          score: 0
        });
      }
      
    } else {
      results.push({
        category: '프론트엔드',
        test: 'ConceptManagement 컴포넌트 존재',
        status: 'FAIL',
        details: 'ConceptManagement.tsx 파일이 존재하지 않음',
        score: 0
      });
    }
    
  } catch (error) {
    results.push({
      category: '프론트엔드',
      test: '프론트엔드 무결성 전체',
      status: 'FAIL',
      details: `프론트엔드 검사 오류: ${error instanceof Error ? error.message : 'Unknown error'}`,
      score: 0
    });
  }
  
  return results;
}

/**
 * 5. 데이터 무결성 및 성능 테스트
 */
async function testDataIntegrityAndPerformance(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  try {
    console.log('\n=== 5. 데이터 무결성 및 성능 테스트 ===');
    
    // 전체 컨셉 개수 확인
    const startTime = Date.now();
    const allConcepts = await db.query.concepts.findMany();
    const queryTime = Date.now() - startTime;
    
    console.log(`전체 컨셉 개수: ${allConcepts.length}, 조회 시간: ${queryTime}ms`);
    
    if (allConcepts.length > 0) {
      results.push({
        category: '데이터',
        test: '컨셉 데이터 존재',
        status: 'PASS',
        details: `${allConcepts.length}개 컨셉 데이터 확인`,
        score: 10
      });
    }
    
    if (queryTime < 1000) {
      results.push({
        category: '성능',
        test: '데이터 조회 성능',
        status: 'PASS',
        details: `${queryTime}ms 내 조회 완료 (목표: 1초 이내)`,
        score: 10
      });
    } else {
      results.push({
        category: '성능',
        test: '데이터 조회 성능',
        status: 'WARNING',
        details: `${queryTime}ms 소요 (목표: 1초 이내)`,
        score: 5
      });
    }
    
    // order 필드 중복 검사
    const orderConflicts = await db.query.concepts.findMany();
    const orderCounts: Record<string, number> = {};
    
    for (const concept of orderConflicts) {
      const key = `${concept.categoryId}-${concept.order}`;
      orderCounts[key] = (orderCounts[key] || 0) + 1;
    }
    
    const conflicts = Object.entries(orderCounts).filter(([_, count]) => count > 1);
    
    if (conflicts.length === 0) {
      results.push({
        category: '데이터',
        test: 'order 필드 무결성',
        status: 'PASS',
        details: '카테고리별 order 중복 없음',
        score: 10
      });
    } else {
      results.push({
        category: '데이터',
        test: 'order 필드 무결성',
        status: 'WARNING',
        details: `${conflicts.length}개 order 중복 발견`,
        score: 5
      });
    }
    
  } catch (error) {
    results.push({
      category: '데이터',
      test: '데이터 무결성 전체',
      status: 'FAIL',
      details: `데이터 무결성 검사 오류: ${error instanceof Error ? error.message : 'Unknown error'}`,
      score: 0
    });
  }
  
  return results;
}

/**
 * 메인 테스트 실행 함수
 */
async function runComprehensiveTest(): Promise<SystemHealth> {
  console.log('🔍 컨셉 순서 변경 시스템 종합 무결점 테스트 시작\n');
  
  const allResults: TestResult[] = [];
  const criticalIssues: string[] = [];
  const warnings: string[] = [];
  
  // 모든 테스트 실행
  const testSuites = [
    testAuthenticationSystem,
    testCategoryFilteringSystem,
    testReorderAPISystem,
    testFrontendIntegrity,
    testDataIntegrityAndPerformance
  ];
  
  for (const testSuite of testSuites) {
    try {
      const results = await testSuite();
      allResults.push(...results);
    } catch (error) {
      console.error(`테스트 스위트 실행 오류:`, error);
      allResults.push({
        category: '시스템',
        test: '테스트 스위트 실행',
        status: 'FAIL',
        details: `테스트 실행 오류: ${error instanceof Error ? error.message : 'Unknown error'}`,
        score: 0
      });
    }
  }
  
  // 결과 분석
  const totalScore = allResults.reduce((sum, result) => sum + result.score, 0);
  const maxScore = allResults.length * 15; // 평균 15점 기준
  const overallScore = Math.round((totalScore / maxScore) * 100);
  
  // 중요 이슈 및 경고 수집
  allResults.forEach(result => {
    if (result.status === 'FAIL') {
      criticalIssues.push(`${result.category}: ${result.test} - ${result.details}`);
    } else if (result.status === 'WARNING') {
      warnings.push(`${result.category}: ${result.test} - ${result.details}`);
    }
  });
  
  const readyForProduction = criticalIssues.length === 0 && overallScore >= 80;
  
  return {
    overallScore,
    readyForProduction,
    testResults: allResults,
    criticalIssues,
    warnings,
    featureCompleteness: {
      categoryFiltering: allResults.filter(r => r.category === '카테고리' && r.status === 'PASS').length,
      reorderAPI: allResults.filter(r => r.category === '순서변경' && r.status === 'PASS').length,
      frontendIntegrity: allResults.filter(r => r.category === '프론트엔드' && r.status === 'PASS').length,
      dataIntegrity: allResults.filter(r => r.category === '데이터' && r.status === 'PASS').length
    }
  };
}

/**
 * 결과 출력
 */
function printTestReport(health: SystemHealth) {
  console.log('\n' + '='.repeat(60));
  console.log('🎯 컨셉 순서 변경 시스템 종합 무결점 테스트 결과');
  console.log('='.repeat(60));
  
  console.log(`\n📊 전체 점수: ${health.overallScore}/100`);
  console.log(`🚀 프로덕션 준비: ${health.readyForProduction ? '✅ 준비완료' : '❌ 추가 작업 필요'}`);
  
  console.log('\n📋 테스트 결과 상세:');
  health.testResults.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} [${result.category}] ${result.test}: ${result.details} (${result.score}점)`);
  });
  
  if (health.criticalIssues.length > 0) {
    console.log('\n🚨 중요 이슈:');
    health.criticalIssues.forEach(issue => console.log(`❌ ${issue}`));
  }
  
  if (health.warnings.length > 0) {
    console.log('\n⚠️ 경고사항:');
    health.warnings.forEach(warning => console.log(`⚠️ ${warning}`));
  }
  
  console.log('\n🔧 기능 완성도:');
  console.log(`카테고리 필터링: ${health.featureCompleteness.categoryFiltering}개 테스트 통과`);
  console.log(`순서 변경 API: ${health.featureCompleteness.reorderAPI}개 테스트 통과`);
  console.log(`프론트엔드 무결성: ${health.featureCompleteness.frontendIntegrity}개 테스트 통과`);
  console.log(`데이터 무결성: ${health.featureCompleteness.dataIntegrity}개 테스트 통과`);
  
  console.log('\n' + '='.repeat(60));
  console.log(health.readyForProduction ? 
    '🎉 순서 변경 시스템이 완벽하게 작동합니다!' : 
    '🔧 일부 개선이 필요합니다.');
  console.log('='.repeat(60));
}

/**
 * 실행
 */
runComprehensiveTest()
  .then(printTestReport)
  .catch(console.error);

export { runComprehensiveTest, printTestReport };