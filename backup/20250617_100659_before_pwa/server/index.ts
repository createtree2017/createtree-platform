import 'dotenv/config'; // 꼭 index.ts 최상단에서 실행
import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startAutoChatSaver } from "./services/auto-chat-saver";
import session from "express-session";
import cookieParser from "cookie-parser";

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 업로드 디렉토리를 정적 파일로 제공
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.mp3')) {
      res.set('Content-Type', 'audio/mpeg');
      res.set('Accept-Ranges', 'bytes');
    }
  }
}));

// 정적 파일 폴더 (기본 오디오 파일 등을 위해)
app.use('/static', express.static(path.join(process.cwd(), 'static')));

// CORS 설정 추가 - 세션 쿠키 전달을 위한 credentials 설정 필수
import cors from 'cors';
app.use(cors({
  // 프로덕션에서는 정확한 도메인으로 제한해야 함
  origin: true, // 개발 환경에서는 요청 Origin을 그대로 허용
  credentials: true, // 쿠키 전송을 위해 필수
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

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
        res.setHeader("Access-Control-Allow-Origin", "*");
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
        const response = await fetch(musicUrl, {
          headers: { Range: range }
        });

        if (!response.ok || !response.body) {
          return res.status(502).send("Failed to fetch from external URL");
        }

        res.status(response.status);
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Range");
        
        // 외부 URL 응답 헤더 복사 (Content-Length, Content-Range 포함)
        const contentLength = response.headers.get('content-length');
        const contentRange = response.headers.get('content-range');
        
        if (contentLength) {
          res.setHeader('Content-Length', contentLength);
        }
        if (contentRange) {
          res.setHeader('Content-Range', contentRange);
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

// 🔥 Vite 우회 - Express Router 대신 직접 등록
const { db } = await import("../db/index");
const { smallBanners } = await import("@shared/schema");

// 🔥 GET 소형 배너 목록 API 
app.get("/api/small-banners", async (req, res) => {
  try {
    console.log("📋 소형 배너 목록 조회 요청");
    const bannerList = await db.select().from(smallBanners).orderBy(smallBanners.order);
    
    // 프론트엔드 인터페이스에 맞게 필드명 변환
    const formattedBanners = bannerList.map(banner => ({
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
  const server = await registerRoutes(app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // 에러 핸들러는 Vite 설정 후에 배치
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.

  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // 서버 시작 시 자동 저장 기능 활성화 (30분 간격)
    startAutoChatSaver(30);
    log(`자동 채팅 저장 시스템이 활성화되었습니다 (30분 간격)`);
  });
})();
