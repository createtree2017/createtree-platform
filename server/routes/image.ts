import { Router } from 'express';
import { storage } from '../storage';
import { requireAuth } from '../middleware/auth';
import { db } from '@db';
import { images } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { bucket } from '../firebase';

const router = Router();

/**
 * 이미지 URL을 공개 URL로 변환
 */
function generatePublicUrl(imagePath: string): string | null {
  try {
    if (!imagePath) return null;
    
    // 이미 HTTP URL인 경우 그대로 반환
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    
    // 로컬 경로인 경우 GCS 공개 URL로 변환 시도
    if (imagePath.startsWith('/uploads/')) {
      const pathParts = imagePath.split('/');
      const filename = pathParts[pathParts.length - 1];
      const gcsPath = `images/general/system/${filename}`;
      return `https://storage.googleapis.com/${bucket.name}/${gcsPath}`;
    }
    
    // GCS 경로인 경우 공개 URL 생성
    if (imagePath.startsWith('gs://')) {
      return imagePath.replace(`gs://${bucket.name}/`, `https://storage.googleapis.com/${bucket.name}/`);
    }
    
    // 일반 경로인 경우 공개 URL 생성
    return `https://storage.googleapis.com/${bucket.name}/${imagePath}`;
  } catch (error) {
    console.error('GCS 공개 URL 생성 실패:', error);
    return null;
  }
}

// 이미지 목록 조회 API (간단한 버전)
router.get('/list', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: '인증 필요' });
    }

    const userImages = await db.select()
      .from(images)
      .where(eq(images.userId, String(userId)))
      .orderBy(desc(images.createdAt))
      .limit(20);

    // 공개 URL로 변환
    const processedImages = userImages.map((image) => {
      const publicTransformedUrl = generatePublicUrl(image.transformedUrl || '');
      const publicThumbnailUrl = generatePublicUrl(image.thumbnailUrl || '');
      
      return {
        ...image,
        transformedUrl: publicTransformedUrl || image.transformedUrl,
        thumbnailUrl: publicThumbnailUrl || image.thumbnailUrl,
        url: publicThumbnailUrl || image.thumbnailUrl
      };
    });

    res.json({ images: processedImages });
  } catch (error) {
    console.error('이미지 목록 조회 오류:', error);
    res.status(500).json({ error: '이미지 목록을 불러오는 중 오류가 발생했습니다.' });
  }
});

// 이미지 상세 정보 조회 API
router.get('/:id', async (req, res) => {
  try {
    const imageId = parseInt(req.params.id);
    console.log(`🔍 이미지 상세 조회 시작: ID ${imageId}`);
    
    if (isNaN(imageId)) {
      console.log('❌ 유효하지 않은 이미지 ID');
      return res.status(400).json({ error: '유효하지 않은 이미지 ID입니다.' });
    }
    
    // 데이터베이스에서 직접 조회
    const image = await db.query.images.findFirst({
      where: eq(images.id, imageId)
    });
    
    console.log(`🔍 DB 조회 결과:`, image ? { id: image.id, title: image.title } : 'null');
    
    if (!image) {
      console.log('❌ 이미지를 찾을 수 없음');
      return res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
    }
    
    // 이미지 메타데이터가 문자열이면 JSON으로 파싱
    let metadata = {};
    if (image.metadata && typeof image.metadata === 'string') {
      try {
        metadata = JSON.parse(image.metadata);
      } catch (err) {
        console.error('메타데이터 파싱 오류:', err);
      }
    } else if (image.metadata) {
      metadata = image.metadata;
    }
    
    // transformedUrl을 그대로 사용 (이미 GCS URL이어야 함)
    const transformedUrl = image.transformedUrl;
    const originalUrl = image.originalUrl;

    // 응답 객체 형식화
    const response = {
      id: image.id,
      title: image.title,
      description: '', // 빈 문자열로 기본 설정
      style: image.style,
      originalUrl: originalUrl,
      transformedUrl: transformedUrl,
      createdAt: image.createdAt.toISOString(),
      metadata
    };
    
    console.log('✅ 이미지 상세 정보 API 응답:', {
      id: image.id,
      title: image.title,
      transformedUrl,
      originalUrl: image.originalUrl
    });
    
    res.json(response);
  } catch (error) {
    console.error('이미지 상세 정보 조회 오류:', error);
    res.status(500).json({ error: '이미지 상세 정보를 불러오는 중 오류가 발생했습니다.' });
  }
});

