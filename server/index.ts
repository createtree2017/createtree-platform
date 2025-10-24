import 'dotenv/config'; // 꼭 index.ts 최상단에서 실행

// Sentry 초기화 (반드시 다른 모든 import보다 먼저!)
import './instrument';

import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Firebase 초기화 - 서버 시작 시 로드하여 인증 설정
import './firebase';

import session from "express-session";
import cookieParser from "cookie-parser";
import { apiRateLimiter } from "./middleware/rate-limiter";
import { forceHTTPS, securityHeaders, productionCORS, validateApiKeys, securityLogger, ipFilter } from "./middleware/security";
import { imageProxyMiddleware, bannerProxyMiddleware } from "./middleware/image-proxy";

const app = express();

// 보안 미들웨어 적용 (개발 환경에서는 iframe 로드를 위해 일부 제한)
app.use(forceHTTPS());
if (process.env.NODE_ENV === 'production') {
  app.use(securityHeaders());
}
app.use(ipFilter());
app.use(securityLogger());
app.use(validateApiKeys());

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 🔄 이미지 프록시 미들웨어 (로컬 파일 없으면 GCS에서 찾기)
// 이미지 파일만 처리하고, 나머지는 다음 미들웨어로 넘김
app.use('/uploads', (req, res, next) => {
  const requestedPath = req.path;
  // 이미지 파일인지 확인
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  const ext = path.extname(requestedPath).toLowerCase();
  
  if (imageExtensions.includes(ext)) {
    // 이미지 파일이면 우리 프록시 미들웨어로 처리
    return imageProxyMiddleware(req, res, next);
  } else {
    // 이미지가 아니면 다음 미들웨어(express.static)로 넘김
    return next();
  }
});

// 🔄 업로드 파일 프록시 시스템
// 이미지: imageProxyMiddleware가 처리 (로컬 파일 우선, GCS 폴백)
// 음악: /api/music/stream/:id 엔드포인트에서 서빙
// 기타 파일: 각각의 전용 API 엔드포인트에서 서빙

// 🔄 배너 이미지 프록시 미들웨어 (로컬 파일 우선, 없으면 GCS 프록시, 마지막 fallback)
// /static/banner/ 경로의 이미지 파일만 처리하고, 나머지는 다음 미들웨어로 넘김
app.use('/static/banner', (req, res, next) => {
  const requestedPath = req.path;
  // 이미지 파일인지 확인
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  const ext = path.extname(requestedPath).toLowerCase();
  
  if (imageExtensions.includes(ext)) {
    // 이미지 파일이면 새로운 배너 프록시 미들웨어로 처리
    console.log(`🎯 [Banner] 배너 프록시 처리: /static/banner${requestedPath}`);
    return bannerProxyMiddleware(req, res, next);
  } else {
    // 이미지가 아니면 다음 미들웨어(express.static)로 넘김
    return next();
  }
});

// 배너 파일들을 위한 정적 파일 서빙 (이미지 프록시 후 fallback)
app.use('/static/banner', express.static(path.join(process.cwd(), 'static', 'banner'), {
  setHeaders: (res, path) => {
    // 일반 웹사이트 캐시 정책 - 성능 최적화
    res.set('Cache-Control', 'public, max-age=31536000'); // 1년 캐시
    res.set('ETag', 'strong');
  }
}));

// 정적 파일 폴더 (기본 오디오 파일 등을 위해)
app.use('/static', express.static(path.join(process.cwd(), 'static'), {
  setHeaders: (res, path) => {
    // 일반 웹사이트 캐시 정책 - 성능 최적화
    res.set('Cache-Control', 'public, max-age=31536000'); // 1년 캐시
    res.set('ETag', 'strong');
  }
}));

// 콜라주 파일 서빙 - uploads 폴더에서 실제 파일 제공
app.use('/uploads/collages', express.static(path.join(process.cwd(), 'public', 'uploads', 'collages'), {
  setHeaders: (res, path) => {
    // 일반 웹사이트 캐시 정책 - 성능 최적화
    res.set('Cache-Control', 'public, max-age=31536000'); // 1년 캐시
    res.set('ETag', 'strong');
  }
}));

// 🔒 보안 강화된 CORS 설정 - 환경별 조건부 적용
import cors from 'cors';

// 환경변수에서 허용된 도메인 목록 파싱
const getAllowedOrigins = (): string[] | boolean => {
  if (process.env.NODE_ENV !== 'production') {
    // 개발 환경에서는 모든 origin 허용 (기존 워크플로우 유지)
    return true;
  }
  
  // 프로덕션 환경에서는 ALLOWED_ORIGINS 환경변수에서 도메인 목록 가져오기
  const allowedOrigins = process.env.ALLOWED_ORIGINS;
  if (allowedOrigins) {
    // 쉼표로 구분된 도메인 목록을 배열로 변환
    return allowedOrigins.split(',').map(origin => origin.trim());
  }
  
  // ALLOWED_ORIGINS가 설정되지 않은 경우 기본 허용 도메인
  // 실제 프로덕션에서는 반드시 ALLOWED_ORIGINS 환경변수를 설정해야 함
  console.warn('⚠️ ALLOWED_ORIGINS 환경변수가 설정되지 않았습니다. 프로덕션에서는 보안상 위험할 수 있습니다.');
  return [
    'https://your-domain.com',
    'https://www.your-domain.com'
  ];
};

