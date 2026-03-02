import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { db } from "@db";
import { userDevices } from "../../shared/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

// Get or update the pregnancy profile
router.get("/api/pregnancy-profile", requireAuth, async (req, res) => {
  try {
    // JWT에서 userId 추출하고 숫자로 변환
    const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
    const userId = Number(userIdRaw);

    console.log("[프로필 조회] 사용자 ID:", userId, "타입:", typeof userId);

    const { getOrCreatePregnancyProfile } = await import("../services/milestones");
    const profile = await getOrCreatePregnancyProfile(userId);
    return res.json(profile || { error: "No profile found" });
  } catch (error) {
    console.error("Error fetching pregnancy profile:", error);
    return res.status(500).json({ error: "Failed to fetch pregnancy profile" });
  }
});

router.post("/api/pregnancy-profile", requireAuth, async (req, res) => {
  try {
    // JWT에서 userId 추출하고 숫자로 변환
    const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
    const userId = Number(userIdRaw);

    console.log("[프로필 저장] 사용자 ID:", userId, "타입:", typeof userId);

    const { updatePregnancyProfile } = await import("../services/milestones");
    const profileData = req.body;

    // Ensure dueDate is a proper Date object if provided
    if (profileData.dueDate) {
      profileData.dueDate = new Date(profileData.dueDate);
    }

    const profile = await updatePregnancyProfile(userId, profileData);

    if (!profile) {
      return res.status(400).json({ error: "Failed to update profile - dueDate is required" });
    }

    return res.json(profile);
  } catch (error) {
    console.error("Error updating pregnancy profile:", error);
    return res.status(500).json({ error: "Failed to update pregnancy profile" });
  }
});


// 📌 FCM Device Token 저장/갱신 API
router.post("/api/users/device-token", requireAuth, async (req, res) => {
  try {
    const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
    const userId = Number(userIdRaw);
    const { token, deviceType = "unknown" } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    console.log(`[FCM Token] 사용자 ID: ${userId}, Device Type: ${deviceType}, Token: ${token.substring(0, 10)}...`);

    // 1. 해당 토큰이 DB에 이미 존재하는지 확인
    const existingDevice = await db.query.userDevices.findFirst({
      where: eq(userDevices.deviceToken, token)
    });

    if (existingDevice) {
      // 2. 토큰이 존재하지만 다른 사용자의 소유이거나, 비활성화된 경우 업데이트
      await db.update(userDevices)
        .set({
          userId,
          deviceType,
          isActive: true,
          lastUsedAt: new Date(),
        })
        .where(eq(userDevices.id, existingDevice.id));

      return res.json({ success: true, message: "Device token updated" });
    } else {
      // 3. 완전히 새로운 토큰인 경우 Insert
      await db.insert(userDevices).values({
        userId,
        deviceToken: token,
        deviceType,
        isActive: true,
        lastUsedAt: new Date(),
      });

      return res.json({ success: true, message: "Device token registered" });
    }
  } catch (error) {
    console.error("Error saving device token:", error);
    return res.status(500).json({ error: "Failed to save device token" });
  }
});

export default router;
