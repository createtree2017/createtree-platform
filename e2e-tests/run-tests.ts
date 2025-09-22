/**
 * E2E 테스트 스위트 - TopMediai 음악 생성 시스템
 */

import axios from 'axios';
import { db } from '../db/index.js';
import { music } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

const BASE_URL = 'http://localhost:5000';
const TEST_USER_ID = 10;

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

/**
 * TC1: TopMediai API 연결 테스트
 */
async function testTopMediaiConnection(): Promise<TestResult> {
  const start = Date.now();
  
  try {
    const response = await axios.get(`${BASE_URL}/api/music/styles`);
    
    if (response.status === 200 && Array.isArray(response.data)) {
      return {
        name: 'TopMediai API Connection',
        passed: true,
        duration: Date.now() - start
      };
    }
    
    throw new Error('Invalid response format');
  } catch (error: any) {
    return {
      name: 'TopMediai API Connection',
      passed: false,
      duration: Date.now() - start,
      error: error.message
    };
  }
}

/**
 * TC2: 음악 생성 전체 워크플로우 테스트
 */
async function testMusicGenerationWorkflow(): Promise<TestResult> {
  const start = Date.now();
  
  try {
    const musicData = {
      title: 'E2E Test Music',
      babyName: '테스트베이비',
      prompt: '평화로운 자장가',
      style: 'lullaby',
      duration: '60',
      generateLyrics: true,
      instrumental: false,
      gender: 'auto'
    };
    
    // 음악 생성 요청
    const response = await axios.post(`${BASE_URL}/api/music/create`, musicData, {
      timeout: 120000, // 2분 타임아웃
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    });
    
    if (response.status === 200 && response.data.success) {
      return {
        name: 'Music Generation Workflow',
        passed: true,
        duration: Date.now() - start
      };
    }
    
    throw new Error('Music generation failed');
  } catch (error: any) {
    return {
      name: 'Music Generation Workflow',
      passed: false,
      duration: Date.now() - start,
      error: error.message
    };
  }
}

/**
 * TC3: 데이터베이스 정합성 테스트
 */
async function testDatabaseIntegrity(): Promise<TestResult> {
  const start = Date.now();
  
  try {
    // 최근 생성된 음악 레코드 조회
    const recentMusic = await db
      .select()
      .from(music)
      .where(eq(music.userId, TEST_USER_ID))
      .limit(5);
    
    // 필수 필드 검증
    const hasValidRecords = recentMusic.every(record => 
      record.title && 
      record.url && 
      record.status && 
      ['pending', 'completed', 'failed'].includes(record.status)
    );
    
    if (hasValidRecords) {
      return {
        name: 'Database Integrity',
        passed: true,
        duration: Date.now() - start
      };
    }
    
    throw new Error('Invalid database records found');
  } catch (error: any) {
    return {
      name: 'Database Integrity',
      passed: false,
      duration: Date.now() - start,
      error: error.message
    };
  }
}

/**
 * TC4: 오류 처리 및 재시도 로직 테스트
 */
async function testErrorHandling(): Promise<TestResult> {
  const start = Date.now();
  
  try {
    // 잘못된 데이터로 음악 생성 시도
    const invalidData = {
      title: '',
      babyName: '',
      prompt: '',
      style: 'invalid_style',
      duration: '0'
    };
    
    const response = await axios.post(`${BASE_URL}/api/music/create`, invalidData, {
      timeout: 10000,
      validateStatus: () => true // 모든 상태 코드 허용
    });
    
    // 400 에러가 반환되어야 함
    if (response.status === 400 || response.status === 422) {
      return {
        name: 'Error Handling',
        passed: true,
        duration: Date.now() - start
      };
    }
    
    throw new Error('Expected validation error not returned');
  } catch (error: any) {
    return {
      name: 'Error Handling',
      passed: false,
      duration: Date.now() - start,
      error: error.message
    };
  }
}

/**
 * TC5: 성능 및 타임아웃 테스트
 */
async function testPerformanceAndTimeout(): Promise<TestResult> {
  const start = Date.now();
  
  try {
    // 동시 요청 처리 테스트
    const promises = Array.from({ length: 3 }, (_, i) => 
      axios.get(`${BASE_URL}/api/music/list`, {
        timeout: 5000,
        params: { page: 1, limit: 10 }
      })
    );
    
    const results = await Promise.all(promises);
    const allSuccessful = results.every(res => res.status === 200);
    const avgDuration = (Date.now() - start) / 3;
    
    if (allSuccessful && avgDuration < 3000) {
      return {
        name: 'Performance & Timeout',
        passed: true,
        duration: Date.now() - start
      };
    }
    
    throw new Error('Performance requirements not met');
  } catch (error: any) {
    return {
      name: 'Performance & Timeout',
      passed: false,
      duration: Date.now() - start,
      error: error.message
    };
  }
}

/**
 * 메인 테스트 실행기
 */
async function runE2ETests() {
  console.log('🚀 Starting E2E Test Suite for TopMediai Music System');
  console.log('=' .repeat(60));
  
  const tests = [
    testTopMediaiConnection,
    testMusicGenerationWorkflow,
    testDatabaseIntegrity,
    testErrorHandling,
    testPerformanceAndTimeout
  ];
  
  const results: TestResult[] = [];
  
  for (const test of tests) {
    console.log(`Running ${test.name}...`);
    const result = await test();
    results.push(result);
    
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const duration = `${result.duration}ms`;
    console.log(`${status} ${result.name} (${duration})`);
    
    if (!result.passed && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }
  
  console.log('=' .repeat(60));
  
  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  const successRate = Math.round((passedTests / totalTests) * 100);
  
  console.log(`📊 Test Results: ${passedTests}/${totalTests} passed (${successRate}%)`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! System is ready for production.');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Review errors above.');
    process.exit(1);
  }
}

runE2ETests().catch(console.error);