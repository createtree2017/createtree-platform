import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { bucket } from '../firebase.js';

const router = express.Router();

// Multer 설정 - 임시 디렉토리에 저장
const upload = multer({ dest: 'temp/' });

// GCS 업로드 테스트 API (인증 없음)
router.post('/test', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 없습니다.' });
    }

    const userId = 'test-user';
    const file = req.file;
    const destination = `uploads/${userId}/${Date.now()}_${file.originalname}`;

    // GCS에 업로드 (공개 모드)
    await bucket.upload(file.path, {
      destination,
      metadata: {
        contentType: file.mimetype,
      },
      public: true, // 공개 파일로 설정
    });

    // 임시 파일 삭제
    fs.unlinkSync(file.path);
    
    // 공개 URL 생성
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
    
    console.log('GCS 업로드 성공:', destination);
    res.status(200).json({ 
      url: publicUrl, 
      gsPath: `gs://${bucket.name}/${destination}`,
      message: 'GCS 업로드 테스트 성공',
      destination: destination
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    // 임시 파일이 있다면 삭제
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// GCS 업로드 API (인증 필요)
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 없습니다.' });
    }

    // 사용자 ID 가져오기 (인증된 사용자 또는 요청에서)
    const userId = req.user?.id || req.body.userId || 'anonymous';
    
    const file = req.file;
    const destination = `uploads/${userId}/${Date.now()}_${file.originalname}`;

    // GCS에 업로드 (공개 모드)
    await bucket.upload(file.path, {
      destination,
      metadata: {
        contentType: file.mimetype,
      },
      public: true, // 공개 파일로 설정
    });

    // 임시 파일 삭제
    fs.unlinkSync(file.path);
    
    // 공개 URL 생성
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
    
    console.log('GCS 업로드 성공:', destination);
    res.status(200).json({ 
      url: publicUrl,
      gsPath: `gs://${bucket.name}/${destination}`,
      destination: destination
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    // 임시 파일이 있다면 삭제
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;