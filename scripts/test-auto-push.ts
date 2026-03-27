import { db } from "@db";
import { users, subMissionSubmissions, MISSION_STATUS } from "@shared/schema";
import { AdminMissionReviewService } from "../server/services/mission/admin.mission.review.service";
import { eq } from "drizzle-orm";

async function main() {
  try {
    console.log("=== 테스트 시작 ===");
    // 1. 관리자 1명 찾기
    const admin = await db.query.users.findFirst();
    if (!admin) {
      console.log("관리자가 없습니다.");
      return;
    }

    // 2. 대기중(submitted)인 미션 1개 찾기
    let submission = await db.query.subMissionSubmissions.findFirst({
      where: eq(subMissionSubmissions.status, MISSION_STATUS.SUBMITTED),
    });

    // 3. 만약 대기중인 미션이 없으면 하나 강제로 상태를 변경해서라도 만듦.
    if (!submission) {
      console.log("제출 대기중인 미션이 없어서 최근 미션을 강제 대기 상태로 변경합니다.");
      const anySubmission = await db.query.subMissionSubmissions.findFirst();
      if (!anySubmission) {
        console.log("테스트용 미션 제출 내역이 아예 없습니다.");
        return;
      }
      const [updated] = await db.update(subMissionSubmissions)
        .set({ status: MISSION_STATUS.SUBMITTED, isLocked: false })
        .where(eq(subMissionSubmissions.id, anySubmission.id))
        .returning();
      submission = updated;
    }

    console.log(`테스트 미션 ID: ${submission.id}, 유저 ID: ${submission.userId}`);

    const reviewService = new AdminMissionReviewService();

    // 4. 단건 승인 트리거 평가 (evaluateAndSend 가 호출되는지)
    console.log("단건 승인 호출 트리거 중...");
    await reviewService.approveSubmission(submission.id, admin.id);
    
    // (비동기로 알림 전송이 이뤄지므로 1초 대기)
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log("=== 단건 승인 트리거 완료 ===");

    // 5. 방금 승인된 걸 다시 대기상태로 만들고 반려 테스트
    await db.update(subMissionSubmissions)
      .set({ status: MISSION_STATUS.SUBMITTED, isLocked: false })
      .where(eq(subMissionSubmissions.id, submission.id));

    console.log("단건 반려 호출 트리거 중...");
    await reviewService.rejectSubmission(submission.id, admin.id, "안내원 테스트 반려 사유입니다.");
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log("=== 단건 반려 트리거 완료 ===");
    
    // 마무리 복구
    await db.update(subMissionSubmissions)
      .set({ status: MISSION_STATUS.APPROVED, isLocked: true })
      .where(eq(subMissionSubmissions.id, submission.id));

    console.log("✅ 모든 자동 푸시 트리거 테스트 스크립트 실행 완료.");
    process.exit(0);

  } catch (err) {
    console.error("테스트 실패:", err);
    process.exit(1);
  }
}

main();
