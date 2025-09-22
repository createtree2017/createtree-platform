import { Request, Response, NextFunction } from 'express';
import { db } from '@db';
import { concepts } from '@shared/schema';
import { or, like } from 'drizzle-orm';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';

/**
 * 이미지 프록시 미들웨어 옵션
 */
interface ImageProxyOptions {
  baseFolder: string;      // 로컬 파일을 찾을 베이스 폴더 (예: 'uploads', 'static/banner')
  requestPrefix: string;   // GCS 검색을 위한 요청 경로 prefix (예: '/uploads', '/static/banner')
  allowFallback?: boolean; // 이미지를 찾지 못했을 때 next() 호출 여부 (기본: false)
}

/**
 * 이미지 프록시 미들웨어 (uploads 폴더용)
 * 로컬 파일이 존재하지 않을 경우 GCS에서 이미지를 찾아서 프록시 서빙
 */
export async function imageProxyMiddleware(req: Request, res: Response, next: NextFunction) {
  return createImageProxyMiddleware({
    baseFolder: 'uploads',
    requestPrefix: '/uploads',
    allowFallback: false
  })(req, res, next);
}

/**
 * 배너 이미지 프록시 미들웨어 (static/banner 폴더용)
 * 로컬 파일이 존재할 경우 express.static이 처리하도록 next() 호출
 * 로컬 파일이 없을 경우에만 GCS에서 프록시 시도
 * GCS에서도 없으면 next() 호출하여 fallback 허용
 */
export async function bannerProxyMiddleware(req: Request, res: Response, next: NextFunction) {
  return createImageProxyMiddleware({
    baseFolder: 'static/banner',
    requestPrefix: '/static/banner',
    allowFallback: true
  })(req, res, next);
}

/**
 * 설정 가능한 이미지 프록시 미들웨어 생성기
 */
