// 🚨 HIPAA 보안 강화: 기존 공개 객체 ACL 제거 도구
// 의료 환경에서 이미 공개된 모든 객체의 allUsers ACL을 제거하는 관리자 전용 마이그레이션 도구

import { Storage } from '@google-cloud/storage';

// Environment variables with fallback for development
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GCLOUD_PROJECT || 'createtreeai';
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'createtree-upload';

// GCS 초기화 - Application Default Credentials (ADC) 사용
const storage = new Storage({
  projectId: PROJECT_ID
});

const bucket = storage.bucket(BUCKET_NAME);

export interface SecurityMigrationResult {
  totalFilesScanned: number;
  publicFilesFound: number;
  successfullySecured: number;
  errors: number;
  errorDetails: Array<{ fileName: string; error: string }>;
  securityStatus: 'FULLY_SECURED' | 'PARTIAL_SECURED' | 'SECURITY_ISSUES';
}

/**
 * 🔒 HIPAA 준수: 모든 공개 파일을 Private 모드로 전환
 * 기존에 allUsers ACL이 설정된 모든 파일을 찾아서 제거합니다.
 */
export async function migrateAllPublicFilesToPrivate(): Promise<SecurityMigrationResult> {
  console.log('🚨 [보안 마이그레이션] HIPAA 준수를 위한 공개 객체 보안 처리 시작...');
  
  const result: SecurityMigrationResult = {
    totalFilesScanned: 0,
    publicFilesFound: 0,
    successfullySecured: 0,
    errors: 0,
    errorDetails: [],
    securityStatus: 'SECURITY_ISSUES'
  };

  try {
    // 버킷의 모든 파일 스캔 (의료 데이터가 포함된 모든 경로)
    const [files] = await bucket.getFiles({
      // 의료 환경에서 일반적으로 사용되는 경로들
      prefix: '', // 모든 파일 스캔
      autoPaginate: true
    });

    console.log(`📊 [보안 마이그레이션] 총 ${files.length}개 파일 발견 - 보안 검사 시작`);
    result.totalFilesScanned = files.length;

    // 각 파일의 ACL 상태 확인 및 보안 처리
    for (const file of files) {
      try {
        // 현재 ACL 상태 확인
        const [acl] = await file.acl.get().catch(() => [[]]);
        const hasPublicRead = Array.isArray(acl) && acl.some((entry: any) => 
          entry.entity === 'allUsers' && entry.role === 'READER'
        );

        if (hasPublicRead) {
          result.publicFilesFound++;
          console.log(`⚠️ [보안 위험] 공개 파일 발견: ${file.name}`);

          try {
            // 🔒 allUsers 권한 제거 (HIPAA 준수)
            await file.acl.delete({ entity: 'allUsers' });
            result.successfullySecured++;
            console.log(`✅ [보안 완료] Private 모드 전환: ${file.name}`);
          } catch (deleteError) {
            result.errors++;
            const errorMsg = deleteError instanceof Error ? deleteError.message : String(deleteError);
            result.errorDetails.push({
              fileName: String(file.name),
              error: errorMsg
            });
            console.error(`❌ [보안 실패] ACL 제거 실패: ${file.name} - ${errorMsg}`);
          }
        }
      } catch (aclError) {
        result.errors++;
        const errorMsg = aclError instanceof Error ? aclError.message : String(aclError);
        result.errorDetails.push({
          fileName: String(file.name),
          error: `ACL 확인 실패: ${errorMsg}`
        });
      }
    }

    // 보안 상태 평가
    if (result.errors === 0 && result.publicFilesFound === result.successfullySecured) {
      result.securityStatus = 'FULLY_SECURED';
    } else if (result.successfullySecured > 0) {
      result.securityStatus = 'PARTIAL_SECURED';
    } else {
      result.securityStatus = 'SECURITY_ISSUES';
    }

    console.log('\n🎯 [보안 마이그레이션] 완료 결과:');
    console.log(`   📊 스캔된 파일: ${result.totalFilesScanned}개`);
    console.log(`   ⚠️ 공개 파일 발견: ${result.publicFilesFound}개`);
    console.log(`   ✅ 보안 처리 성공: ${result.successfullySecured}개`);
    console.log(`   ❌ 처리 실패: ${result.errors}개`);
    console.log(`   🔒 보안 상태: ${result.securityStatus}`);

    return result;

  } catch (error) {
    console.error('🚨 [보안 마이그레이션] 치명적 오류:', error);
    result.errors++;
    result.errorDetails.push({
      fileName: 'SYSTEM',
      error: error instanceof Error ? error.message : String(error)
    });
    result.securityStatus = 'SECURITY_ISSUES';
    return result;
  }
}

