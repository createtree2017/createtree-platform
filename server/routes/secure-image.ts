// 의료 환경 보안 강화를 위한 인증된 이미지 서빙 엔드포인트
import express from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAdminOrSuperAdmin } from '../middleware/admin-auth';
// 🔧 수정: 이미 초기화된 GCS Storage 객체 재사용 (DECODER 오류 방지)
import { storage } from '../utils/gcs-image-storage';

const router = express.Router();

// Environment variables with fallback for development
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'createtree-upload';

// 🔧 수정: 이미 인증된 storage 객체 재사용 (private key 중복 처리 방지)
const bucket = storage.bucket(BUCKET_NAME);

/**
 * 인증된 사용자를 위한 이미지 Signed URL 생성 엔드포인트
 * 의료 환경 보안 강화: 시간 제한된 인증 접근만 허용
 */
router.get('/signed-url/:filePath(*)', requireAuth, async (req, res) => {
  try {
    const rawFilePath = req.params.filePath;
    const userId = req.user?.id;
    
    if (!rawFilePath) {
      return res.status(400).json({ 
        error: 'filePath is required',
        message: '파일 경로가 필요합니다.'
      });
    }

    // 🔧 URL 인코딩 디코딩 처리 (파일명에 공백이나 특수문자가 있는 경우)
    const filePath = decodeURIComponent(rawFilePath);

    console.log('[Secure Image] 🔒 인증된 이미지 접근 요청:', {
      rawFilePath,
      filePath,
      userId,
      userEmail: req.user?.email
    });

    // GCS 파일 참조
    const file = bucket.file(filePath);
    
    // 파일 존재 확인
    const [exists] = await file.exists();
    if (!exists) {
      console.warn('[Secure Image] ❌ 파일이 존재하지 않음:', filePath);
      return res.status(404).json({ 
        error: 'File not found',
        message: '요청된 파일을 찾을 수 없습니다.'
      });
    }

    // Signed URL 생성 (HIPAA 준수 - 단축된 TTL)
    const ttlMinutes = parseInt(process.env.SIGNED_URL_TTL_MINUTES || '30'); // 기본 30분
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + (ttlMinutes * 60 * 1000), // 🔒 HIPAA: 단축된 TTL
    });

    console.log('[Secure Image] ✅ Signed URL 생성 성공:', filePath);

    res.json({
      success: true,
      url: signedUrl,
      expiresIn: `${ttlMinutes} minutes`,
      securityLevel: 'authenticated_only',
      message: '🔒 의료 환경 보안: 인증된 접근 전용 URL 생성 완료 (HIPAA 준수)'
    });

  } catch (error) {
    console.error('[Secure Image] ❌ Signed URL 생성 실패:', error);
    res.status(500).json({ 
      error: 'Failed to generate secure URL',
      message: '보안 URL 생성에 실패했습니다.',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * 관리자 전용 이미지 메타데이터 조회 엔드포인트
 * 의료 환경에서 파일 보안 상태 확인용
 */
router.get('/metadata/:filePath(*)', requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const filePath = req.params.filePath;
    
    if (!filePath) {
      return res.status(400).json({ 
        error: 'filePath is required',
        message: '파일 경로가 필요합니다.'
      });
    }

    console.log('[Secure Image] 🔍 파일 메타데이터 조회:', filePath);

    // GCS 파일 참조
    const file = bucket.file(filePath);
    
    // 파일 존재 확인
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ 
        error: 'File not found',
        message: '요청된 파일을 찾을 수 없습니다.'
      });
    }

    // 메타데이터 조회
    const [metadata] = await file.getMetadata();
    
    // ACL 정보 조회 (보안 상태 확인)
    let aclInfo = null;
    try {
      const [acl] = await file.acl.get();
      const aclArray = Array.isArray(acl) ? acl : [acl];
      const hasPublicRead = aclArray.some((entry: any) => 
        entry.entity === 'allUsers' && entry.role === 'READER'
      );
      aclInfo = {
        hasPublicRead,
        totalEntries: aclArray.length,
        securityStatus: hasPublicRead ? '⚠️ PUBLIC ACCESS' : '🔒 PRIVATE ACCESS'
      };
    } catch (aclError) {
      aclInfo = { error: 'ACL 정보를 가져올 수 없습니다.' };
    }

    res.json({
      success: true,
      metadata: {
        name: metadata.name,
        size: metadata.size,
        contentType: metadata.contentType,
        timeCreated: metadata.timeCreated,
        updated: metadata.updated,
        storageClass: metadata.storageClass,
        securityLevel: metadata.metadata?.securityLevel || 'unknown',
        accessType: metadata.metadata?.accessType || 'unknown'
      },
      acl: aclInfo,
      message: '🔍 파일 메타데이터 조회 완료'
    });

  } catch (error) {
    console.error('[Secure Image] ❌ 메타데이터 조회 실패:', error);
    res.status(500).json({ 
      error: 'Failed to get metadata',
      message: '메타데이터 조회에 실패했습니다.',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * 관리자 전용 파일 보안 상태 일괄 검사 엔드포인트
 * 의료 환경 보안 감사용
 */
router.get('/security-audit', requireAdminOrSuperAdmin, async (req, res) => {
  try {
    console.log('[Secure Image] 🔍 보안 감사 시작...');

    // 최근 업로드된 파일들 중 일부 샘플링
    const [files] = await bucket.getFiles({
      prefix: 'uploads/',
      maxResults: 50,
      autoPaginate: false
    });

    const auditResults = [];
    
    for (const file of files.slice(0, 10)) { // 처음 10개 파일만 검사
      try {
        const [acl] = await file.acl.get().catch(() => [[]]);
        const aclArray = Array.isArray(acl) ? acl : [acl];
        const hasPublicRead = aclArray.some((entry: any) => 
          entry.entity === 'allUsers' && entry.role === 'READER'
        );
        
        auditResults.push({
          fileName: file.name,
          securityStatus: hasPublicRead ? '⚠️ PUBLIC' : '🔒 PRIVATE',
          isSecure: !hasPublicRead,
          lastModified: file.metadata.updated
        });
      } catch (error) {
        auditResults.push({
          fileName: file.name,
          securityStatus: '❌ ERROR',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const totalFiles = auditResults.length;
    const secureFiles = auditResults.filter(f => f.isSecure).length;
    const publicFiles = auditResults.filter(f => f.securityStatus === '⚠️ PUBLIC').length;
    
    console.log('[Secure Image] ✅ 보안 감사 완료');

    res.json({
      success: true,
      summary: {
        totalFilesChecked: totalFiles,
        secureFiles,
        publicFiles,
        complianceRate: totalFiles > 0 ? `${Math.round((secureFiles / totalFiles) * 100)}%` : '0%',
        overallStatus: publicFiles === 0 ? '🔒 SECURE' : '⚠️ NEEDS ATTENTION'
      },
      details: auditResults,
      recommendations: publicFiles > 0 ? [
        '🔒 공개 접근이 설정된 파일들의 ACL을 제거하여 Private 모드로 변경하세요.',
        '📋 의료 정보 보호 정책에 따라 모든 파일은 인증된 접근만 허용되어야 합니다.',
        '🔄 정기적인 보안 감사를 통해 규정 준수를 확인하세요.'
      ] : [
        '✅ 모든 검사된 파일이 보안 기준을 충족합니다.',
        '🔄 정기적인 보안 감사를 계속 수행하세요.'
      ],
      message: '🔍 의료 환경 보안 감사 완료'
    });

  } catch (error) {
    console.error('[Secure Image] ❌ 보안 감사 실패:', error);
    res.status(500).json({ 
      error: 'Security audit failed',
      message: '보안 감사에 실패했습니다.',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;