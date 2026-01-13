import { Router, type Request, type Response } from "express";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { storage } from "../storage";
import { images, music } from "../../shared/schema";
import { requireAuth } from "../middleware/auth";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db/index";

const router = Router();

const convertSignedUrlToDirectUrl = (url: string): string => {
  if (!url) return url;

  if (url.includes('GoogleAccessId=') || url.includes('Signature=')) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      if (pathname.includes('/createtree-upload/')) {
        const filePath = pathname.substring(pathname.indexOf('/createtree-upload/') + '/createtree-upload/'.length);
        const directUrl = `https://storage.googleapis.com/createtree-upload/${filePath}`;
        console.log(`[URL 변환] SignedURL → 직접 URL: ${directUrl}`);
        return directUrl;
      }
    } catch (error) {
      console.log(`[URL 변환] 파싱 오류, 원본 유지: ${url}`);
    }
  }

  return url;
};

const generatePublicUrl = (imagePath: string): string | null => {
  try {
    if (!imagePath) return null;

    if (imagePath.startsWith('http')) {
      return convertSignedUrlToDirectUrl(imagePath);
    }

    if (imagePath.startsWith('gs://')) {
      const bucketName = imagePath.split('/')[2];
      const filePath = imagePath.split('/').slice(3).join('/');
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`;
      return publicUrl;
    }

    if (imagePath.startsWith('images/') || imagePath.includes('.webp')) {
      const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
      const publicUrl = `https://storage.googleapis.com/createtree-upload/${cleanPath}`;
      return publicUrl;
    }

    if (imagePath.startsWith('/static/')) {
      return imagePath;
    }

    if (imagePath.startsWith('/uploads/')) {
      return imagePath;
    }

    if (imagePath.startsWith('collages/')) {
      return `https://storage.googleapis.com/createtree-upload/${imagePath}`;
    }

    const publicUrl = `https://storage.googleapis.com/createtree-upload/${imagePath}`;
    return publicUrl;
  } catch (error) {
    console.error('GCS 공개 URL 생성 실패:', error);
    return null;
  }
};

const favoriteToggleSchema = z.object({
  itemId: z.number().int().positive(),
  type: z.enum(["music", "image"]),
});

const mediaShareSchema = z.object({
  id: z.number().int(),
  type: z.enum(["music", "image"]),
});

router.get("/gallery", requireAuth, async (req: Request, res: Response) => {
  try {
    const filter = req.query.filter as string;
    const userId = req.user!.id;
    console.log(`[갤러리 API] 사용자 ${userId} 개인 갤러리 요청 - 필터: ${filter || 'all'}`);

    let whereCondition;
    if (filter && filter !== 'all') {
      if (filter === 'collage') {
        whereCondition = and(
          eq(images.userId, userId.toString()),
          eq(images.style, 'collage')
        );
      } else {
        whereCondition = and(
          eq(images.userId, userId.toString()),
          eq(images.categoryId, filter)
        );
      }
    } else {
      whereCondition = eq(images.userId, userId.toString());
    }

    const imageItems = await db.query.images.findMany({
      where: whereCondition,
      orderBy: desc(images.createdAt)
    });

    const galleryItems = imageItems.map(image => {
      const convertToDirectUrl = (url: string): string => {
        try {
          const urlObj = new URL(url);
          const pathname = urlObj.pathname;
          if (pathname.includes('/createtree-upload/')) {
            const filePath = pathname.substring(pathname.indexOf('/createtree-upload/') + '/createtree-upload/'.length);
            return `https://storage.googleapis.com/createtree-upload/${filePath}`;
          }
          return url;
        } catch (error) {
          return url;
        }
      };

      const baseUrl = generatePublicUrl(image.transformedUrl || image.originalUrl);
      const transformedUrl = baseUrl ? convertToDirectUrl(baseUrl) : '';

      const origUrl = generatePublicUrl(image.originalUrl);
      const originalUrl = origUrl ? convertToDirectUrl(origUrl) : '';

      let thumbnailUrl = transformedUrl;
      if (image.thumbnailUrl) {
        const thumbUrl = generatePublicUrl(image.thumbnailUrl);
        thumbnailUrl = thumbUrl ? convertToDirectUrl(thumbUrl) : transformedUrl;
      }

      return {
        id: image.id,
        title: image.title || `생성된 이미지 - ${image.style || '스타일'}`,
        type: image.style === 'collage' ? 'collage' as const : image.categoryId || 'image' as const,
        url: thumbnailUrl,
        transformedUrl: transformedUrl,
        thumbnailUrl: thumbnailUrl,
        originalUrl: originalUrl,
        fullUrl: originalUrl,
        style: image.style || '',
        userId: image.userId,
        createdAt: image.createdAt.toISOString(),
        isFavorite: false
      };
    });

    console.log(`[갤러리 API] 전체 ${galleryItems.length}개 이미지 반환`);
    res.json(galleryItems);
  } catch (error) {
    console.error('[갤러리 API] 오류:', error);
    res.status(500).json({ error: '갤러리 로딩 실패' });
  }
});

