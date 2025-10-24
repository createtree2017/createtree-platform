import { Router, Request } from "express";
import express from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { requirePremiumAccess, requireActiveHospital } from "../middleware/permission";
import * as Sentry from "@sentry/node";

const router = Router();

// Production 환경 체크 미들웨어
const productionGuard = (req: Request, res: express.Response, next: express.NextFunction) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Test endpoints are disabled in production',
      message: 'This endpoint is only available in development mode'
    });
  }
  next();
};

// 모든 테스트 라우트에 production guard 적용
router.use(productionGuard);

// ========== Sentry 모니터링 테스트 라우트 ==========

// 1. Sentry 설정 확인
router.get('/sentry-check', (req, res) => {
  const sentryDsn = process.env.SENTRY_DSN;
  const isConfigured = !!sentryDsn;
  
  res.json({
    success: true,
    sentry: {
      configured: isConfigured,
      dsnExists: isConfigured,
      dsnPrefix: sentryDsn ? sentryDsn.substring(0, 30) + '...' : 'Not set',
      environment: process.env.NODE_ENV || 'development'
    },
    message: isConfigured 
      ? '✅ Sentry가 올바르게 설정되었습니다' 
      : '❌ SENTRY_DSN 환경변수가 설정되지 않았습니다'
  });
});

// 2. 간단한 에러 테스트
router.get('/sentry-test', (req, res) => {
  try {
    console.log('🧪 Sentry 테스트 에러 발생 시뮬레이션...');
    
    // Sentry에 직접 에러 전송
    Sentry.captureException(new Error('Sentry 테스트 에러입니다!'), {
      tags: {
        test: 'true',
        endpoint: '/api/test/sentry-test'
      },
      level: 'warning'
    });
    
    res.json({
      success: true,
      message: '✅ 테스트 에러가 Sentry로 전송되었습니다!',
      instruction: 'Sentry 대시보드(https://sentry.io)에서 에러를 확인하세요.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Sentry 테스트 실패' });
  }
});

// 3. 실제 에러 발생 테스트 (에러 핸들러를 통해)
router.get('/sentry-error', (req, res, next) => {
  console.log('🧪 실제 에러 발생 테스트 (에러 핸들러 통과)...');
  
  // 의도적으로 에러 발생 (에러 핸들러가 Sentry에 자동 전송)
  const error: any = new Error('의도적으로 발생시킨 테스트 에러입니다!');
  error.statusCode = 500;
  error.userId = 'test-user';
  error.testContext = {
    purpose: 'Sentry integration test',
    timestamp: new Date().toISOString()
  };
  
  next(error); // 에러 핸들러로 전달
});

// 4. 인증된 사용자 에러 테스트
router.get('/sentry-auth-error', requireAuth, (req, res, next) => {
  console.log('🧪 인증된 사용자 에러 테스트...');
  
  const error: any = new Error('인증된 사용자 에러 테스트');
  error.statusCode = 500;
  error.userInfo = {
    id: req.user?.id,
    email: req.user?.email,
    memberType: req.user?.memberType
  };
  
  next(error); // Sentry에 사용자 정보와 함께 전송됨
});

// 5. 다양한 심각도 테스트
router.post('/sentry-levels', (req, res) => {
  const { level = 'error', message = 'Test message' } = req.body;
  
  console.log(`🧪 Sentry ${level} 레벨 테스트...`);
  
  switch (level) {
    case 'info':
      Sentry.captureMessage(message, 'info');
      break;
    case 'warning':
      Sentry.captureMessage(message, 'warning');
      break;
    case 'error':
      Sentry.captureException(new Error(message));
      break;
    case 'fatal':
      Sentry.captureException(new Error(message), { level: 'fatal' });
      break;
    default:
      Sentry.captureMessage(message);
  }
  
  res.json({
    success: true,
    level,
    message,
    sentryMessage: `${level.toUpperCase()} 레벨의 메시지가 Sentry로 전송되었습니다`
  });
});

// [TEST] GCS upload test endpoint
const uploadTest = multer({ dest: 'temp/' });

router.post('/gcs-test', uploadTest.single('file'), async (req, res) => {
  try {
    console.log('🧪 GCS 테스트 엔드포인트 호출됨');

    if (!req.file) {
      return res.status(400).json({ error: '파일이 없습니다.' });
    }

    const { bucket } = await import('../firebase') as { bucket: any };
    const fs = await import('fs');

    const userId = 'test-user';
    const file = req.file;
    const destination = `${userId}/${Date.now()}_${file.originalname}`;

    console.log('📤 GCS 업로드 시작:', destination);

    // GCS에 업로드 (공개 모드)
    await bucket.upload(file.path, {
      destination,
      metadata: {
        contentType: file.mimetype,
      },
      public: true,
    });

    // 임시 파일 삭제
    fs.unlinkSync(file.path);

    // 공개 URL 생성
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;

    console.log('✅ GCS 업로드 성공:', destination);
    res.status(200).json({
      success: true,
      url: publicUrl,
      gsPath: `gs://${bucket.name}/${destination}`,
      message: 'GCS 업로드 테스트 성공',
      bucket: bucket.name,
      destination: destination
    });

  } catch (error: any) {
    console.error('❌ GCS 업로드 실패:', error);

    // 임시 파일이 있다면 삭제
    const fsModule = await import('fs');
    if (req.file && fsModule.existsSync(req.file.path)) {
      fsModule.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: 'GCS 업로드 실패',
      details: error?.message || '알 수 없는 오류'
    });
  }
});