const corsOptions = {
  origin: getAllowedOrigins(),
  credentials: true, // 쿠키 전송을 위해 필수
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // IE11 호환성을 위한 설정
};

// CORS 정책 로깅 (보안 감사용)
console.log(`🔒 CORS 정책 적용 - 환경: ${process.env.NODE_ENV || 'development'}`);
if (process.env.NODE_ENV === 'production') {
  console.log('🔒 프로덕션 모드: 특정 도메인만 허용');
  console.log('🔒 허용된 도메인:', corsOptions.origin);
} else {
  console.log('🔒 개발 모드: 모든 도메인 허용');
}

app.use(cors(corsOptions));

// API Rate Limiting 적용 (분당 100회 제한)
app.use('/api', apiRateLimiter.middleware());

// 세션 설정은 routes.ts에서 처리
// 참고: 이전에 이 위치에 있던 세션 설정은 routes.ts의 설정과 충돌을 일으켜 제거됨

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// 🔥 핵심 API들을 Vite보다 먼저 등록 - 구조적 우선순위 보장

// 음악 스트리밍 API (GCS + 로컬 파일 지원)
app.options("/api/music/stream/:id", (req, res) => {
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
  res.status(200).end();
});

app.get("/api/music/stream/:id", async (req, res) => {
  const { id } = req.params;
  const range = req.headers.range || 'bytes=0-';

  try {
    const { db } = await import("../db/index");
    const { music } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");

    const found = await db.select().from(music).where(eq(music.id, Number(id))).limit(1);
    if (!found.length) return res.status(404).send("Music not found");

    const musicData = found[0];
    const musicUrl = musicData.url;
    if (!musicUrl) {
      return res.status(404).send("Music URL not found");
    }

    console.log(`🎵 음악 스트리밍: ID=${id}, URL=${musicUrl}`);

    // GCS URL인 경우
    if (musicUrl.startsWith("https://storage.googleapis.com")) {
      try {
        // 먼저 HEAD 요청으로 전체 파일 크기 확인
        let totalFileSize = null;
        try {
          const headResponse = await fetch(musicUrl, { method: 'HEAD' });
          if (headResponse.ok) {
            totalFileSize = headResponse.headers.get('content-length');
          }
        } catch (headError) {
          console.log('HEAD 요청 실패, 계속 진행');
        }

        const response = await fetch(musicUrl, {
          headers: { Range: range }
        });

        if (!response.ok || !response.body) {
          console.error(`GCS fetch failed: ${response.status} ${response.statusText}`);
          return res.status(502).send("Failed to fetch from GCS");
        }

        res.status(response.status);
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Range");
        
        // Content-Length와 Content-Range 설정
        const responseContentLength = response.headers.get('content-length');
        const contentRange = response.headers.get('content-range');
        
        if (responseContentLength) {
          res.setHeader('Content-Length', responseContentLength);
        } else if (totalFileSize && !range) {
          // Range 요청이 아니고 전체 파일 크기를 알고 있는 경우
          res.setHeader('Content-Length', totalFileSize);
        }
        
        if (contentRange) {
          res.setHeader('Content-Range', contentRange);
        } else if (totalFileSize && !range) {
          // Range 요청이 아닌 경우 전체 파일 크기 표시
          res.setHeader('Content-Range', `bytes 0-${parseInt(totalFileSize) - 1}/${totalFileSize}`);
        }
        
        // ReadableStream을 Node.js Response로 변환
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            break;
          }
          res.write(Buffer.from(value));
        }
        return;
      } catch (fetchError) {
        console.error("GCS fetch error:", fetchError);
        return res.status(502).send("GCS fetch failed");
      }
    }

    // 다른 외부 URL인 경우 (Suno 등)
    if (musicUrl.startsWith("http")) {
      try {
        // 먼저 HEAD 요청으로 전체 파일 크기 확인
        let totalFileSize;
        try {
          const headResponse = await fetch(musicUrl, { method: 'HEAD' });
          if (headResponse.ok) {
            totalFileSize = headResponse.headers.get('content-length');
          }
        } catch (headError) {
          // HEAD 요청 실패 시 계속 진행
        }

        const response = await fetch(musicUrl, {
          headers: { Range: range }
        });

        if (!response.ok || !response.body) {
          return res.status(502).send("Failed to fetch from external URL");
        }

        // 브라우저 호환성을 위한 헤더 설정
        res.status(response.status === 206 ? 206 : 200);
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
        res.setHeader("Cache-Control", "public, max-age=31536000"); // 일반 오디오 캐시 정책
        
        // 외부 URL 응답 헤더 복사
        const contentLength = response.headers.get('content-length');
        const contentRange = response.headers.get('content-range');
        
        if (contentLength) {
          res.setHeader('Content-Length', contentLength);
        } else if (totalFileSize) {
          res.setHeader('Content-Length', totalFileSize);
        }
        
        if (contentRange) {
          res.setHeader('Content-Range', contentRange);
        } else if (totalFileSize && range === 'bytes=0-') {
          res.setHeader('Content-Range', `bytes 0-${parseInt(totalFileSize) - 1}/${totalFileSize}`);
        }
        
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            break;
          }
          res.write(Buffer.from(value));
        }
        return;
      } catch (fetchError) {
        console.error("External URL fetch error:", fetchError);
        return res.status(502).send("External fetch failed");
      }
    }

    // 로컬 파일인 경우
    if (musicUrl.startsWith("/static/")) {
      const path = await import("path");
      const fs = await import("fs");
      
      const filePath = path.join(process.cwd(), musicUrl);
      if (!fs.existsSync(filePath)) {
        return res.status(404).send("Local file not found");
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const start = Number(range.replace(/bytes=/, '').split('-')[0]);
      const end = fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'audio/mpeg',
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
      return;
    }

    return res.status(403).send("Unsupported URL format");

  } catch (err) {
    console.error("Streaming error:", err);
    res.status(500).send("Server error");
  }
});

