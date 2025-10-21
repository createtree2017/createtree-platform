import { Router } from "express";
import { exportChatHistoryAsHtml } from "../services/export-logs";
import { db } from "../../db/index";
import { banners } from "../../shared/schema";
import { eq, asc, desc } from "drizzle-orm";

const router = Router();

// 채팅 기록 내보내기 - HTML 형식
router.get("/api/export/chat/html", async (req, res) => {
  try {
    const htmlContent = await exportChatHistoryAsHtml();

    // Set headers for file download
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'attachment; filename="chat_history.html"');

    return res.send(htmlContent);
  } catch (error) {
    console.error("Error exporting chat history as HTML:", error);
    return res.status(500).json({ error: "Failed to export chat history" });
  }
});

// 채팅 기록 내보내기 - 텍스트 형식
router.get("/api/export/chat/text", async (req, res) => {
  try {
    const textContent = await exportChatHistoryAsHtml();

    // Set headers for file download
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="chat_history.txt"');

    return res.send(textContent);
  } catch (error) {
    console.error("Error exporting chat history as text:", error);
    return res.status(500).json({ error: "Failed to export chat history" });
  }
});

// 배너 관리 API
router.get("/api/banners", async (req, res) => {
  console.log("✅ [EXPORTS ROUTER] /api/banners 라우트 호출됨!");
  try {
    const allBanners = await db.query.banners.findMany({
      where: eq(banners.isActive, true),
      orderBy: [asc(banners.sortOrder), desc(banners.createdAt)]
    });
    res.json(allBanners);
  } catch (error) {
    console.error("Error getting banners:", error);
    res.status(500).json({ error: "Failed to get banners" });
  }
});

export default router;