export function createImageProxyMiddleware(options: ImageProxyOptions) {
  return async function(req: Request, res: Response, next: NextFunction) {
    // req.path는 마운트된 경로 기준 상대 경로
    const relativePath = req.path;
    
    try {
      // GCS 검색을 위한 전체 경로 구성
      const fullRequestedPath = options.requestPrefix + relativePath;
      
      console.log(`🔍 [ImageProxy] 요청 처리: ${relativePath} (전체: ${fullRequestedPath}, 베이스: ${options.baseFolder})`);
      
      // 로컬 파일 경로를 안전하게 구성
      const cleanRelativePath = relativePath.replace(/^\/+/, ''); // 앞의 / 제거
      
      // 보안: 고급 디렉터리 트래버설 및 심볼릭 링크 공격 차단
      const localBase = path.join(process.cwd(), options.baseFolder);
      const resolvedPath = path.resolve(localBase, cleanRelativePath);
    
      // 1. 기본 경계 검증: 해결된 경로가 베이스 디렉터리 내부에 있는지 확인
      if (!resolvedPath.startsWith(localBase + path.sep) && resolvedPath !== localBase) {
        console.warn(`🚨 [ImageProxy] 보안 경고 - 기본 디렉터리 트래버설 시도 차단: ${relativePath}`);
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Path traversal attack detected'
        });
      }
    
      let localFilePath = resolvedPath;
      
      // 2. TOCTOU 안전한 파일 검증 및 서빙
      try {
        // lstat으로 한 번만 파일 상태 확인 (TOCTOU 방지)
        const stats = await fs.lstat(resolvedPath);
        
        // 심볼릭 링크 직접 차단
        if (stats.isSymbolicLink()) {
          console.warn(`🚨 [ImageProxy] 보안 경고 - 심볼릭 링크 접근 시도 차단: ${relativePath}`);
          return res.status(403).json({ 
            error: 'Access denied',
            message: 'Symlink access denied'
          });
        }
        
        // 파일인 경우 - express.static이 처리하도록 next() 호출
        if (stats.isFile()) {
          // sendFile 직전 최종 realpath 검증 (TOCTOU 레이스 컨디션 완전 제거)
          const realBase = await fs.realpath(localBase);
          const finalRealPath = await fs.realpath(resolvedPath);
          
          // 마지막 순간 경계 확인: 서빙 직전 realpath로 경계 내부 재확인
          if (!finalRealPath.startsWith(realBase + path.sep) && finalRealPath !== realBase) {
            console.warn(`🚨 [ImageProxy] 보안 경고 - 최종 경계 위반 차단: ${relativePath} -> ${finalRealPath}`);
            return res.status(403).json({ 
              error: 'Access denied',
              message: 'Security boundary violation'
            });
          }
          
          // 로컬 파일이 존재하므로 express.static이 처리하도록 next() 호출
          console.log(`✅ [ImageProxy] 로컬 파일 발견, express.static으로 위임: ${relativePath}`);
          return next();
        }
      } catch (statError) {
        // lstat 실패는 파일/디렉터리가 존재하지 않는 경우 (정상)
        console.log(`🔍 [ImageProxy] 로컬 파일 없음, GCS 검색으로 진행: ${relativePath}`);
      }
    
      // 3. DB에서 GCS URL 찾기
      const gcsUrl = await findImageInGCS(fullRequestedPath);
      
      if (!gcsUrl) {
        console.log(`❌ [ImageProxy] GCS에서 이미지를 찾을 수 없음: ${fullRequestedPath}`);
        
        // allowFallback 옵션에 따라 처리
        if (options.allowFallback) {
          console.log(`📋 [ImageProxy] Fallback 허용, 다음 미들웨어로 위임: ${relativePath}`);
          return next();
        } else {
          return res.status(404).json({ 
            error: 'Image not found', 
            path: fullRequestedPath 
          });
        }
      }
      
      // 4. GCS에서 이미지 프록시
      console.log(`📡 [ImageProxy] GCS 프록시: ${fullRequestedPath} → ${gcsUrl}`);
      await proxyImageFromGCS(gcsUrl, req, res);
      
    } catch (error) {
      console.error(`❌ [ImageProxy] 오류:`, error);
      
      // allowFallback 옵션에 따라 처리
      if (options.allowFallback) {
        console.log(`📋 [ImageProxy] 오류 발생, Fallback 허용으로 다음 미들웨어로 위임: ${relativePath}`);
        return next();
      } else {
        return res.status(500).json({ 
          error: 'Image proxy error', 
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  };
}

/**
 * FD 기반 TOCTOU 안전 파일 스트리밍
 * 
 * 최종 TOCTOU 레이스 컨디션을 완전히 제거하는 보안 구현:
 * 1. O_NOFOLLOW로 심볼릭 링크 차단하며 파일 열기
 * 2. FD로 파일 상태 재검증 (isFile, 권한 등)
 * 3. 검증된 FD에서 직접 스트리밍 (경로 기반 재해결 없음)
 * 4. Range 요청 및 HTTP 헤더 완전 지원
 */
async function streamFileSecurely(
  finalRealPath: string, 
  requestPath: string, 
  req: Request, 
  res: Response
): Promise<void> {
  let fileHandle: fs.FileHandle | null = null;
  
  try {
    // 1. O_NOFOLLOW로 안전하게 파일 열기 (심볼릭 링크 완전 차단)
    fileHandle = await fs.open(finalRealPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    
    // 2. FD 기반 파일 상태 재검증 (TOCTOU 안전)
    const stats = await fileHandle.stat();
    
    // 일반 파일이 아닌 경우 차단 (디렉터리, 특수 파일, 심볼릭 링크 등)
    if (!stats.isFile()) {
      console.warn(`🚨 [ImageProxy] FD 검증 실패 - 일반 파일 아님: ${finalRealPath}`);
      res.status(403).json({ 
        error: 'Access denied',
        message: 'Not a regular file'
      });
      return;
    }
    
    // 3. HTTP 헤더 설정
    const headers = getImageHeaders(requestPath);
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    
    res.setHeader('Content-Length', stats.size.toString());
    res.setHeader('Last-Modified', stats.mtime.toUTCString());
    res.setHeader('Accept-Ranges', 'bytes');
    
    // 4. Range 요청 처리
    const range = req.headers.range;
    if (range) {
      const result = parseRangeHeader(range, stats.size);
      if (result) {
        const { start, end, contentLength } = result;
        
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
        res.setHeader('Content-Length', contentLength.toString());
        
        // Range 스트리밍 (FD 직접 사용)
        const stream = createReadStream('', {
          fd: fileHandle.fd,
          start,
          end,
          autoClose: false // 수동으로 관리
        });
        
        console.log(`📄 [ImageProxy] FD Range 스트리밍: ${finalRealPath} (${start}-${end})`);
        
        return new Promise((resolve, reject) => {
          stream.on('error', reject);
          stream.on('end', resolve);
          res.on('close', resolve);
          stream.pipe(res);
        });
        
      } else {
        // 잘못된 Range 요청
        res.status(416);
        res.setHeader('Content-Range', `bytes */${stats.size}`);
        res.end();
        return;
      }
    }
    
    // 5. 전체 파일 스트리밍 (FD 직접 사용)
    res.status(200);
    const stream = createReadStream('', {
      fd: fileHandle.fd,
      autoClose: false // 수동으로 관리
    });
    
    console.log(`📄 [ImageProxy] FD 전체 스트리밍: ${finalRealPath} (${stats.size} bytes)`);
    
    return new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('end', resolve);
      res.on('close', resolve);
      stream.pipe(res);
    });
    
  } catch (error) {
    console.error(`❌ [ImageProxy] FD 스트리밍 오류:`, error);
    
    // 특정 오류 타입별 처리
    if (error && typeof error === 'object' && 'code' in error) {
      const err = error as NodeJS.ErrnoException;
      switch (err.code) {
        case 'ELOOP':
          res.status(403).json({ 
            error: 'Access denied',
            message: 'Symlink loop detected'
          });
          return;
        case 'ENOTDIR':
        case 'EISDIR':
          res.status(403).json({ 
            error: 'Access denied',
            message: 'Invalid file type'
          });
          return;
        case 'ENOENT':
          res.status(404).json({ 
            error: 'File not found',
            message: 'File was removed during processing'
          });
          return;
        case 'EACCES':
        case 'EPERM':
          res.status(403).json({ 
            error: 'Access denied',
            message: 'Insufficient permissions'
          });
          return;
      }
    }
    
    res.status(500).json({ 
      error: 'File streaming error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
    
  } finally {
    // 6. 리소스 정리 (중요: 메모리 및 FD 리크 방지)
    if (fileHandle) {
      try {
        await fileHandle.close();
        console.log(`🧹 [ImageProxy] FD 정리 완료: ${finalRealPath}`);
      } catch (closeError) {
        console.error(`⚠️ [ImageProxy] FD 정리 실패:`, closeError);
      }
    }
  }
}

/**
 * Range 헤더 파싱
 */
function parseRangeHeader(rangeHeader: string, fileSize: number): {
  start: number;
  end: number;
  contentLength: number;
} | null {
  const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
  if (!match) return null;
  
  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
  
  if (start >= fileSize || end >= fileSize || start > end) {
    return null;
  }
  
  return {
    start,
    end,
    contentLength: end - start + 1
  };
}

/**
 * 파일 확장자를 기반으로 이미지 파일인지 확인
 */
function isImageFile(filePath: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  const ext = path.extname(filePath).toLowerCase();
  return imageExtensions.includes(ext);
}

/**
 * GCS URL 유효성 검증 헬퍼 함수
 * - GCS URL(https://storage.googleapis.com/)만 유효한 것으로 간주
 * - 로컬 경로(/static/, /uploads/ 등)는 무효
 */
function isValidGCSUrl(url: string | null): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  // GCS URL 패턴 검증
  return url.startsWith('https://storage.googleapis.com/');
}

/**
 * 로컬 경로인지 확인하는 헬퍼 함수
 */
function isLocalPath(url: string | null): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  // 로컬 경로 패턴들
  const localPathPrefixes = ['/static/', '/uploads/', './static/', './uploads/', '../'];
  
  return localPathPrefixes.some(prefix => url.startsWith(prefix)) || 
         (!url.startsWith('http://') && !url.startsWith('https://'));
}

/**
 * DB에서 요청된 파일명과 일치하는 GCS URL 찾기
 * concepts 테이블과 배너 테이블들에서 검색
 */
async function findImageInGCS(requestedPath: string): Promise<string | null> {
  try {
    const filename = path.basename(requestedPath);
    
    // 1. concepts 테이블에서 thumbnail_url, reference_image_url 검색
    const conceptResults = await db.select({
      thumbnailUrl: concepts.thumbnailUrl,
      referenceImageUrl: concepts.referenceImageUrl
    }).from(concepts).where(
      or(
        like(concepts.thumbnailUrl, `%${filename}%`),
        like(concepts.referenceImageUrl, `%${filename}%`)
      )
    );
    
    // 매칭되는 URL 찾기 (GCS URL 검증 추가)
    for (const result of conceptResults) {
      if (result.thumbnailUrl && result.thumbnailUrl.includes(filename)) {
        if (isValidGCSUrl(result.thumbnailUrl)) {
          console.log(`🎯 [ImageProxy] concepts에서 유효한 GCS URL 찾음 (thumbnail): ${result.thumbnailUrl}`);
          return result.thumbnailUrl;
        } else if (isLocalPath(result.thumbnailUrl)) {
          console.log(`⚠️ [ImageProxy] concepts의 로컬 경로는 프록시 불가 (thumbnail): ${result.thumbnailUrl}`);
        }
      }
      if (result.referenceImageUrl && result.referenceImageUrl.includes(filename)) {
        if (isValidGCSUrl(result.referenceImageUrl)) {
          console.log(`🎯 [ImageProxy] concepts에서 유효한 GCS URL 찾음 (reference): ${result.referenceImageUrl}`);
          return result.referenceImageUrl;
        } else if (isLocalPath(result.referenceImageUrl)) {
          console.log(`⚠️ [ImageProxy] concepts의 로컬 경로는 프록시 불가 (reference): ${result.referenceImageUrl}`);
        }
      }
    }
    
    // 2. smallBanners 테이블에서 imageUrl 검색
    const { smallBanners } = await import('@shared/schema');
    const bannerResults = await db.select({
      imageUrl: smallBanners.imageUrl
    }).from(smallBanners).where(
      like(smallBanners.imageUrl, `%${filename}%`)
    );
    
    for (const result of bannerResults) {
      if (result.imageUrl && result.imageUrl.includes(filename)) {
        if (isValidGCSUrl(result.imageUrl)) {
          console.log(`🎯 [ImageProxy] 배너에서 유효한 GCS URL 찾음: ${result.imageUrl}`);
          return result.imageUrl;
        } else if (isLocalPath(result.imageUrl)) {
          console.log(`⚠️ [ImageProxy] 배너의 로컬 경로는 프록시 불가: ${result.imageUrl}`);
        }
      }
    }
    
    // 3. banners 테이블도 있다면 검색 (imageSrc 필드 사용)
    try {
      const { banners } = await import('@shared/schema');
      const mainBannerResults = await db.select({
        imageSrc: banners.imageSrc
      }).from(banners).where(
        like(banners.imageSrc, `%${filename}%`)
      );
      
      for (const result of mainBannerResults) {
        if (result.imageSrc && result.imageSrc.includes(filename)) {
          if (isValidGCSUrl(result.imageSrc)) {
            console.log(`🎯 [ImageProxy] 메인 배너에서 유효한 GCS URL 찾음: ${result.imageSrc}`);
            return result.imageSrc;
          } else if (isLocalPath(result.imageSrc)) {
            console.log(`⚠️ [ImageProxy] 메인 배너의 로컬 경로는 프록시 불가: ${result.imageSrc}`);
          }
        }
      }
    } catch (importError) {
      // banners 테이블이 없는 경우 (정상적으로 무시)
      console.log(`📝 [ImageProxy] banners 테이블 접근 실패:`, importError);
    }
    
    return null;
    
  } catch (error) {
    console.error(`❌ [ImageProxy] DB 검색 오류:`, error);
    return null;
  }
}

/**
 * GCS에서 이미지를 fetch하여 클라이언트에 프록시
 */
async function proxyImageFromGCS(gcsUrl: string, req: Request, res: Response): Promise<void> {
  try {
    // URL 유효성 재검증 - 옵은 URL이 전달될 수도 있음
    if (!isValidGCSUrl(gcsUrl)) {
      console.error(`❌ [ImageProxy] 잘못된 GCS URL 감지: ${gcsUrl}`);
      throw new Error(`Invalid GCS URL: ${gcsUrl}`);
    }
    
    console.log(`📍 [ImageProxy] 유효한 GCS URL에서 프록시 시도: ${gcsUrl}`);
    const headers: Record<string, string> = {};
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }
    
    const response = await fetch(gcsUrl, { headers });
    
    if (!response.ok) {
      console.error(`❌ [ImageProxy] GCS fetch 실패: ${response.status} ${response.statusText}`);
      throw new Error(`GCS fetch failed: ${response.status}`);
    }
    
    // 응답 헤더 설정
    res.status(response.status);
    
    // Content-Type 설정
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    } else {
      // fallback content type based on URL
      const ext = path.extname(gcsUrl).toLowerCase();
      const mimeType = getMimeType(ext);
      res.setHeader('Content-Type', mimeType);
    }
    
    // 일반 이미지 캐시 정책
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());
    res.setHeader('ETag', response.headers.get('etag') || `"gcs-${Date.now()}"`);
    
    // Content-Length 설정
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    
    // 기타 관련 헤더들
    const lastModified = response.headers.get('last-modified');
    if (lastModified) {
      res.setHeader('Last-Modified', lastModified);
    }
    
    // Range 요청 처리
    if (req.headers.range && response.status === 206) {
      const contentRange = response.headers.get('content-range');
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
      }
      res.setHeader('Accept-Ranges', 'bytes');
    }
    
    // 스트림 데이터 전송
    if (!response.body) {
      throw new Error('No response body from GCS');
    }
    
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } finally {
      reader.releaseLock();
    }
    
  } catch (error) {
    console.error(`❌ [ImageProxy] 프록시 오류:`, error);
    
    // Invalid URL 오류에 대한 명확한 처리
    if (error instanceof Error && error.message.includes('Invalid GCS URL')) {
      throw new Error(`Proxy failed: ${error.message}`);
    }
    
    throw error;
  }
}

/**
 * 이미지 파일에 대한 적절한 헤더 생성
 */
function getImageHeaders(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = getMimeType(ext);
  
  return {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=31536000, immutable', // 일반 이미지 캐시 정책
    'Expires': new Date(Date.now() + 31536000000).toUTCString(), // 레거시 브라우저 호환성
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range'
  };
}

/**
 * 파일 확장자에 따른 MIME 타입 반환
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}