// 권한 시스템 테스트 전용 API
router.post("/permissions", requireAuth, requirePremiumAccess, requireActiveHospital(), (req, res) => {
  res.json({
    success: true,
    message: "권한 확인 완료 - 모든 권한 미들웨어를 통과했습니다",
    userInfo: {
      id: req.user?.id,
      memberType: req.user?.memberType,
      hospitalId: req.user?.hospitalId,
      hasPermission: true
    },
    timestamp: new Date().toISOString()
  });
});

// 테스트용 스키마 확인 엔드포인트
router.get('/schema/:tableName', async (req: Request, res: express.Response) => {
  try {
    const { tableName } = req.params;

    if (tableName === 'milestone_application_files') {
      // milestoneApplicationFiles 테이블 스키마 정보 반환
      const schema = {
        tableName: 'milestone_application_files',
        columns: [
          { name: 'id', type: 'serial', nullable: false },
          { name: 'applicationId', type: 'integer', nullable: false },
          { name: 'fileName', type: 'text', nullable: false },
          { name: 'originalName', type: 'text', nullable: false },
          { name: 'mimeType', type: 'text', nullable: false },
          { name: 'fileSize', type: 'integer', nullable: false },
          { name: 'filePath', type: 'text', nullable: false },
          { name: 'description', type: 'text', nullable: true },
          { name: 'uploadedAt', type: 'timestamp', nullable: false },
          { name: 'uploadedBy', type: 'integer', nullable: false },
          { name: 'isDeleted', type: 'boolean', nullable: false, default: false }
        ]
      };

      res.json(schema);
    } else {
      res.status(404).json({ error: 'Table not found or not supported' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Schema query failed' });
  }
});

// 테스트용 Multer 설정 확인 엔드포인트
router.get('/multer-config', async (req: Request, res: express.Response) => {
  try {
    // Multer 설정이 올바른지 확인
    const multerConfig = {
      configured: true,
      maxFileSize: '10MB',
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      uploadDirectory: 'uploads/'
    };

    res.json(multerConfig);
  } catch (error) {
    res.status(500).json({ error: 'Multer configuration check failed' });
  }
});

// ========== OpenAI API 테스트 라우트 ==========
router.post('/openai', async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const keyExists = !!apiKey;
    const keyPrefix = apiKey ? apiKey.substring(0, 7) + "..." : "없음";
    const keyType = apiKey?.startsWith('sk-proj-') ? 'Project Key' : apiKey?.startsWith('sk-') ? 'Standard Key' : 'Invalid';

    console.log("🔑 API 키 상태 확인:");
    console.log("  - 키 존재:", keyExists);
    console.log("  - 키 접두사:", keyPrefix);
    console.log("  - 키 타입:", keyType);

    // 간단한 API 호출 테스트 (할당량 소모 최소화)
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const statusCode = response.status;

      if (response.ok) {
        console.log("✅ OpenAI API 연결 성공");
        res.json({
          success: true,
          apiKeyStatus: "valid",
          keyPrefix,
          keyType,
          apiResponse: "연결 성공"
        });
      } else {
        const errorData = await response.text();
        console.log("❌ OpenAI API 오류:", statusCode, errorData);
        res.json({
          success: false,
          apiKeyStatus: "error",
          keyPrefix,
          keyType,
          statusCode,
          error: errorData
        });
      }
    } catch (apiError) {
      console.log("❌ API 호출 실패:", apiError);
      res.json({
        success: false,
        apiKeyStatus: "connection_failed",
        keyPrefix,
        keyType,
        error: String(apiError)
      });
    }
  } catch (error) {
    console.error("테스트 엔드포인트 오류:", error);
    res.status(500).json({ success: false, error: "테스트 실패" });
  }
});

// ========== Pollo AI 테스트 라우트 ==========
router.post("/pollo-image", async (req, res) => {
  try {
    // USE_POLLO_API 환경변수 확인
    const usePolloApi = process.env.USE_POLLO_API === 'true';

    if (!usePolloApi) {
      return res.status(400).json({
        error: "Pollo API is not enabled. Set USE_POLLO_API=true to test."
      });
    }

    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    console.log(`[Pollo Test] 이미지 생성 테스트 시작: ${prompt}`);

    // Pollo 서비스 가져오기
    const { generateImageWithPollo } = await import("../services/pollo-service");

    // Pollo API로 이미지 생성
    const imageUrl = await generateImageWithPollo(prompt);

    console.log(`[Pollo Test] 이미지 생성 성공: ${imageUrl}`);

    return res.json({
      success: true,
      message: "Pollo API test successful",
      imageUrl,
      prompt,
      engine: "pollo"
    });

  } catch (error) {
    console.error("[Pollo Test] 오류:", error);
    return res.status(500).json({
      error: "Pollo API test failed",
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