// 이미지 삭제 API - 인증 미들웨어 적용
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const imageId = parseInt(req.params.id);
    console.log(`🔍 삭제 요청 시작: ID ${imageId}`);
    
    if (isNaN(imageId)) {
      console.log('❌ 유효하지 않은 이미지 ID');
      return res.status(400).json({ error: '유효하지 않은 이미지 ID입니다.' });
    }
    
    // 인증된 사용자 정보 가져오기
    const userData = req.user as any;
    console.log(`🔍 인증된 사용자 정보:`, userData);
    
    const userId = userData.userId || userData.id;
    console.log(`🔍 사용자 ID: ${userId}`);
    
    // 이미지 소유자 확인
    const image = await storage.getImageById(imageId);
    console.log(`🔍 이미지 조회 결과:`, image ? { id: image.id, userId: image.userId } : 'null');
    
    if (!image) {
      console.log('❌ 이미지를 찾을 수 없음');
      return res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
    }
    
    console.log(`🔍 권한 확인: 이미지 소유자 ${image.userId} vs 요청자 ${userId}`);
    if (image.userId !== userId) {
      console.log('❌ 삭제 권한 없음');
      return res.status(403).json({ error: '이미지를 삭제할 권한이 없습니다.' });
    }
    
    // 이미지 삭제
    console.log(`🗑️ 삭제 실행 중: ID ${imageId}`);
    await storage.deleteImage(imageId);
    
    console.log(`✅ 이미지 삭제 완료: ID ${imageId}, 사용자 ${userId}`);
    
    res.json({ 
      success: true, 
      message: '이미지가 성공적으로 삭제되었습니다',
      deletedId: imageId 
    });
    
  } catch (error) {
    console.error('❌ 이미지 삭제 오류:', error);
    res.status(500).json({ error: '이미지 삭제 중 오류가 발생했습니다' });
  }
});

// 이미지 다운로드 API
router.get('/:id/download', async (req, res) => {
  try {
    const imageId = parseInt(req.params.id);
    
    if (isNaN(imageId)) {
      return res.status(400).json({ error: '유효하지 않은 이미지 ID입니다.' });
    }
    
    // 이미지 정보 조회
    const image = await storage.getImageById(imageId);
    
    if (!image) {
      return res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
    }
    
    // 변환된 이미지 URL 확인
    if (!image.transformedUrl) {
      return res.status(404).json({ error: '이미지 URL이 유효하지 않습니다.' });
    }
    
    // 다운로드할 파일명 설정
    const filename = `image-${imageId}.jpg`;
    
    console.log(`[이미지 다운로드] ID: ${imageId}, URL: ${image.transformedUrl.substring(0, 50)}...`);
    
    // base64 데이터인지 확인
    if (image.transformedUrl.startsWith('data:')) {
      console.log('✅ Base64 데이터 감지됨. 처리 중...');
      try {
        // data:image/png;base64,... 형태에서 실제 base64 데이터 추출
        const base64Data = image.transformedUrl.split(',')[1];
        if (!base64Data) {
          throw new Error('Base64 데이터를 찾을 수 없습니다');
        }
        
        const buffer = Buffer.from(base64Data, 'base64');
        console.log('Base64 버퍼 크기:', buffer.length, 'bytes');
        
        // MIME 타입 추출
        const mimeMatch = image.transformedUrl.match(/data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        console.log('MIME 타입:', mimeType);
        
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        console.log('✅ Base64 이미지 전송 완료');
        return res.send(buffer);
      } catch (base64Error) {
        console.error('❌ Base64 데이터 처리 실패:', base64Error);
        return res.status(500).json({ error: "Base64 데이터 처리 중 오류가 발생했습니다." });
      }
    }
    // URL이 로컬 파일 경로인지 확인
    else if (image.transformedUrl.startsWith('/') || image.transformedUrl.startsWith('./')) {
      // 로컬 파일 처리
      const filePath = path.resolve(process.cwd(), image.transformedUrl.replace(/^\//, ''));
      
      // 파일 존재 여부 확인
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: '이미지 파일을 찾을 수 없습니다.' });
      }
      
      // Content-Type 및 Content-Disposition 헤더 설정
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // 파일 스트림 전송
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } 
    // URL이 외부 URL인 경우
    else if (image.transformedUrl.startsWith('http')) {
      try {
        // 외부 URL에서 이미지 가져오기
        const response = await fetch(image.transformedUrl);
        
        if (!response.ok) {
          return res.status(response.status).json({ 
            error: `외부 이미지 서버 오류: ${response.statusText}` 
          });
        }
        
        // 응답 헤더 설정
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        // 이미지 데이터를 바로 응답으로 전달
        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
      } catch (error) {
        console.error('외부 이미지 다운로드 오류:', error);
        return res.status(500).json({ error: '이미지 다운로드 중 오류가 발생했습니다.' });
      }
    } else {
      return res.status(400).json({ error: '지원하지 않는 이미지 URL 형식입니다.' });
    }
  } catch (error) {
    console.error('이미지 다운로드 오류:', error);
    res.status(500).json({ error: '이미지 다운로드 중 오류가 발생했습니다.' });
  }
});

export default router;