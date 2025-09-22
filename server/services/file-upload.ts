/**
 * Phase 6: 파일 업로드 서비스
 * 참여형 마일스톤 신청 첨부파일 관리
 */

import { db } from '@db';
import { milestoneApplicationFiles, milestoneApplications } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import path from 'path';
import fs from 'fs/promises';

// 허용되는 파일 타입 (MIME 타입)
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
];

// 최대 파일 크기 (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * 파일 타입 검증
 */
export function validateFileType(mimeType: string): boolean {
  return ALLOWED_FILE_TYPES.includes(mimeType);
}

/**
 * 파일 크기 검증
 */
export function validateFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE;
}

/**
 * 안전한 파일명 생성
 */
export function generateSafeFileName(originalName: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const extension = path.extname(originalName);
  const baseName = path.basename(originalName, extension)
    .replace(/[^a-zA-Z0-9가-힣]/g, '_') // 특수문자를 언더스코어로 변경
    .substring(0, 50); // 최대 50자 제한
  
  return `${baseName}_${timestamp}_${randomSuffix}${extension}`;
}

/**
 * 마일스톤 신청에 파일 추가
 */
export async function addFileToApplication(data: {
  applicationId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  uploadedBy: number;
}) {
  // 신청 존재 여부 확인
  const application = await db.query.milestoneApplications.findFirst({
    where: eq(milestoneApplications.id, data.applicationId)
  });

  if (!application) {
    throw new Error('마일스톤 신청을 찾을 수 없습니다.');
  }

  // 파일 유효성 검증
  if (!validateFileType(data.fileType)) {
    throw new Error('허용되지 않은 파일 타입입니다.');
  }

  if (!validateFileSize(data.fileSize)) {
    throw new Error('파일 크기가 10MB를 초과합니다.');
  }

  // 파일 정보 저장
  const [newFile] = await db.insert(milestoneApplicationFiles).values({
    applicationId: data.applicationId,
    fileName: data.fileName,
    fileType: data.fileType,
    fileSize: data.fileSize,
    filePath: data.filePath,
    uploadedBy: data.uploadedBy
  }).returning();

  return newFile;
}

/**
 * 신청의 모든 파일 조회
 */
export async function getApplicationFiles(applicationId: number) {
  return await db.query.milestoneApplicationFiles.findMany({
    where: and(
      eq(milestoneApplicationFiles.applicationId, applicationId),
      eq(milestoneApplicationFiles.isActive, true)
    ),
    with: {
      uploadedByUser: {
        columns: {
          id: true,
          username: true
        }
      }
    },
    orderBy: (files, { desc }) => [desc(files.uploadedAt)]
  });
}

/**
 * 파일 삭제 (소프트 삭제)
 */
export async function deleteFile(fileId: number, userId: number) {
  // 파일 존재 여부 및 소유권 확인
  const file = await db.query.milestoneApplicationFiles.findFirst({
    where: eq(milestoneApplicationFiles.id, fileId),
    with: {
      application: {
        columns: {
          userId: true
        }
      }
    }
  });

  if (!file) {
    throw new Error('파일을 찾을 수 없습니다.');
  }

  // 파일 업로드자 또는 신청자만 삭제 가능
  if (file.uploadedBy !== userId && file.application.userId !== userId) {
    throw new Error('파일을 삭제할 권한이 없습니다.');
  }

  // 소프트 삭제
  await db.update(milestoneApplicationFiles)
    .set({ isActive: false })
    .where(eq(milestoneApplicationFiles.id, fileId));

  return { success: true, message: '파일이 삭제되었습니다.' };
}

/**
 * 파일 물리적 삭제 (관리자용)
 */
export async function deleteFilePhysically(fileId: number) {
  const file = await db.query.milestoneApplicationFiles.findFirst({
    where: eq(milestoneApplicationFiles.id, fileId)
  });

  if (!file) {
    throw new Error('파일을 찾을 수 없습니다.');
  }

  try {
    // 물리적 파일 삭제
    if (file.filePath.startsWith('/')) {
      // 로컬 파일 경로인 경우
      await fs.unlink(file.filePath);
    }
    // GCS URL인 경우 별도 처리 필요 (추후 구현)

    // DB에서 완전 삭제
    await db.delete(milestoneApplicationFiles)
      .where(eq(milestoneApplicationFiles.id, fileId));

    return { success: true, message: '파일이 물리적으로 삭제되었습니다.' };
  } catch (error) {
    console.error('파일 삭제 오류:', error);
    throw new Error('파일 삭제에 실패했습니다.');
  }
}

/**
 * 신청별 파일 통계
 */
export async function getApplicationFileStats(applicationId: number) {
  const files = await db.query.milestoneApplicationFiles.findMany({
    where: and(
      eq(milestoneApplicationFiles.applicationId, applicationId),
      eq(milestoneApplicationFiles.isActive, true)
    ),
    columns: {
      fileSize: true,
      fileType: true
    }
  });

  const totalSize = files.reduce((sum, file) => sum + file.fileSize, 0);
  const fileCount = files.length;
  const typeStats = files.reduce((acc, file) => {
    acc[file.fileType] = (acc[file.fileType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalFiles: fileCount,
    totalSize,
    totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
    typeStats
  };
}