router.post("/gallery/favorite", async (req: Request, res: Response) => {
  try {
    res.json({ success: true, message: "즐겨찾기 기능은 현재 비활성화됨" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error("Error toggling favorite:", error);
    return res.status(500).json({ error: "Failed to toggle favorite" });
  }
});

router.delete("/gallery/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const imageId = parseInt(req.params.id);
    const userId = req.user!.id;

    if (isNaN(imageId)) {
      return res.status(400).json({ error: "유효하지 않은 이미지 ID입니다." });
    }

    const existingImage = await db.query.images.findFirst({
      where: and(
        eq(images.id, imageId),
        eq(images.userId, userId.toString())
      )
    });

    if (!existingImage) {
      return res.status(404).json({ error: "이미지를 찾을 수 없거나 삭제 권한이 없습니다." });
    }

    await db.delete(images).where(
      and(
        eq(images.id, imageId),
        eq(images.userId, userId.toString())
      )
    );

    console.log(`[갤러리 삭제] 이미지 ID ${imageId} 삭제 완료`);

    res.json({
      success: true,
      message: "이미지가 성공적으로 삭제되었습니다.",
      deletedId: imageId
    });
  } catch (error) {
    console.error("[갤러리 삭제] 오류:", error);
    res.status(500).json({ error: "이미지 삭제 중 오류가 발생했습니다." });
  }
});

router.options("/media/download/:type/:id", (req: Request, res: Response) => {
  res.header('Allow', 'GET, HEAD, OPTIONS');
  res.status(200).end();
});

router.head("/media/download/:type/:id", async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;
    const parsedId = parseInt(id);

    if (type !== "music" && type !== "image") {
      return res.status(400).end();
    }

    let url = '';
    let contentType = '';

    if (type === "image" && parsedId === -1 && req.session && req.session.tempImage) {
      url = req.session.tempImage.transformedUrl;
      contentType = 'image/jpeg';

      if (req.session.tempImage.localFilePath && fs.existsSync(req.session.tempImage.localFilePath)) {
        res.setHeader('Content-Type', contentType);
        return res.status(200).end();
      }
    } else {
      const mediaItem = await storage.getMediaItem(parsedId, type);
      if (!mediaItem) {
        return res.status(404).end();
      }

      if (type === "music") {
        url = (mediaItem as typeof music.$inferSelect).url || '';
        contentType = 'audio/mpeg';
      } else {
        url = (mediaItem as typeof images.$inferSelect).transformedUrl;
        contentType = 'image/jpeg';

        const urlBasename = path.basename(url);
        const possibleLocalPaths = [
          path.join(process.cwd(), 'uploads', urlBasename),
          path.join(process.cwd(), 'uploads', 'temp', urlBasename)
        ];

        for (const localPath of possibleLocalPaths) {
          if (fs.existsSync(localPath)) {
            res.setHeader('Content-Type', contentType);
            return res.status(200).end();
          }
        }
      }
    }

    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'Accept': 'image/*,audio/*,*/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        return res.status(502).json({
          error: "원격 서버에서 파일을 찾을 수 없습니다",
          url: url
        });
      }

      res.setHeader('Content-Type', response.headers.get('content-type') || contentType);
      return res.status(200).end();
    } catch (error) {
      return res.status(502).json({
        error: "원격 URL에 접근할 수 없습니다",
        url: url,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  } catch (error) {
    console.error("Error in HEAD request:", error);
    return res.status(500).end();
  }
});

