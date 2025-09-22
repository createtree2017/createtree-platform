#!/usr/bin/env tsx

/**
 * 🔧 GCS Private Key DECODER 에러 완전 분석 도구
 * 
 * 목적: 
 * - GOOGLE_CLOUD_PRIVATE_KEY 환경변수 상세 분석
 * - PEM 형식 검증
 * - Base64 디코딩 테스트
 * - OpenSSL 호환성 검증
 * - Google Auth 라이브러리 호환성 테스트
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import dotenv from 'dotenv';

// 환경변수 로드
dotenv.config();

console.log('🔍 GCS Private Key DECODER 에러 분석 시작...\n');

// 1. 환경변수 존재 확인
const privateKeyRaw = process.env.GOOGLE_CLOUD_PRIVATE_KEY;
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
const jsonCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

console.log('📋 환경변수 상태 확인:');
console.log(`  GOOGLE_CLOUD_PRIVATE_KEY: ${privateKeyRaw ? '✅ 존재' : '❌ 없음'}`);
console.log(`  GOOGLE_CLOUD_PROJECT_ID: ${projectId ? '✅ 존재' : '❌ 없음'}`);
console.log(`  GOOGLE_CLOUD_CLIENT_EMAIL: ${clientEmail ? '✅ 존재' : '❌ 없음'}`);
console.log(`  GOOGLE_APPLICATION_CREDENTIALS_JSON: ${jsonCredentials ? '✅ 존재' : '❌ 없음'}`);

if (!privateKeyRaw) {
  console.log('❌ GOOGLE_CLOUD_PRIVATE_KEY가 설정되지 않았습니다.');
  process.exit(1);
}

// 2. Private Key 원본 분석
console.log('\n📊 Private Key 원본 분석:');
console.log(`  길이: ${privateKeyRaw.length} 문자`);
console.log(`  시작 50자: ${privateKeyRaw.substring(0, 50)}...`);
console.log(`  끝 50자: ...${privateKeyRaw.substring(privateKeyRaw.length - 50)}`);

// 3. 인코딩 형태 분석
const hasDoubleSlash = privateKeyRaw.includes('\\\\n');
const hasSingleSlash = privateKeyRaw.includes('\\n');
const hasActualNewlines = privateKeyRaw.includes('\n');
const hasPemHeader = privateKeyRaw.includes('-----BEGIN PRIVATE KEY-----');
const hasPemFooter = privateKeyRaw.includes('-----END PRIVATE KEY-----');

console.log('\n🔍 인코딩 형태 분석:');
console.log(`  \\\\n (이중 백슬래시): ${hasDoubleSlash ? '✅ 발견' : '❌ 없음'}`);
console.log(`  \\n (단일 백슬래시): ${hasSingleSlash ? '✅ 발견' : '❌ 없음'}`);
console.log(`  실제 개행 문자: ${hasActualNewlines ? '✅ 발견' : '❌ 없음'}`);
console.log(`  PEM 헤더: ${hasPemHeader ? '✅ 발견' : '❌ 없음'}`);
console.log(`  PEM 푸터: ${hasPemFooter ? '✅ 발견' : '❌ 없음'}`);

// 4. 다양한 처리 방식 테스트
console.log('\n🧪 Private Key 처리 방식 테스트:');

const processingMethods = {
  'Simple Replace': privateKeyRaw.replace(/\\n/g, '\n'),
  'Double Replace': privateKeyRaw.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n'),
  'Trim Only': privateKeyRaw.trim(),
  'Multiple Processing': privateKeyRaw.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').trim()
};

for (const [method, processedKey] of Object.entries(processingMethods)) {
  console.log(`\n  📝 ${method}:`);
  console.log(`    길이: ${processedKey.length} 문자`);
  console.log(`    PEM 헤더 존재: ${processedKey.includes('-----BEGIN PRIVATE KEY-----') ? '✅' : '❌'}`);
  console.log(`    PEM 푸터 존재: ${processedKey.includes('-----END PRIVATE KEY-----') ? '✅' : '❌'}`);
  
  // Base64 부분 추출 시도
  try {
    const lines = processedKey.split('\n');
    const base64Lines = lines.filter(line => !line.includes('-----') && line.trim().length > 0);
    const base64Data = base64Lines.join('');
    console.log(`    Base64 데이터 길이: ${base64Data.length} 문자`);
    
    // Base64 디코딩 테스트
    const buffer = Buffer.from(base64Data, 'base64');
    console.log(`    Base64 디코딩: ✅ 성공 (${buffer.length} bytes)`);
  } catch (error) {
    console.log(`    Base64 디코딩: ❌ 실패 - ${error.message}`);
  }
  
  // OpenSSL 호환성 테스트
  try {
    const keyObject = crypto.createPrivateKey(processedKey);
    console.log(`    OpenSSL 호환성: ✅ 성공 (${keyObject.asymmetricKeyType})`);
  } catch (error) {
    console.log(`    OpenSSL 호환성: ❌ 실패 - ${error.message}`);
  }
}

// 5. JSON Credentials 분석 (있는 경우)
if (jsonCredentials) {
  console.log('\n📄 JSON Credentials 분석:');
  try {
    const parsed = JSON.parse(jsonCredentials);
    console.log(`  project_id: ${parsed.project_id ? '✅ 존재' : '❌ 없음'}`);
    console.log(`  client_email: ${parsed.client_email ? '✅ 존재' : '❌ 없음'}`);
    console.log(`  private_key: ${parsed.private_key ? '✅ 존재' : '❌ 없음'}`);
    
    if (parsed.private_key) {
      console.log(`  JSON private_key 길이: ${parsed.private_key.length} 문자`);
      
      // JSON private key OpenSSL 테스트
      try {
        const processedJsonKey = parsed.private_key.replace(/\\n/g, '\n');
        const keyObject = crypto.createPrivateKey(processedJsonKey);
        console.log(`  JSON private_key OpenSSL: ✅ 성공 (${keyObject.asymmetricKeyType})`);
      } catch (error) {
        console.log(`  JSON private_key OpenSSL: ❌ 실패 - ${error.message}`);
      }
    }
  } catch (error) {
    console.log(`  JSON 파싱: ❌ 실패 - ${error.message}`);
  }
}

// 6. 권장 해결 방법 제시
console.log('\n💡 권장 해결 방법:');

const workingMethods = [];
for (const [method, processedKey] of Object.entries(processingMethods)) {
  try {
    const keyObject = crypto.createPrivateKey(processedKey);
    if (keyObject) {
      workingMethods.push({
        method,
        processedKey,
        keyType: keyObject.asymmetricKeyType
      });
    }
  } catch (error) {
    // 무시
  }
}

if (workingMethods.length > 0) {
  console.log('✅ 작동하는 처리 방법들:');
  workingMethods.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.method} (키 타입: ${item.keyType})`);
  });
  
  // 가장 좋은 방법으로 테스트 키 파일 생성
  const bestMethod = workingMethods[0];
  fs.writeFileSync('/tmp/test-private-key.pem', bestMethod.processedKey);
  console.log('\n📝 테스트용 키 파일 생성: /tmp/test-private-key.pem');
  
} else {
  console.log('❌ 작동하는 처리 방법을 찾지 못했습니다.');
  console.log('📋 확인 사항:');
  console.log('  1. Replit Secrets에서 GOOGLE_CLOUD_PRIVATE_KEY 재설정');
  console.log('  2. Google Cloud Console에서 새 서비스 계정 키 생성');
  console.log('  3. JSON 형태의 키를 GOOGLE_APPLICATION_CREDENTIALS_JSON으로 설정');
}

console.log('\n🔧 분석 완료!');