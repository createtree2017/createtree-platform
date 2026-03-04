import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { db } from '../../db/index';
import { images } from '../../shared/schema';
import { z } from 'zod';
import multer from 'multer';
import { bucket } from '../firebase';
import sharp from 'sharp';
import { fork } from 'child_process';
import path from 'path';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

const saveExtractedImageSchema = z.object({
  title: z.string().optional(),
  sourceImageId: z.number().optional(),
});

router.post('/', requireAuth, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    const validation = saveExtractedImageSchema.safeParse(req.body);
    const title = validation.success && validation.data.title 
      ? validation.data.title 
      : `추출이미지_${Date.now()}`;

    console.log(`🖼️ [이미지 추출] 사용자 ${userId}: 추출 이미지 저장 시작`);

    const timestamp = Date.now();
    const filename = `extracted/${userId}/${timestamp}.png`;
    
    const file = bucket.file(filename);
    
    await file.save(req.file.buffer, {
      metadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: {
          uploadedAt: new Date().toISOString(),
          uploadedBy: userId.toString(),
          type: 'extracted'
        }
      },
      predefinedAcl: 'publicRead',
      resumable: false,
    });

    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    const [newImage] = await db.insert(images).values({
      title,
      style: 'extracted',
      originalUrl: publicUrl,
      transformedUrl: publicUrl,
      thumbnailUrl: publicUrl,
      userId: userId.toString(),
      categoryId: 'extracted',
      metadata: JSON.stringify({
        extractedAt: new Date().toISOString(),
        sourceImageId: validation.success ? validation.data.sourceImageId : null
      })
    }).returning();

    console.log(`✅ [이미지 추출] 이미지 저장 완료: ID ${newImage.id}`);

    return res.json({
      success: true,
      data: {
        id: newImage.id,
        url: publicUrl,
        title: newImage.title,
      }
    });

  } catch (error) {
    console.error('❌ [이미지 추출] 저장 실패:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save extracted image',
    });
  }
});

router.get('/proxy', requireAuth, async (req: Request, res: Response) => {
  try {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'URL parameter required' });
    }

    if (!url.includes('storage.googleapis.com') && !url.includes('createtree')) {
      return res.status(400).json({ success: false, error: 'Only GCS URLs are allowed' });
    }

    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        success: false, 
        error: `Failed to fetch image: ${response.statusText}` 
      });
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    return res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('❌ [이미지 프록시] 실패:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to proxy image',
    });
  }
});

router.post('/auto-fit', requireAuth, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    console.log(`🎯 [자동맞춤] 사용자 ${userId}: 자동 객체 추출 시작`);

    const pngBuffer = await sharp(req.file.buffer)
      .png()
      .toBuffer();

    console.log(`📐 [자동맞춤] 이미지 준비 완료: ${pngBuffer.length} bytes`);

    console.log(`🚀 [자동맞춤] 자식 프로세스에서 배경제거 워커 시작...`);
    const workerPath = path.join(process.cwd(), 'server', 'workers', 'bg-removal.ts');
    
    // 워커에 넘길 base64 데이터 (충돌 방지를 위해 sharp 처리된 순수 버퍼만 넘김)
    const requestBase64 = pngBuffer.toString('base64');
    const requestId = `bg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const base64 = await new Promise<string>((resolve, reject) => {
      // execArgv를 상속하여 tsx 환경을 그대로 워커에 적용
      const worker = fork(workerPath, {
        execArgv: process.execArgv
      });

      let handled = false;
      const timeoutId = setTimeout(() => {
        if (handled) return;
        handled = true;
        worker.kill();
        reject(new Error('워커 처리 시간 초과 (60s)'));
      }, 60000);

      worker.on('message', (message: any) => {
        if (message.id === requestId && !handled) {
          handled = true;
          clearTimeout(timeoutId);
          if (message.type === 'SUCCESS') {
            resolve(message.resultData);
          } else if (message.type === 'ERROR') {
            reject(new Error(message.error || '워커에서 알 수 없는 오류 발생'));
          }
        }
      });

      worker.on('error', (err) => {
        if (handled) return;
        handled = true;
        clearTimeout(timeoutId);
        reject(new Error(`워커 프로세스 오류: ${err.message}`));
      });

      worker.on('exit', (code) => {
        if (handled) return;
        handled = true;
        clearTimeout(timeoutId);
        if (code !== 0 && code !== null) {
          reject(new Error(`워커 비정상 종료 (exit code: ${code})`));
        }
      });

      // 메시지 전송
      worker.send({
        type: 'PROCESS_IMAGE',
        id: requestId,
        imageData: requestBase64
      });
    });

    console.log(`✅ [자동맞춤] 객체 추출 완료 (Worker)`);

    return res.json({
      success: true,
      data: {
        imageData: `data:image/png;base64,${base64}`,
      }
    });

  } catch (error) {
    console.error('❌ [자동맞춤] 실패:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Auto-fit failed',
    });
  }
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const extractedImages = await db.query.images.findMany({
      where: (images, { and, eq }) => and(
        eq(images.userId, userId.toString()),
        eq(images.categoryId, 'extracted')
      ),
      orderBy: (images, { desc }) => [desc(images.createdAt)]
    });

    const result = extractedImages.map(img => ({
      id: img.id,
      title: img.title,
      url: img.transformedUrl || img.originalUrl,
      thumbnailUrl: img.thumbnailUrl || img.transformedUrl || img.originalUrl,
      createdAt: img.createdAt.toISOString(),
    }));

    return res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ [이미지 추출] 목록 조회 실패:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch extracted images',
    });
  }
});

export default router;
