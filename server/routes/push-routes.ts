import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import * as pushTokenService from '../services/push/push.token.service';

const router = Router();

/**
 * POST /api/users/device-token
 * FCM 토큰 등록/갱신 (profile.ts에서 이동)
 */
router.post("/api/users/device-token", requireAuth, async (req: Request, res: Response) => {
  try {
    const userIdRaw = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?.sub;
    const userId = Number(userIdRaw);
    const { token, deviceType = "unknown" } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    await pushTokenService.upsertDeviceToken(userId, token, deviceType);
    return res.json({ success: true, message: "Device token registered" });
  } catch (error) {
    console.error("Error saving device token:", error);
    return res.status(500).json({ error: "Failed to save device token" });
  }
});

/**
 * DELETE /api/users/device-token
 * 특정 토큰 비활성화 (로그아웃 시 프론트에서 호출)
 */
router.delete("/api/users/device-token", requireAuth, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    await pushTokenService.deactivateToken(token);
    return res.json({ success: true, message: "Device token deactivated" });
  } catch (error) {
    console.error("Error deactivating device token:", error);
    return res.status(500).json({ error: "Failed to deactivate device token" });
  }
});

export default router;
