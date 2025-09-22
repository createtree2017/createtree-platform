#!/usr/bin/env tsx

/**
 * 🔧 GCS Private Key DECODER 에러 완전 해결 스크립트
 * 
 * 발견된 문제들:
 * 1. Private key에 Base64 내용이 비어있음 (0 characters)
 * 2. JSON credentials에 잘못된 escape 문자
 * 3. GOOGLE_CLOUD_STORAGE_BUCKET 환경변수 누락
 * 
 * 해결 방법:
 * 1. 강력한 private key 재구성 시스템
 * 2. JSON credentials 정리 및 복구
 * 3. 환경변수 설정
 * 4. 다중 fallback 인증 방식
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import dotenv from 'dotenv';

// 환경변수 로드
dotenv.config();

console.log('🔧 GCS Private Key DECODER 에러 완전 해결 시작...\n');

/**
 * 🔧 고급 Private Key 처리 함수 - 모든 가능한 형식 처리
 */
function reconstructPrivateKey(rawKey: string): string | null {
  if (!rawKey || rawKey.trim().length === 0) {
    return null;
  }

  console.log(`🔑 Private key 재구성 시작... (원본 길이: ${rawKey.length})`);
  
  let processedKey = rawKey;
  
  // 1단계: 다양한 escape 문자 처리
  processedKey = processedKey.replace(/\\\\n/g, '\n'); // \\n → \n
  processedKey = processedKey.replace(/\\n/g, '\n');     // \n → actual newline
  processedKey = processedKey.replace(/\\r\\n/g, '\n');  // Windows CRLF
  processedKey = processedKey.replace(/\\r/g, '\n');     // Mac CR
  
  // 2단계: 불필요한 공백 및 특수문자 제거
  processedKey = processedKey.trim();
  processedKey = processedKey.replace(/\s+/g, ' '); // 연속 공백을 단일 공백으로
  
  // 3단계: PEM 헤더/푸터 확인 및 정규화
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  
  // Base64 content 추출 시도
  let base64Content = '';
  
  if (processedKey.includes(pemHeader) && processedKey.includes(pemFooter)) {
    // PEM 형식이 있는 경우
    const lines = processedKey.split(/\r?\n/);
    const contentLines = [];
    let inKeySection = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.includes(pemHeader)) {
        inKeySection = true;
        continue;
      }
      if (trimmedLine.includes(pemFooter)) {
        inKeySection = false;
        break;
      }
      if (inKeySection && trimmedLine.length > 0) {
        // Base64 문자만 추출 (공백, 특수문자 제거)
        const cleanLine = trimmedLine.replace(/[^A-Za-z0-9+/=]/g, '');
        if (cleanLine.length > 0) {
          contentLines.push(cleanLine);
        }
      }
    }
    
    base64Content = contentLines.join('');
  } else {
    // PEM 헤더/푸터가 없는 경우, 전체를 Base64로 간주하고 정리
    base64Content = processedKey.replace(/[^A-Za-z0-9+/=]/g, '');
  }
  
  console.log(`🔍 Base64 content 길이: ${base64Content.length} 문자`);
  
  if (base64Content.length === 0) {
    console.log('❌ Base64 content가 비어있습니다.');
    
    // 4단계: 대안 방법 시도 - 원본에서 다른 패턴 찾기
    console.log('🔄 대안 Base64 추출 시도...');
    
    // 긴 알파뉴메릭 시퀀스 찾기 (Base64일 가능성)
    const possibleBase64 = rawKey.match(/[A-Za-z0-9+/]{100,}/g);
    if (possibleBase64 && possibleBase64.length > 0) {
      base64Content = possibleBase64[0];
      console.log(`🎯 대안 Base64 발견: ${base64Content.length} 문자`);
    }
  }
  
  if (base64Content.length === 0) {
    return null;
  }
  
  // 5단계: Base64 유효성 검증 및 패딩 수정
  try {
    // Base64 패딩 수정
    const paddingNeeded = (4 - (base64Content.length % 4)) % 4;
    if (paddingNeeded > 0) {
      base64Content = base64Content + '='.repeat(paddingNeeded);
      console.log(`🔧 Base64 패딩 추가: ${paddingNeeded}개`);
    }
    
    // Base64 디코딩 테스트
    const buffer = Buffer.from(base64Content, 'base64');
    console.log(`✅ Base64 디코딩 성공: ${buffer.length} bytes`);
    
  } catch (error) {
    console.log(`❌ Base64 디코딩 실패: ${error.message}`);
    return null;
  }
  
  // 6단계: 올바른 PEM 형식으로 재구성
  const formattedBase64 = base64Content.match(/.{1,64}/g)?.join('\n') || base64Content;
  const reconstructedKey = `${pemHeader}\n${formattedBase64}\n${pemFooter}`;
  
  console.log(`🔧 PEM 형식 재구성 완료: ${reconstructedKey.length} 문자`);
  
  return reconstructedKey;
}

/**
 * 🔧 JSON Credentials 정리 및 복구 함수
 */
