/**
 * 이미지 프록시 보안 테스트
 * 모든 경로 트래버설 공격 벡터를 차단하는지 검증
 */

import request from 'supertest';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { imageProxyMiddleware } from '../middleware/image-proxy';

const app = express();
app.use('/uploads', imageProxyMiddleware);

describe('Image Proxy Security Tests', () => {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const testFile = path.join(uploadsDir, 'test-image.jpg');
  const dangerousDir = path.join(process.cwd(), 'dangerous');
  const dangerousFile = path.join(dangerousDir, 'secret.txt');

  beforeAll(async () => {
    // 테스트 환경 설정
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(dangerousDir, { recursive: true });
    
    // 정상 테스트 파일 생성
    await fs.writeFile(testFile, 'test image content');
    
    // 위험한 파일 생성 (시스템 외부)
    await fs.writeFile(dangerousFile, 'SECRET CONTENT');
  });

  afterAll(async () => {
    // 테스트 파일 정리
    try {
      await fs.unlink(testFile);
      await fs.unlink(dangerousFile);
      await fs.rmdir(dangerousDir);
    } catch (error) {
      // 무시 - 테스트 정리
    }
  });

  describe('기본 경로 트래버설 공격 차단', () => {
    test('상위 디렉터리 접근 시도 ../../../etc/passwd', async () => {
      const response = await request(app)
        .get('/uploads/../../../etc/passwd')
        .expect(403);
      
      expect(response.body.error).toBe('Access denied');
      expect(response.body.message).toBe('Path traversal attack detected');
    });

    test('다중 상위 디렉터리 접근 시도', async () => {
      const response = await request(app)
        .get('/uploads/../../../../dangerous/secret.txt')
        .expect(403);
      
      expect(response.body.error).toBe('Access denied');
    });

    test('현재 디렉터리 우회 시도 ./../../etc/passwd', async () => {
      const response = await request(app)
        .get('/uploads/./../../etc/passwd')
        .expect(403);
      
      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('URL 인코딩 우회 공격 차단', () => {
    test('URL 인코딩된 상위 디렉터리 %2e%2e', async () => {
      const response = await request(app)
        .get('/uploads/%2e%2e/%2e%2e/etc/passwd')
        .expect(403);
      
      expect(response.body.error).toBe('Access denied');
    });

    test('이중 URL 인코딩 %252e%252e', async () => {
      const response = await request(app)
        .get('/uploads/%252e%252e/%252e%252e/etc/passwd')
        .expect(403);
      
      expect(response.body.error).toBe('Access denied');
    });

    test('Unicode 인코딩 우회 시도', async () => {
      const response = await request(app)
        .get('/uploads/\u002e\u002e/\u002e\u002e/etc/passwd')
        .expect(403);
      
      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('Windows 스타일 경로 공격 차단', () => {
    test('백슬래시 디렉터리 트래버설', async () => {
      const response = await request(app)
        .get('/uploads/..\\..\\..\\windows\\system32\\drivers\\etc\\hosts')
        .expect(403);
      
      expect(response.body.error).toBe('Access denied');
    });

    test('혼합 슬래시 스타일', async () => {
      const response = await request(app)
        .get('/uploads/../..\\../etc/passwd')
        .expect(403);
      
      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('심볼릭 링크 공격 차단', () => {
    const symlinkPath = path.join(uploadsDir, 'malicious-link');

    beforeEach(async () => {
      try {
        // 기존 심볼릭 링크 제거
        await fs.unlink(symlinkPath);
      } catch (error) {
        // 무시 - 파일이 없을 수 있음
      }
    });

    afterEach(async () => {
      try {
        // 테스트 후 심볼릭 링크 정리
        await fs.unlink(symlinkPath);
      } catch (error) {
        // 무시 - 파일이 없을 수 있음
      }
    });

    test('시스템 디렉터리를 가리키는 심볼릭 링크 차단', async () => {
      // 심볼릭 링크 생성 (uploads 내부에서 외부 시스템 디렉터리를 가리킴)
      try {
        await fs.symlink('/etc', symlinkPath);
      } catch (error) {
        // 심볼릭 링크 생성 실패 시 테스트 스킵
        return;
      }

      const response = await request(app)
        .get('/uploads/malicious-link/passwd')
        .expect(403);
      
      expect(response.body.error).toBe('Access denied');
      expect(response.body.message).toBe('Symlink access denied');
    });

    test('상위 디렉터리를 가리키는 심볼릭 링크 차단', async () => {
      try {
        await fs.symlink('../dangerous', symlinkPath);
      } catch (error) {
        // 심볼릭 링크 생성 실패 시 테스트 스킵
        return;
      }

      const response = await request(app)
        .get('/uploads/malicious-link/secret.txt')
        .expect(403);
      
      expect(response.body.error).toBe('Access denied');
      expect(response.body.message).toBe('Symlink access denied');
    });

    test('절대 경로를 가리키는 심볼릭 링크 차단', async () => {
      try {
        await fs.symlink(dangerousDir, symlinkPath);
      } catch (error) {
        // 심볼릭 링크 생성 실패 시 테스트 스킵
        return;
      }

      const response = await request(app)
        .get('/uploads/malicious-link/secret.txt')
        .expect(403);
      
      expect(response.body.error).toBe('Access denied');
      expect(response.body.message).toBe('Symlink access denied');
    });
  });

  describe('고급 경로 트래버설 공격 차단', () => {
    test('널 바이트 인젝션 시도', async () => {
      const response = await request(app)
        .get('/uploads/../../../etc/passwd\0.jpg')
        .expect(403);
      
      expect(response.body.error).toBe('Access denied');
    });

    test('긴 파일명을 이용한 버퍼 오버플로우 시도', async () => {
      const longPath = '../'.repeat(1000) + 'etc/passwd';
      const response = await request(app)
        .get(`/uploads/${longPath}`)
        .expect(403);
      
      expect(response.body.error).toBe('Access denied');
    });

    test('대소문자 조합 우회 시도', async () => {
      const response = await request(app)
        .get('/uploads/../../../ETC/PASSWD')
        .expect(403);
      
      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('정상 파일 접근 허용', () => {
    test('uploads 디렉터리 내 정상 파일은 접근 허용', async () => {
      const response = await request(app)
        .get('/uploads/test-image.jpg')
        .expect(200);
      
      expect(response.text).toBe('test image content');
    });

    test('하위 디렉터리의 정상 파일 접근 허용', async () => {
      const subDir = path.join(uploadsDir, 'subdir');
      const subFile = path.join(subDir, 'sub-image.jpg');
      
      await fs.mkdir(subDir, { recursive: true });
      await fs.writeFile(subFile, 'sub image content');

      const response = await request(app)
        .get('/uploads/subdir/sub-image.jpg')
        .expect(200);
      
      expect(response.text).toBe('sub image content');

      // 정리
      await fs.unlink(subFile);
      await fs.rmdir(subDir);
    });
  });

  describe('경계 조건 테스트', () => {
    test('uploads 디렉터리 자체 접근', async () => {
      const response = await request(app)
        .get('/uploads/')
        .expect(404); // 디렉터리 리스팅은 허용하지 않음
    });

    test('빈 경로', async () => {
      const response = await request(app)
        .get('/uploads')
        .expect(404);
    });

    test('존재하지 않는 정상 파일', async () => {
      const response = await request(app)
        .get('/uploads/nonexistent.jpg')
        .expect(404);
      
      expect(response.body.error).toBe('Image not found');
    });
  });
});