router.get("/media/download/:type/:id", async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;
    const parsedId = parseInt(id);

    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Origin, X-Requested-With');

    if (type !== "music" && type !== "image") {
      return res.status(400).json({ error: "Invalid media type" });
    }

    let url = '';
    let filename = '';
    let mediaItem;

    if (type === "image" && parsedId === -1 && req.session && req.session.tempImage) {
      console.log("임시 이미지 다운로드 요청 처리 중:", req.session.tempImage.title);

      if (req.session.tempImage.localFilePath) {
        try {
          console.log(`로컬 파일에서 읽기: ${req.session.tempImage.localFilePath}`);
          const imageBuffer = fs.readFileSync(req.session.tempImage.localFilePath);
          filename = `${req.session.tempImage.title || 'transformed_image'}.jpg`;

          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

          return res.send(imageBuffer);
        } catch (fileError) {
          console.error('로컬 파일 읽기 실패:', fileError);
          url = req.session.tempImage.transformedUrl;
          filename = `${req.session.tempImage.title || 'transformed_image'}.jpg`;
        }
      } else {
        url = req.session.tempImage.transformedUrl;
        filename = `${req.session.tempImage.title || 'transformed_image'}.jpg`;
      }
    } else {
      try {
        mediaItem = await storage.getMediaItem(parsedId, type);

        if (!mediaItem) {
          return res.status(404).json({ error: "Media not found" });
        }

        if (type === "music") {
          const musicItem = mediaItem as typeof music.$inferSelect;
          url = musicItem.url || '';
          filename = `${musicItem.title || 'music'}.mp3`;

          console.log(`[음악 다운로드] ID: ${parsedId}, URL: ${url}, 파일명: ${filename}`);

          if (url.includes('storage.googleapis.com')) {
            try {
              const urlParts = url.split('/');
              const fileName = urlParts[urlParts.length - 1];
              const filePath = `music/${fileName}`;

              const { Storage } = await import('@google-cloud/storage');
              const serviceAccountKey = {
                type: "service_account",
                project_id: "createtreeai",
                private_key_id: "5ae3581cc6a4ccdc012c18c0775fdd51614eee24",
                private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCevUl+Y5xGrsVR\nhWJvr8stawdae+MWgy85E/zHKqN660EOjqY643Y//gp07NIb0XuJWTMbJcZYNLxi\nTcczDyggqPYn2UQUbdKIpp0XbiYkD/GLo1Hqi3CVPsIRa1xRT70S5Yx9q9rkAbxB\n+eF8gdxXQ8y+eIIhJRauZTbK7g5+f9Df8TRyjfofI8WZRNPXsQhqfpwQbp8VJwL8\nDCp7cXI2vIrCq7SbxlD02vdsaSQ97DGVIBF7Nr6QE6otSBxl4fqHYjmx6RfCAynz\nHWH1nOuYxkYszhDjawsVEaXjuGCa6SAzKmgHWaoXAM6V692lm+VLx9/1EO9b+r2I\nzJj5ak2/AgMBAAECggEAAk+gAwGLpWWMdDuTIcBR9GldUJyAMdMz3lWODsJK4n6V9\nG7I2ZA5iYn1nGHE5SAegKkOxiWRsbJzAUxhy3WedkC7Ws5yvmEkHNDggq6uEqf+AO\nEWnMPV166FoMkULVn9MwNym+GbqCRMt6MSSaP4BTEOhyx/bUA8zJwk8TW5f5vsavtxB\n6nyuo+kBS6ow4JVxFgIAs9R1MsvCBpu+OAwnHO4rnQKBgQDKtjIJf19ZccoHTndV\nAsjagQp6hibvDGelVNxq7pQDnZj2z8NH/lEX5KbAyhSHWURi/FHgzmuCybFZqs8d\nsuQd+MJekwsOYs7IONq00Pi9QE1xLMt4DCLhPj29BVa3Rn88/RcQOkCgcITKGs7+\nopqEnJDVKutEXKlykAH3qR0dewKBgQDId+gAwGLpWWMdDuTIcBR9GldUJyAMdMz3\nlWODsJK4n6V9G7I2ZA5iYn1nGHE5SAegKkOxiWRsbJzAUxhy3WedkC7Ws5yvmEkH\nNDggq6uEqf+AOEWnMPV166FoMkULVn9MwNym+GbqCRMt6dL12Px0Q+bBz+qUp9IH\nUQq62KfjjQKBgEg6CLQXnSqqf5iA3cX9ewFXzxr+56pvGhLvnKXBIh3zrkfqmSLy\nu4Qu5Td2CUB8jwBR9P6LrgToxnczhB6J2fvP4bl+3QagMBtpHowklSwhWDaGBm1c\nraTh32+VEmO1C6r4ZppSlypTTQ0R5kUWPMYZXwWFCFTQS1PVec37hLM3AoGBALGM\nYVKpEfGSVZIa6s4LVlomxkmmDWB64j41dVnhPVF/M9bGfORnYcYJbP+uSjltbjOQ\nEPpg7uVA/FehzFIpyA5BRVNKjnzy1bXdNR+fW7LRAoGBAK9yAL+ER3fIIHAHrYkd\nwOo4Agd6gRfVPpR2VclOWgwfG6vCiIccx+j9n4G2muJd5L0ZLGqOQMfKy4WjHdBR\n/SHg1s7YhbtVtddwdluSobZ03q6hztqMkejOaemngTMSvGOk8jlyFfmrgU0OcClf\nnEoJ2Uh1U2PmPz9iZuyUI2GA\n-----END PRIVATE KEY-----\n",
                client_email: "upload-server@createtree.iam.gserviceaccount.com",
                client_id: "115537304083050477734",
                auth_uri: "https://accounts.google.com/o/oauth2/auth",
                token_uri: "https://oauth2.googleapis.com/token",
                auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
                client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/upload-server%40createtree.iam.gserviceaccount.com"
              };

              const storage = new Storage({
                projectId: 'createtreeai',
                credentials: serviceAccountKey
              });

              const bucket = storage.bucket('createtree-upload');
              const file = bucket.file(filePath);

              const [signedUrl] = await file.getSignedUrl({
                version: 'v4',
                action: 'read',
                expires: Date.now() + 24 * 60 * 60 * 1000,
              });

              console.log(`[음악 다운로드] SignedURL 생성: ${signedUrl.substring(0, 100)}...`);

              const fetch = await import('node-fetch');
              const response = await fetch.default(signedUrl);

              if (!response.ok) {
                throw new Error(`GCS 파일 다운로드 실패: ${response.status} ${response.statusText}`);
              }

              const musicBuffer = Buffer.from(await response.arrayBuffer());
              console.log(`[음악 다운로드] 파일 크기: ${musicBuffer.length} bytes`);

              if (musicBuffer.length < 1000) {
                throw new Error(`다운로드된 파일이 너무 작습니다: ${musicBuffer.length} bytes`);
              }

              res.setHeader('Content-Type', 'audio/mpeg');
              res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
              res.setHeader('Content-Length', musicBuffer.length.toString());

              return res.send(musicBuffer);

            } catch (musicError) {
              console.error(`[음악 다운로드 오류] ID: ${parsedId}:`, musicError);
              return res.status(500).json({
                error: "음악 파일 다운로드 실패",
                message: musicError instanceof Error ? musicError.message : String(musicError)
              });
            }
          } else if (url.includes('audiopipe.suno.ai')) {
            console.log(`[음악 다운로드] ${musicItem.title} - Suno URL 프록시 다운로드`);

            try {
              const fetch = (await import('node-fetch')).default;

              const audioResponse = await fetch(url, {
                redirect: 'follow',
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
              });

              if (!audioResponse.ok) {
                console.error(`[음악 다운로드] Suno 응답 실패: ${audioResponse.status}`);
                return res.status(500).json({ error: "음악 파일을 가져올 수 없습니다" });
              }

              if (!audioResponse.body) {
                return res.status(500).json({ error: "음악 데이터가 없습니다" });
              }

              const filename = `${musicItem.title || 'music'}.mp3`;
              res.setHeader('Content-Type', 'audio/mpeg');
              res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
              res.setHeader('Cache-Control', 'public, max-age=31536000');

              audioResponse.body.pipe(res);

            } catch (proxyError) {
              console.error(`[음악 다운로드] 프록시 오류:`, proxyError);
              return res.status(500).json({ error: "음악 다운로드 중 오류가 발생했습니다" });
            }
          } else {
            console.log(`[음악 다운로드] ${musicItem.title} - 외부 URL로 리다이렉트`);
            return res.redirect(302, url);
          }
        } else {
          const imageItem = mediaItem as typeof images.$inferSelect;
          url = imageItem.transformedUrl;
          filename = `${imageItem.title || 'transformed_image'}.jpg`;

          const urlBasename = path.basename(imageItem.transformedUrl);
          const possibleLocalPaths = [
            path.join(process.cwd(), 'uploads', urlBasename),
            path.join(process.cwd(), 'uploads', 'temp', urlBasename)
          ];

          for (const localPath of possibleLocalPaths) {
            if (fs.existsSync(localPath)) {
              console.log(`로컬에서 이미지 파일 찾음: ${localPath}`);
              try {
                const imageBuffer = fs.readFileSync(localPath);
                res.setHeader('Content-Type', 'image/jpeg');
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
                return res.send(imageBuffer);
              } catch (fileError) {
                console.error('로컬 파일 읽기 실패:', fileError);
                break;
              }
            }
          }
        }
      } catch (dbError) {
        console.error("DB에서 미디어 조회 실패:", dbError);
        return res.status(500).json({ error: "데이터베이스 조회 실패", message: dbError instanceof Error ? dbError.message : String(dbError) });
      }
    }

    if (url) {
      console.log(`[미디어 다운로드] ID: ${parsedId}, URL: ${url.substring(0, 50)}...`);

      if (url.startsWith('data:')) {
        console.log('✅ Base64 데이터 감지됨. 처리 중...');
        try {
          const base64Data = url.split(',')[1];
          if (!base64Data) {
            throw new Error('Base64 데이터를 찾을 수 없습니다');
          }

          const buffer = Buffer.from(base64Data, 'base64');
          console.log('Base64 버퍼 크기:', buffer.length, 'bytes');

          const mimeMatch = url.match(/data:([^;]+)/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
          console.log('MIME 타입:', mimeType);

          res.setHeader('Content-Type', mimeType);
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
          console.log('✅ Base64 이미지 전송 완료');
          return res.send(buffer);
        } catch (base64Error) {
          console.error('❌ Base64 데이터 처리 실패:', base64Error);
          return res.status(500).json({ error: "Base64 데이터 처리 중 오류가 발생했습니다." });
        }
      }

      if (url.startsWith('/uploads/') || url.startsWith('/static/banner/')) {
        try {
          const fullPath = path.join(process.cwd(), url);
          console.log(`[로컬 다운로드] 파일 경로: ${fullPath}`);

          if (fs.existsSync(fullPath)) {
            const ext = path.extname(fullPath).toLowerCase();
            let contentType = 'image/jpeg';
            let downloadExt = '.jpg';

            if (ext === '.webp') {
              contentType = 'image/webp';
              downloadExt = '.webp';
            } else if (ext === '.png') {
              contentType = 'image/png';
              downloadExt = '.png';
            }

            const titleWithoutExt = (filename.split('.')[0] || 'image');
            const correctFilename = `${titleWithoutExt}${downloadExt}`;

            console.log(`[다운로드] 파일타입: ${contentType}, 파일명: ${correctFilename}`);

            const fileBuffer = fs.readFileSync(fullPath);
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(correctFilename)}"`);
            res.setHeader('Content-Length', fileBuffer.length.toString());

            return res.send(fileBuffer);
          } else {
            console.log(`[오류] 파일 없음: ${fullPath}`);
          }
        } catch (localFileError) {
          console.error("[로컬 파일 오류]:", localFileError);
        }
      }

      console.log(`[오류] 로컬 파일이 아닌 URL: ${url}`);
      return res.status(404).json({
        error: "로컬 파일을 찾을 수 없습니다",
        message: "모든 이미지는 로컬 파일 시스템에 저장되어야 합니다"
      });
    } else {
      return res.status(404).json({ error: "다운로드할 URL을 찾을 수 없습니다." });
    }
  } catch (error) {
    console.error("Error downloading media:", error);
    return res.status(500).json({
      error: "Failed to download media",
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

router.post("/media/share", async (req: Request, res: Response) => {
  try {
    console.log("미디어 공유 요청 수신:", req.body);
    const validatedData = mediaShareSchema.parse(req.body);

    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Origin, X-Requested-With');

    try {
      if (validatedData.type === 'image' && validatedData.id === -1 && req.session && req.session.tempImage) {
        console.log("임시 이미지 공유 시도:", req.session.tempImage.title);

        let shareUrl = '';
        if (req.session.tempImage.localFilePath) {
          const baseUrl = `${req.protocol}://${req.get('host')}`;
          const relativePath = req.session.tempImage.localFilePath.replace(process.cwd(), '');
          shareUrl = `${baseUrl}${relativePath.replace(/\\/g, '/').replace('/uploads', '/uploads')}`;
          console.log("임시 이미지 공유 URL 생성:", shareUrl);

          if (!shareUrl.includes('://')) {
            shareUrl = `${req.protocol}://${req.get('host')}${shareUrl.startsWith('/') ? '' : '/'}${shareUrl}`;
          }

          return res.json({
            shareUrl,
            message: "임시 이미지 URL이 생성되었습니다. 이 URL을 통해 미디어를 공유할 수 있습니다."
          });
        }
      }

      console.log(`미디어 조회 시도 - ID: ${validatedData.id}, 타입: ${validatedData.type}`);
      const mediaItem = await storage.getMediaItem(
        validatedData.id,
        validatedData.type
      );

      if (!mediaItem) {
        console.error(`미디어 항목을 찾을 수 없음 - ID: ${validatedData.id}, 타입: ${validatedData.type}`);
        return res.status(404).json({
          error: "Media not found",
          message: "공유할 미디어 항목을 찾을 수 없습니다."
        });
      }

      console.log("미디어 항목 찾음:", mediaItem);

      let shareUrl = '';
      if (validatedData.type === 'image') {
        const imageItem = mediaItem as typeof images.$inferSelect;
        shareUrl = imageItem.transformedUrl;

        if (!shareUrl.includes('://')) {
          const baseUrl = `${req.protocol}://${req.get('host')}`;
          shareUrl = `${baseUrl}${shareUrl.startsWith('/') ? '' : '/'}${shareUrl}`;
        }
      } else if (validatedData.type === 'music') {
        const musicItem = mediaItem as typeof music.$inferSelect;
        shareUrl = musicItem.url || '';

        if (!shareUrl.includes('://')) {
          const baseUrl = `${req.protocol}://${req.get('host')}`;
          shareUrl = `${baseUrl}${shareUrl.startsWith('/') ? '' : '/'}${shareUrl}`;
        }
      }

      if (shareUrl) {
        return res.json({
          shareUrl,
          message: "미디어 URL이 생성되었습니다. 이 URL을 통해 미디어를 공유할 수 있습니다."
        });
      }

      const shareLink = await storage.createShareLink(
        validatedData.id,
        validatedData.type
      );

      return res.json({ shareUrl: shareLink });
    } catch (lookupError) {
      console.error("미디어 조회 실패:", lookupError);
      return res.status(500).json({
        error: "Media lookup failed",
        message: "미디어 정보를 불러오는 데 실패했습니다."
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error("Error sharing media:", error);
    return res.status(500).json({ error: "Failed to share media" });
  }
});

export default router;