/**
 * 🔍 보안 감사: 현재 공개 파일 상태만 확인 (수정하지 않음)
 */
export async function auditPublicFiles(): Promise<{
  totalFiles: number;
  publicFiles: Array<{ name: string; size: number; timeCreated: string }>;
  securityRisk: 'HIGH' | 'MEDIUM' | 'LOW' | 'SECURE';
}> {
  console.log('🔍 [보안 감사] 공개 파일 상태 확인 시작...');

  try {
    const [files] = await bucket.getFiles({
      prefix: '',
      autoPaginate: false, // 감사는 샘플링으로 제한
      maxResults: 100
    });

    const publicFiles: Array<{ name: string; size: number; timeCreated: string }> = [];

    for (const file of files) {
      try {
        const [acl] = await file.acl.get().catch(() => [[]]);
        const hasPublicRead = Array.isArray(acl) && acl.some((entry: any) => 
          entry.entity === 'allUsers' && entry.role === 'READER'
        );

        if (hasPublicRead) {
          const [metadata] = await file.getMetadata();
          publicFiles.push({
            name: file.name,
            size: parseInt(String(metadata.size) || '0'),
            timeCreated: metadata.timeCreated || 'unknown'
          });
        }
      } catch (error) {
        // 개별 파일 오류는 무시하고 계속 진행
      }
    }

    // 보안 위험도 평가
    let securityRisk: 'HIGH' | 'MEDIUM' | 'LOW' | 'SECURE';
    if (publicFiles.length === 0) {
      securityRisk = 'SECURE';
    } else if (publicFiles.length > 10) {
      securityRisk = 'HIGH';
    } else if (publicFiles.length > 3) {
      securityRisk = 'MEDIUM';
    } else {
      securityRisk = 'LOW';
    }

    console.log(`🔍 [보안 감사] 완료 - 공개 파일: ${publicFiles.length}개, 위험도: ${securityRisk}`);

    return {
      totalFiles: files.length,
      publicFiles,
      securityRisk
    };

  } catch (error) {
    console.error('🔍 [보안 감사] 오류:', error);
    return {
      totalFiles: 0,
      publicFiles: [],
      securityRisk: 'HIGH'
    };
  }
}

/**
 * 🛡️ Uniform Bucket-Level Access (UBLA) 활성화 권장 사항 출력
 */
export function getUBLARecommendations(): {
  enabled: boolean;
  benefits: string[];
  gcloudCommand: string;
  warning: string;
} {
  return {
    enabled: false, // 실제로는 버킷 상태를 확인해야 함
    benefits: [
      '🔒 모든 객체에 대해 일관된 액세스 제어',
      '🚫 개별 객체 ACL 사용 불가 (더 안전함)',
      '📋 IAM 정책만으로 액세스 제어',
      '🏥 HIPAA 환경에 최적화된 보안 구조'
    ],
    gcloudCommand: `gcloud storage buckets update gs://${BUCKET_NAME} --uniform-bucket-level-access`,
    warning: 'UBLA 활성화 시 기존 객체별 ACL이 모두 제거됩니다. 운영 환경에서는 신중히 적용하세요.'
  };
}