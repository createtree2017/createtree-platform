import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { db } from "../../db/index";
import { userNotificationSettings, userSettings } from "../../shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// 알림 설정 조회 API
router.get("/notification-settings", requireAuth, async (req, res) => {
  try {
    console.log("알림 설정 조회 요청 - req.user:", req.user);
    // JWT에서 userId 추출하고 숫자로 변환
    const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
    const userId = Number(userIdRaw);
    console.log("조회용 userId:", userId, "타입:", typeof userId);

    const settings = await db.query.userNotificationSettings.findFirst({
      where: eq(userNotificationSettings.userId, userId)
    });

    if (!settings) {
      // 기본 설정으로 새 레코드 생성
      const [newSettings] = await db.insert(userNotificationSettings)
        .values({
          userId,
          emailNotifications: true,
          pushNotifications: false,
          pregnancyReminders: true,
          weeklyUpdates: true,
          promotionalEmails: false,
        })
        .returning();

      return res.json({ success: true, settings: newSettings });
    }

    return res.json({ success: true, settings });
  } catch (error) {
    console.error("알림 설정 조회 오류:", error);
    return res.status(500).json({
      success: false,
      message: "알림 설정을 불러오는 중 오류가 발생했습니다."
    });
  }
});

// 알림 설정 업데이트 API
router.put("/notification-settings", requireAuth, async (req, res) => {
  try {
    console.log("알림 설정 업데이트 요청 - req.user:", req.user);
    // JWT에서 userId 추출하고 숫자로 변환
    const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
    const userId = Number(userIdRaw);
    console.log("추출된 userId:", userId, "타입:", typeof userId);
    const { emailNotifications, pushNotifications, pregnancyReminders, weeklyUpdates, promotionalEmails } = req.body;

    const existingSettings = await db.query.userNotificationSettings.findFirst({
      where: eq(userNotificationSettings.userId, userId)
    });

    let updatedSettings;

    if (existingSettings) {
      [updatedSettings] = await db.update(userNotificationSettings)
        .set({
          emailNotifications,
          pushNotifications,
          pregnancyReminders,
          weeklyUpdates,
          promotionalEmails,
          updatedAt: new Date(),
        })
        .where(eq(userNotificationSettings.userId, userId))
        .returning();
    } else {
      [updatedSettings] = await db.insert(userNotificationSettings)
        .values({
          userId,
          emailNotifications,
          pushNotifications,
          pregnancyReminders,
          weeklyUpdates,
          promotionalEmails,
        })
        .returning();
    }

    return res.json({ success: true, settings: updatedSettings });
  } catch (error) {
    console.error("알림 설정 업데이트 오류:", error);
    return res.status(500).json({
      success: false,
      message: "알림 설정을 저장하는 중 오류가 발생했습니다."
    });
  }
});

// 사용자 설정 조회 API
router.get("/user-settings", requireAuth, async (req, res) => {
  try {
    console.log("사용자 설정 조회 요청 - req.user:", req.user);
    const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
    const userId = Number(userIdRaw);
    console.log("추출된 userId:", userId, "타입:", typeof userId);

    let settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId)
    });

    // 설정이 없으면 기본 설정 생성
    if (!settings) {
      console.log("사용자 설정이 없어서 기본 설정 생성");
      const [newSettings] = await db.insert(userSettings).values({
        userId,
        theme: "light",
        language: "ko",
        timezone: "Asia/Seoul",
        dateFormat: "YYYY-MM-DD",
        autoSave: true,
        showTutorials: true,
      }).returning();
      settings = newSettings;
    }

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error("사용자 설정 조회 오류:", error);
    res.status(500).json({
      success: false,
      message: "사용자 설정을 불러오는 중 오류가 발생했습니다."
    });
  }
});

// 사용자 설정 업데이트 API
router.put("/user-settings", requireAuth, async (req, res) => {
  try {
    console.log("사용자 설정 업데이트 요청 - req.user:", req.user);
    const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
    const userId = Number(userIdRaw);
    console.log("추출된 userId:", userId, "타입:", typeof userId);

    const { theme, language, timezone, dateFormat, autoSave, showTutorials } = req.body;

    const existingSettings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId)
    });

    let updatedSettings;

    if (existingSettings) {
      [updatedSettings] = await db.update(userSettings)
        .set({
          theme,
          language,
          timezone,
          dateFormat,
          autoSave,
          showTutorials,
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, userId))
        .returning();
    } else {
      [updatedSettings] = await db.insert(userSettings).values({
        userId,
        theme,
        language,
        timezone,
        dateFormat,
        autoSave,
        showTutorials,
      }).returning();
    }

    res.json({
      success: true,
      settings: updatedSettings
    });
  } catch (error) {
    console.error("사용자 설정 업데이트 오류:", error);
    res.status(500).json({
      success: false,
      message: "설정을 저장하는 중 오류가 발생했습니다."
    });
  }
});

export default router;
