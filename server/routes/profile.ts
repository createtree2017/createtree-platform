import { Router } from "express";
import { requireAuth } from "../middleware/auth";

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

export default router;
