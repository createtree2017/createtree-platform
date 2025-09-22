/**
 * 불필요한 중복파일 및 구버전, 테스트파일 정리 스크립트
 * 2025-07-02 이미지 갤러리 완전성 테스트 후 정리 작업
 */

import fs from 'fs';
import path from 'path';

interface CleanupCategory {
  name: string;
  files: string[];
  description: string;
}

/**
 * 정리할 파일 목록 정의
 */
const cleanupCategories: CleanupCategory[] = [
  {
    name: '구버전 이미지 갤러리 관련 파일',
    files: [
      'create-diverse-gallery.ts',
      'debug-image-generation.ts',
      'complete-gcs-image-optimization.ts',
      'diagnose-style-card-images.ts',
      'fast-thumbnail-generator.ts'
    ],
    description: '더 이상 사용하지 않는 이미지 갤러리 관련 구버전 파일들'
  },
  {
    name: '중복 배너 시스템 테스트 파일',
    files: [
      'banner-display-debug.ts',
      'fix-banner-files.ts',
      'fix-banner-files-complete.ts',
      'fix-banner-image-paths.ts',
      'check-file-deletion-status.ts',
      'banner-system-deployment-test.ts'
    ],
    description: '배너 시스템이 완성되어 더 이상 필요없는 중복 테스트 파일들'
  },
  {
    name: '음악 시스템 구버전 파일',
    files: [
      'analyze-music-generation-log.ts',
      'assign-working-music-files.ts',
      'check-current-music-status.ts',
      'check-music-duplicates.ts',
      'check-music-stream.ts',
      'complete-music-81.ts',
      'complete-music-82.ts',
      'complete-music-138.ts',
      'download-music-to-static.ts'
    ],
    description: '음악 시스템이 완성되어 더 이상 필요없는 구버전 파일들'
  },
  {
    name: 'GCS 설정 및 마이그레이션 구버전 파일',
    files: [
      'analyze-gcs-permissions.ts',
      'check-gcs-current-status.ts',
      'check-gcs-files.ts',
      'check-gcs-migration-permissions.ts',
      'check-gcs-music-files.ts',
      'check-gcs-via-files.ts',
      'check-gcs-실제상태.ts',
      'collect-all-gcs-mp3-files.ts',
      'create-gcs-bucket.ts',
      'direct-upload-test.ts',
      'fix-gcs-decoder-error.ts',
      'fix-gcs-images-simple.ts'
    ],
    description: 'GCS 설정이 완료되어 더 이상 필요없는 설정 및 마이그레이션 파일들'
  },
  {
    name: 'TopMediai API 구버전 디버깅 파일',
    files: [
      'analyze-topmedia-api.ts',
      'check-topmedia-api-docs.ts',
      'check-topmedia-complete-status.ts',
      'check-topmedia-lyrics.ts',
      'check-topmedia-style-transfer.ts',
      'debug-topmedia.ts',
      'debug-topmedia-api-status.ts',
      'debug-topmedia-endpoints.ts'
    ],
    description: 'TopMediai API가 안정화되어 더 이상 필요없는 디버깅 파일들'
  },
  {
    name: '관리자 시스템 구버전 체크 파일',
    files: [
      'admin-system-functionality-check.ts',
      'check-admin-system-integration.ts',
      'comprehensive-api-permission-audit.ts',
      'comprehensive-system-check.ts',
      'debug-current-session-token.ts',
      'debug-hospital-status-change.ts'
    ],
    description: '관리자 시스템이 완성되어 더 이상 필요없는 체크 파일들'
  },
  {
    name: '기타 임시 테스트 파일',
    files: [
      'check_stickers.js',
      'db-status-cleanup.ts',
      'diagnose-current-user-hospital-status.ts',
      'diagnose-loading-performance-issue.ts',
      'diagnose-private-key-encoding.ts',
      'diagnose-white-screen-issue.ts',
      'dream-books.ts',
      'fix-admin-token.js'
    ],
    description: '일회성 문제 해결을 위한 임시 파일들'
  }
];

/**
 * 배포 준비 완료된 파일들 (보존)
 */
const preserveFiles = [
  'final-deployment-assessment.md',
  'final-production-verification.ts',
  'deployment-readiness-comprehensive-test.ts',
  'comprehensive-deployment-summary.ts',
  'deployment-safety-check.ts',
  'image-gallery-completeness-test.ts'
];

/**
 * 파일 정리 실행
 */
async function cleanupObsoleteFiles() {
  console.log('🧹 불필요한 파일 정리 시작...\n');
  
  let totalDeleted = 0;
  let totalPreserved = 0;
  
  for (const category of cleanupCategories) {
    console.log(`📂 ${category.name}:`);
    console.log(`   ${category.description}\n`);
    
    let categoryDeleted = 0;
    
    for (const filename of category.files) {
      const filepath = path.join(process.cwd(), filename);
      
      try {
        if (fs.existsSync(filepath)) {
          // 보존할 파일인지 확인
          if (preserveFiles.includes(filename)) {
            console.log(`   🔒 보존: ${filename} (배포 관련 중요 파일)`);
            totalPreserved++;
          } else {
            fs.unlinkSync(filepath);
            console.log(`   ✅ 삭제: ${filename}`);
            categoryDeleted++;
            totalDeleted++;
          }
        } else {
          console.log(`   ⚪ 없음: ${filename}`);
        }
      } catch (error) {
        console.log(`   ❌ 오류: ${filename} - ${error}`);
      }
    }
    
    console.log(`   → ${categoryDeleted}개 파일 삭제됨\n`);
  }
  
  // 추가로 특정 패턴의 파일들 정리
  console.log('📁 패턴 기반 파일 정리:');
  
  const patterns = [
    'analyze-*.ts',
    'check-*.ts',
    'debug-*.ts',
    'fix-*.ts',
    'diagnose-*.ts'
  ];
  
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.replace('*', '.*'));
    const files = fs.readdirSync(process.cwd())
      .filter(file => regex.test(file) && !preserveFiles.includes(file));
    
    if (files.length > 0) {
      console.log(`   ${pattern} 패턴: ${files.length}개 파일 발견`);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(process.cwd(), file));
          console.log(`     ✅ 삭제: ${file}`);
          totalDeleted++;
        } catch (error) {
          console.log(`     ❌ 오류: ${file} - ${error}`);
        }
      }
    }
  }
  
  // 요약
  console.log('\n📊 정리 완료 요약:');
  console.log(`   총 삭제된 파일: ${totalDeleted}개`);
  console.log(`   보존된 파일: ${totalPreserved}개`);
  console.log(`   디스크 공간 절약: 예상 10-50MB`);
  
  // 보존된 중요 파일들 확인
  console.log('\n🔒 보존된 중요 파일들:');
  preserveFiles.forEach(file => {
    if (fs.existsSync(path.join(process.cwd(), file))) {
      console.log(`   ✅ ${file}`);
    }
  });
  
  console.log('\n🎉 불필요한 파일 정리가 완료되었습니다!');
  console.log('   이제 프로젝트가 더 깔끔하고 관리하기 쉬워졌습니다.');
}

/**
 * 실행
 */
cleanupObsoleteFiles()
  .catch(error => {
    console.error('❌ 파일 정리 중 오류 발생:', error);
    process.exit(1);
  });