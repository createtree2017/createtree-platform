import type { Request, Response, NextFunction } from 'express';
import { safeJsonParseArray, validateImageUrls } from '../utils/safe-json';

/**
 * Firebase ImageUrls 처리 미들웨어
 * 
 * @description
 * req.body.imageUrls가 있으면:
 *  1. JSON 파싱 및 검증
 *  2. Firebase Storage에서 이미지 다운로드
 *  3. req.downloadedBuffers에 저장
 * 
 * 기존 req.files와 병행하여 작동하므로 하위 호환성 보장
 * 
 * @example
 * ```typescript
 * router.post("/generate-image",
 *   requireAuth,
 *   uploadFields,
 *   processFirebaseImageUrls,  // ← 한 줄 추가!
 *   async (req, res) => {
 *     const buffers = req.downloadedBuffers || getBuffersFromFiles(req.files);
 *   }
 * );
 * ```
 */
export async function processFirebaseImageUrls(
    req: Request,
    res: Response,
    next: NextFunction
) {
    // imageUrls 감지
    const imageUrlsRaw = req.body?.imageUrls;
    const hasImageUrls = imageUrlsRaw && typeof imageUrlsRaw === 'string' && imageUrlsRaw.trim() !== '';

    // imageUrls 없으면 패스 (파일 업로드 모드)
    if (!hasImageUrls) {
        return next();
    }

    console.log('🔥 [Firebase 미들웨어] imageUrls 감지');

    try {
        // 1. JSON 파싱
        const imageUrls = safeJsonParseArray<string>(imageUrlsRaw);

        if (imageUrls.length === 0) {
            console.log('⚠️ [Firebase 미들웨어] imageUrls 배열이 비어있음, 패스');
            return next();
        }

        // 2. URL 검증
        const validation = validateImageUrls(imageUrls);
        if (!validation.valid) {
            console.error('❌ [Firebase 미들웨어] URL 검증 실패:', validation.errors);
            return res.status(400).json({
                error: 'Firebase URL 검증 실패',
                details: validation.errors
            });
        }

        // 3. 다운로드
        const fetch = (await import('node-fetch')).default;
        const downloadedBuffers: Buffer[] = [];

        console.log(`📥 [Firebase 미들웨어] ${imageUrls.length}개 이미지 다운로드 시작...`);

        for (let i = 0; i < imageUrls.length; i++) {
            const url = imageUrls[i];
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const buffer = Buffer.from(await response.arrayBuffer());
                downloadedBuffers.push(buffer);
                console.log(`  ✅ [${i + 1}/${imageUrls.length}] ${url.substring(0, 50)}... (${buffer.length} bytes)`);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`  ❌ [${i + 1}/${imageUrls.length}] 다운로드 실패: ${url.substring(0, 50)}...`);
                console.error(`     오류: ${errorMsg}`);
                return res.status(500).json({
                    error: `이미지 다운로드 실패 (${i + 1}/${imageUrls.length})`,
                    url: url.substring(0, 100),
                    details: errorMsg
                });
            }
        }

        // 4. req에 저장 (TypeScript 확장 필요)
        (req as any).downloadedBuffers = downloadedBuffers;
        (req as any).isFirebaseMode = true;

        console.log(`✅ [Firebase 미들웨어] ${downloadedBuffers.length}개 이미지 다운로드 완료`);
        next();

    } catch (error) {
        console.error('❌ [Firebase 미들웨어] 처리 중 오류:', error);
        return res.status(500).json({
            error: 'Firebase 이미지 처리 실패',
            details: error instanceof Error ? error.message : String(error)
        });
    }
}