app.post("/api/test", (req, res) => {
  console.log("🔥🔥🔥 테스트 POST API HIT!!!");
  res.json({ message: "성공" });
});

app.post("/api/create-small-banner", async (req, res) => {
  console.log("🚨🚨🚨🚨🚨 배너 생성 API HIT!!! 🚨🚨🚨🚨🚨");
  console.log("📥 받은 데이터:", JSON.stringify(req.body, null, 2));
  
  try {
    const { db } = await import("../db/index");
    const { smallBanners } = await import("@shared/schema");
    
    const bannerData = {
      title: req.body.title,
      description: req.body.description,
      imageUrl: req.body.imageSrc,
      linkUrl: req.body.href,
      isActive: req.body.isActive,
      order: req.body.order
    };
    
    console.log("💾 DB 저장할 데이터:", bannerData);
    
    const newBanner = await db.insert(smallBanners).values(bannerData).returning();
    
    console.log("🎉🎉🎉 배너 생성 성공!!!", newBanner[0]);
    
    return res.status(201).json(newBanner[0]);
  } catch (error) {
    console.error("💥💥💥 배너 생성 실패:", error);
    return res.status(500).json({ error: "Failed to create banner" });
  }
});

// 🔥 Vite 우회 - Express Router 대신 직접 등록 (top-level await 제거)
let db: any;
let smallBanners: any;
try {
  const dbModule = await import("../db/index");
  const schemaModule = await import("@shared/schema");
  db = dbModule.db;
  smallBanners = schemaModule.smallBanners;
} catch (error) {
  console.error("데이터베이스 초기화 실패:", error);
}

// 🔥 GET 소형 배너 목록 API 
app.get("/api/small-banners", async (req, res) => {
  try {
    console.log("📋 소형 배너 목록 조회 요청");
    const bannerList = await db.select().from(smallBanners).orderBy(smallBanners.order);
    
    // 프론트엔드 인터페이스에 맞게 필드명 변환
    const formattedBanners = bannerList.map((banner: any) => ({
      id: banner.id,
      title: banner.title,
      description: banner.description,
      imageSrc: banner.imageUrl,  // imageUrl -> imageSrc로 변환
      href: banner.linkUrl,       // linkUrl -> href로 변환
      isActive: banner.isActive,
      order: banner.order,
      createdAt: banner.createdAt
    }));
    
    console.log("✅ 조회 성공, 개수:", formattedBanners.length);
    res.json(formattedBanners);
  } catch (error) {
    console.error("❌ 소형 배너 조회 실패:", error);
    res.status(500).json({ error: "Failed to fetch small banners" });
  }
});

(async () => {
  // 프로덕션 환경에서는 정적 파일 먼저 서빙
  if (app.get("env") === "production") {
    const distPath = path.join(process.cwd(), 'dist', 'public');
    
    // 정적 파일 서빙 (CSS, JS, images 등) - API 라우트보다 먼저!
    app.use(express.static(distPath, {
      maxAge: '1y',
      etag: true,
      lastModified: true,
      setHeaders: (res, filepath) => {
        // Service Worker는 캐시하지 않음
        if (filepath.includes('sw.js')) {
          res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      }
    }));
  }

  // API 라우트 등록
  const server = await registerRoutes(app);

  // 개발 환경에서는 Vite 설정
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    // 프로덕션: SPA fallback - 모든 나머지 경로를 index.html로
    const distPath = path.join(process.cwd(), 'dist', 'public');
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 커스텀 에러 핸들러 (Sentry 이후)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Port configuration for different environments
  // Replit: port 5000, Firebase App Hosting: PORT environment variable (8080)
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // 서버 시작 시 자동 저장 기능 활성화 (30분 간격)

    log(`자동 채팅 저장 시스템이 활성화되었습니다 (30분 간격)`);
  });
})();
