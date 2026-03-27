import "dotenv/config";
import { db } from "../db/index";
import { subMissionSubmissions, notifications } from "../shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { AdminMissionReviewService } from "../server/services/mission/admin.mission.review.service";

async function main() {
  const adminId = 16;
  
  try {
    console.log("🔍 검수 대기 중인 제출물 조회...");
    const pending = await db.query.subMissionSubmissions.findFirst({
      where: eq(subMissionSubmissions.status, "submitted"),
    });

    if (!pending) {
      console.log("❌ 검수 대기 중인 제출물이 없습니다.");
      return;
    }

    console.log(`✅ 제출물 발견: ID ${pending.id}, UserID ${pending.userId}`);
    
    const adminService = new AdminMissionReviewService();
    console.log(`🚀 ID ${pending.id} 승인 처리 시작...`);
    
    await adminService.approveSubmission(pending.id, adminId);
    
    console.log("⏳ 알림 처리 대기 중...");
    await new Promise(resolve => setTimeout(resolve, 2000));

    // notifications 테이블 확인 (userId는 text이므로 변환)
    const notif = await db.query.notifications.findFirst({
      where: and(
        eq(notifications.userId, String(pending.userId)),
        eq(notifications.type, "mission_approve")
      ),
      orderBy: [desc(notifications.createdAt)]
    });

    if (notif) {
      console.log("🎉 SUCCESS: DB에 알림 데이터가 생성되었습니다!");
      console.log("알림 정보:", {
        id: notif.id,
        userId: notif.userId,
        title: notif.title,
        message: notif.message,
        type: notif.type
      });
    } else {
      console.log("❌ FAILURE: 알림 데이터가 생성되지 않았습니다.");
    }

  } catch (err) {
    console.error("❌ Test Error:", (err as any).message);
    if ((err as any).stack) console.error((err as any).stack);
  } finally {
    process.exit(0);
  }
}

main();
