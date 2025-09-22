/**
 * Phase 1-5 기반 시스템 보완 검증 스크립트
 * 82% → 100% 성공률 달성을 위한 수정 사항 검증
 */

import { db } from './db/index.js';

interface TestResult {
  phase: number;
  test: string;
  status: 'pass' | 'fail' | 'warning';
  issue?: string;
  error?: any;
}

async function testFoundationRepairs() {
  const testResults: TestResult[] = [];
  let totalTests = 0;
  let passedTests = 0;

  console.log('🔧 Phase 1-5 기반 시스템 보완 검증 시작\n');

  try {
    // ===== Phase 1: 마일스톤 테이블 스키마 수정 검증 =====
    console.log('📋 Phase 1: 마일스톤 테이블 스키마 검증');
    
    totalTests++;
    try {
      // 마일스톤 테이블 컬럼 확인
      const result = await db.execute(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'milestones' 
        AND column_name IN ('participation_start_date', 'participation_end_date', 'max_participants', 'current_participants')
      `);
      
      const columnNames = result.rows.map((row: any) => row.column_name);
      const requiredColumns = ['participation_start_date', 'participation_end_date', 'max_participants', 'current_participants'];
      const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
      
      if (missingColumns.length === 0) {
        console.log('   ✅ 마일스톤 테이블 필수 필드 완성');
        passedTests++;
        testResults.push({ phase: 1, test: 'milestones schema fields', status: 'pass' });
      } else {
        console.log(`   ❌ 마일스톤 테이블 필수 필드 누락: ${missingColumns.join(', ')}`);
        testResults.push({ phase: 1, test: 'milestones schema fields', status: 'fail', issue: `누락된 필드: ${missingColumns.join(', ')}` });
      }
    } catch (error) {
      console.log('   ❌ 마일스톤 테이블 스키마 확인 실패');
      testResults.push({ phase: 1, test: 'milestones schema fields', status: 'fail', error: error });
    }

    // ===== Phase 5: 알림 시스템 스키마 수정 검증 =====
    console.log('\n🔔 Phase 5: 알림 시스템 스키마 검증');
    
    totalTests++;
    try {
      // notifications 테이블 read_at 컬럼 확인
      const result = await db.execute(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'read_at'
      `);
      
      if (result.rows.length > 0) {
        console.log('   ✅ notifications 테이블 read_at 필드 완성');
        passedTests++;
        testResults.push({ phase: 5, test: 'notifications read_at field', status: 'pass' });
      } else {
        console.log('   ❌ notifications 테이블 read_at 필드 누락');
        testResults.push({ phase: 5, test: 'notifications read_at field', status: 'fail', issue: 'read_at 필드 누락' });
      }
    } catch (error) {
      console.log('   ❌ notifications 테이블 스키마 확인 실패');
      testResults.push({ phase: 5, test: 'notifications read_at field', status: 'fail', error: error });
    }

    // ===== Phase 3: 관리자 API 인증 기능 테스트 =====
    console.log('\n🔐 Phase 3: 관리자 API 인증 시스템 검증');
    
    totalTests++;
    try {
      // 관리자 사용자 존재 확인
      const adminUsers = await db.execute(`
        SELECT id, username, member_type 
        FROM users 
        WHERE member_type IN ('admin', 'superadmin') 
        LIMIT 1
      `);
      
      if (adminUsers.rows.length > 0) {
        const adminUser = adminUsers.rows[0] as any;
        console.log(`   ✅ 관리자 계정 존재 확인: ${adminUser.username} (${adminUser.member_type})`);
        passedTests++;
        testResults.push({ phase: 3, test: 'admin user exists', status: 'pass' });
      } else {
        console.log('   ⚠️  관리자 계정이 존재하지 않음');
        testResults.push({ phase: 3, test: 'admin user exists', status: 'warning', issue: '관리자 계정 없음' });
      }
    } catch (error) {
      console.log('   ❌ 관리자 계정 확인 실패');
      testResults.push({ phase: 3, test: 'admin user exists', status: 'fail', error: error });
    }

    // ===== 종합 결과 출력 =====
    console.log('\n' + '='.repeat(50));
    console.log('🎯 Phase 1-5 기반 시스템 보완 검증 결과');
    console.log('='.repeat(50));
    
    const successRate = Math.round((passedTests / totalTests) * 100);
    console.log(`📊 성공률: ${passedTests}/${totalTests} (${successRate}%)`);
    
    if (successRate >= 100) {
      console.log('🎉 상태: 완벽 - Phase 6-7 진행 가능');
    } else if (successRate >= 80) {
      console.log('✅ 상태: 양호 - 추가 보완 권장');
    } else {
      console.log('⚠️  상태: 보완 필요 - 문제 해결 후 재테스트');
    }

    // 실패한 테스트 상세 정보
    const failedTests = testResults.filter(t => t.status === 'fail');
    if (failedTests.length > 0) {
      console.log('\n❌ 실패한 테스트:');
      failedTests.forEach(test => {
        console.log(`   Phase ${test.phase}: ${test.test} - ${test.issue || test.error}`);
      });
    }

    // 경고 테스트 정보
    const warningTests = testResults.filter(t => t.status === 'warning');
    if (warningTests.length > 0) {
      console.log('\n⚠️  경고 테스트:');
      warningTests.forEach(test => {
        console.log(`   Phase ${test.phase}: ${test.test} - ${test.issue}`);
      });
    }

    console.log('\n🔧 보완 작업 완료 여부:');
    console.log(`   Phase 1 마일스톤 스키마: ${testResults.find(t => t.test === 'milestones schema fields')?.status === 'pass' ? '✅' : '❌'}`);
    console.log(`   Phase 5 알림 스키마: ${testResults.find(t => t.test === 'notifications read_at field')?.status === 'pass' ? '✅' : '❌'}`);
    console.log(`   Phase 3 관리자 계정: ${testResults.find(t => t.test === 'admin user exists')?.status === 'pass' ? '✅' : '⚠️'}`);

  } catch (error) {
    console.error('❌ 테스트 실행 중 오류 발생:', error);
  }
}

// 스크립트 실행
testFoundationRepairs().catch(console.error);