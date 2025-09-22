// 🚨 HIPAA 보안 강화: 관리자 전용 보안 마이그레이션 API
// 의료 환경 보안 준수를 위한 관리자 도구 엔드포인트

import express from 'express';
import { requireAuth } from '../middleware/auth';
// validateUserId utility function implementation
function validateUserId(req: any, res: any): number | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return Number(userId);
}
import { db } from '@db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { 
  migrateAllPublicFilesToPrivate, 
  auditPublicFiles, 
  getUBLARecommendations,
  SecurityMigrationResult 
} from '../admin/security-migration';

const router = express.Router();

/**
 * 🔍 보안 감사: 현재 공개 파일 상태 확인
 * 관리자가 보안 위험을 파악할 수 있도록 현재 상태를 보고
 */
router.get('/audit', requireAuth, async (req, res) => {
  try {
    const userId = validateUserId(req, res);
    if (!userId) return;

    // 슈퍼관리자 권한 확인
    const user = await db.query.users.findFirst({
      where: eq(users.id, Number(userId))
    });

    if (!user || user.memberType !== 'superadmin') {
      return res.status(403).json({ 
        error: "슈퍼관리자 권한이 필요합니다.",
        message: "보안 감사는 최고 관리자만 수행할 수 있습니다."
      });
    }

    console.log('🔍 [보안 감사] 관리자 요청:', user.email);

    // 공개 파일 감사 실행
    const auditResult = await auditPublicFiles();
    const ublaRecommendations = getUBLARecommendations();

    const response = {
      success: true,
      audit: auditResult,
      recommendations: {
        immediateAction: auditResult.securityRisk !== 'SECURE' ? 
          '🚨 공개 파일이 발견되었습니다. 즉시 마이그레이션을 실행하세요.' :
          '✅ 현재 보안 상태가 양호합니다.',
        ubla: ublaRecommendations,
        nextSteps: auditResult.publicFiles.length > 0 ? [
          '1. POST /api/admin-security/migrate-to-private 엔드포인트로 마이그레이션 실행',
          '2. UBLA(Uniform Bucket-Level Access) 활성화 고려',
          '3. 정기적인 보안 감사 스케줄 설정'
        ] : [
          '1. UBLA(Uniform Bucket-Level Access) 활성화 고려',
          '2. 정기적인 보안 감사 스케줄 설정'
        ]
      },
      securityStatus: {
        level: auditResult.securityRisk,
        description: getSecurityDescription(auditResult.securityRisk),
        hipaaCompliant: auditResult.securityRisk === 'SECURE'
      },
      message: '🔍 보안 감사 완료'
    };

    console.log('🔍 [보안 감사] 완료:', {
      publicFiles: auditResult.publicFiles.length,
      securityRisk: auditResult.securityRisk
    });

    return res.json(response);

  } catch (error) {
    console.error('🔍 [보안 감사] 오류:', error);
    return res.status(500).json({
      success: false,
      error: "보안 감사 중 오류가 발생했습니다.",
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * 🔒 보안 마이그레이션: 모든 공개 객체를 Private 모드로 전환
 * 의료 환경 HIPAA 준수를 위한 핵심 기능
 */
router.post('/migrate-to-private', requireAuth, async (req, res) => {
  try {
    const userId = validateUserId(req, res);
    if (!userId) return;

    // 슈퍼관리자 권한 확인
    const user = await db.query.users.findFirst({
      where: eq(users.id, Number(userId))
    });

    if (!user || user.memberType !== 'superadmin') {
      return res.status(403).json({ 
        error: "슈퍼관리자 권한이 필요합니다.",
        message: "보안 마이그레이션은 최고 관리자만 실행할 수 있습니다."
      });
    }

    console.log('🔒 [보안 마이그레이션] 시작 - 관리자:', user.email);

    // 실제 마이그레이션 실행
    const migrationResult = await migrateAllPublicFilesToPrivate();

    const response = {
      success: migrationResult.securityStatus !== 'SECURITY_ISSUES',
      migration: migrationResult,
      hipaaCompliance: {
        achieved: migrationResult.securityStatus === 'FULLY_SECURED',
        status: migrationResult.securityStatus,
        description: getSecurityDescription(migrationResult.securityStatus === 'FULLY_SECURED' ? 'SECURE' : 'HIGH')
      },
      postMigrationSteps: [
        '1. 애플리케이션에서 signed URL 접근이 정상 작동하는지 확인',
        '2. 사용자 인터페이스에서 이미지/파일 로딩 테스트',
        '3. UBLA(Uniform Bucket-Level Access) 활성화 고려',
        '4. 정기적인 보안 감사 스케줄 설정'
      ],
      message: migrationResult.securityStatus === 'FULLY_SECURED' ? 
        '🎉 HIPAA 보안 마이그레이션 완료! 모든 파일이 안전하게 보호되었습니다.' :
        '⚠️ 마이그레이션이 부분적으로 완료되었습니다. 오류 내역을 확인하세요.'
    };

    console.log('🔒 [보안 마이그레이션] 완료:', {
      status: migrationResult.securityStatus,
      secured: migrationResult.successfullySecured,
      errors: migrationResult.errors
    });

    return res.json(response);

  } catch (error) {
    console.error('🔒 [보안 마이그레이션] 치명적 오류:', error);
    return res.status(500).json({
      success: false,
      error: "보안 마이그레이션 중 치명적 오류가 발생했습니다.",
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * 📋 UBLA 권장사항 조회
 */
router.get('/ubla-recommendations', requireAuth, async (req, res) => {
  try {
    const userId = validateUserId(req, res);
    if (!userId) return;

    // 관리자 권한 확인 (일반 관리자도 조회 가능)
    const user = await db.query.users.findFirst({
      where: eq(users.id, Number(userId))
    });

    if (!user || (user.memberType !== 'admin' && user.memberType !== 'superadmin')) {
      return res.status(403).json({ 
        error: "관리자 권한이 필요합니다."
      });
    }

    const recommendations = getUBLARecommendations();

    return res.json({
      success: true,
      ubla: recommendations,
      implementation: {
        steps: [
          '1. 현재 버킷의 ACL 상태 백업 (필요 시)',
          '2. gcloud CLI 또는 GCP 콘솔에서 UBLA 활성화',
          '3. IAM 정책으로 액세스 제어 재구성',
          '4. 애플리케이션 테스트 및 검증'
        ],
        considerations: [
          '🔒 UBLA 활성화 시 모든 객체별 ACL이 제거됩니다',
          '📋 이후 액세스 제어는 IAM 정책으로만 가능합니다',
          '🏥 의료 환경에서는 UBLA가 더 안전한 접근 방식입니다',
          '⚠️ 운영 중인 시스템에서는 점진적 적용을 권장합니다'
        ]
      },
      message: '📋 UBLA 권장사항 조회 완료'
    });

  } catch (error) {
    console.error('📋 [UBLA 권장사항] 오류:', error);
    return res.status(500).json({
      success: false,
      error: "UBLA 권장사항 조회 중 오류가 발생했습니다.",
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * 보안 위험도에 따른 설명 텍스트 반환
 */
function getSecurityDescription(risk: string): string {
  switch (risk) {
    case 'SECURE':
      return '✅ 모든 파일이 Private 모드로 보호되어 HIPAA 기준을 충족합니다.';
    case 'LOW':
      return '🟡 소수의 공개 파일이 있습니다. 빠른 시일 내에 보안 처리가 필요합니다.';
    case 'MEDIUM':
      return '🟠 다수의 공개 파일이 발견되었습니다. 즉시 보안 마이그레이션을 실행하세요.';
    case 'HIGH':
      return '🔴 많은 파일이 공개 상태입니다. 의료 데이터 보호를 위해 긴급 조치가 필요합니다.';
    case 'FULLY_SECURED':
      return '🎉 모든 공개 파일이 성공적으로 Private 모드로 전환되었습니다.';
    case 'PARTIAL_SECURED':
      return '⚠️ 일부 파일의 보안 처리가 실패했습니다. 오류 내역을 확인하여 수동 처리가 필요합니다.';
    case 'SECURITY_ISSUES':
      return '❌ 보안 처리 중 오류가 발생했습니다. 시스템 관리자에게 문의하세요.';
    default:
      return '❓ 보안 상태를 확인할 수 없습니다.';
  }
}

export default router;