function fixJsonCredentials(jsonString: string): any | null {
  if (!jsonString) return null;
  
  console.log(`📄 JSON Credentials 복구 시작... (원본 길이: ${jsonString.length})`);
  
  try {
    // 1차 시도: 그대로 파싱
    return JSON.parse(jsonString);
  } catch (error) {
    console.log(`⚠️ 1차 JSON 파싱 실패: ${error.message}`);
  }
  
  // 2차 시도: Escape 문자 정리
  let fixedJson = jsonString;
  
  // 잘못된 escape 문자 수정
  fixedJson = fixedJson.replace(/\\"/g, '"');         // \" → "
  fixedJson = fixedJson.replace(/\\\\/g, '\\');       // \\ → \
  fixedJson = fixedJson.replace(/\\n/g, '\\n');       // \n 유지
  
  try {
    return JSON.parse(fixedJson);
  } catch (error) {
    console.log(`⚠️ 2차 JSON 파싱 실패: ${error.message}`);
  }
  
  // 3차 시도: 더 적극적인 정리
  fixedJson = jsonString
    .replace(/\\\\n/g, '\\n')     // \\n → \n
    .replace(/\\\\\\\"/g, '\\"')  // \\\" → \"
    .replace(/\\\\\\\\/g, '\\\\');// \\\\ → \\
  
  try {
    return JSON.parse(fixedJson);
  } catch (error) {
    console.log(`❌ 3차 JSON 파싱 실패: ${error.message}`);
    return null;
  }
}

// 메인 실행
async function main() {
  // 1. 환경변수 확인
  const rawPrivateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;
  const rawJsonCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  
  if (!rawPrivateKey && !rawJsonCredentials) {
    console.log('❌ 필요한 환경변수가 없습니다.');
    return;
  }
  
  // 2. GOOGLE_CLOUD_STORAGE_BUCKET 환경변수 설정
  console.log('📦 GCS Bucket 환경변수 설정...');
  process.env.GOOGLE_CLOUD_STORAGE_BUCKET = 'createtree-upload';
  console.log('✅ GOOGLE_CLOUD_STORAGE_BUCKET = createtree-upload');
  
  // 3. Private Key 복구
  let workingPrivateKey: string | null = null;
  
  if (rawPrivateKey) {
    console.log('\n🔑 GOOGLE_CLOUD_PRIVATE_KEY 복구 시도...');
    workingPrivateKey = reconstructPrivateKey(rawPrivateKey);
    
    if (workingPrivateKey) {
      // OpenSSL 호환성 테스트
      try {
        const keyObject = crypto.createPrivateKey(workingPrivateKey);
        console.log(`✅ Private Key 복구 성공! (타입: ${keyObject.asymmetricKeyType})`);
        
        // 복구된 키를 임시 파일로 저장
        fs.writeFileSync('/tmp/fixed-private-key.pem', workingPrivateKey);
        console.log('💾 복구된 키 저장: /tmp/fixed-private-key.pem');
        
      } catch (error) {
        console.log(`❌ 복구된 Private Key OpenSSL 테스트 실패: ${error.message}`);
        workingPrivateKey = null;
      }
    }
  }
  
  // 4. JSON Credentials 복구
  let workingJsonCredentials: any = null;
  
  if (rawJsonCredentials) {
    console.log('\n📄 JSON Credentials 복구 시도...');
    workingJsonCredentials = fixJsonCredentials(rawJsonCredentials);
    
    if (workingJsonCredentials && workingJsonCredentials.private_key) {
      console.log('✅ JSON Credentials 복구 성공!');
      
      // JSON의 private key도 복구 시도
      const jsonPrivateKey = reconstructPrivateKey(workingJsonCredentials.private_key);
      if (jsonPrivateKey) {
        workingJsonCredentials.private_key = jsonPrivateKey;
        
        // 복구된 JSON을 파일로 저장
        fs.writeFileSync('/tmp/fixed-credentials.json', JSON.stringify(workingJsonCredentials, null, 2));
        console.log('💾 복구된 JSON Credentials 저장: /tmp/fixed-credentials.json');
        
        // 이것이 제일 좋은 방법
        workingPrivateKey = jsonPrivateKey;
      }
    }
  }
  
  // 5. 결과 보고
  console.log('\n📋 복구 결과:');
  
  if (workingPrivateKey) {
    console.log('✅ 사용 가능한 Private Key 발견');
    console.log('🔧 다음 단계:');
    console.log('  1. /tmp/fixed-private-key.pem 또는 /tmp/fixed-credentials.json 사용');
    console.log('  2. gcs-image-storage.ts의 processPrivateKey 함수 업데이트');
    console.log('  3. 환경변수 GOOGLE_CLOUD_STORAGE_BUCKET=createtree-upload 설정');
    
    // GCS 인증 테스트
    console.log('\n🧪 GCS 인증 테스트 준비...');
    const testCredentials = workingJsonCredentials || {
      project_id: process.env.GOOGLE_CLOUD_PROJECT_ID,
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      private_key: workingPrivateKey
    };
    
    fs.writeFileSync('/tmp/test-gcs-auth.json', JSON.stringify(testCredentials, null, 2));
    console.log('💾 GCS 테스트용 credentials 저장: /tmp/test-gcs-auth.json');
    
  } else {
    console.log('❌ Private Key 복구 실패');
    console.log('🔧 수동 해결 방법:');
    console.log('  1. Google Cloud Console에서 새 서비스 계정 키 생성');
    console.log('  2. JSON 파일 다운로드 후 내용을 GOOGLE_APPLICATION_CREDENTIALS_JSON으로 설정');
    console.log('  3. Replit Secrets에서 환경변수 재설정');
  }
}

main().catch(console.error);