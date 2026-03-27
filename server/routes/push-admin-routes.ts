/**
 * 관리자 푸시 알림 관리 라우트
 * admin-routes.ts에서 분리 (2026-03-27)
 * 
 * 엔드포인트:
 * - GET  /api/admin/push-logs     발송 내역 조회
 * - POST /api/admin/push-send     수동 알림 발송
 */
import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAdminOrSuperAdmin } from '../middleware/auth';
import { db } from '@db';
import { pushDeliveryLogs } from '../../shared/schema';
import { desc, sql } from 'drizzle-orm';

const router = Router();

// ========================================
// 1. 발송 내역 모니터링
// ========================================
router.get("/push-logs", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const logsQuery = db
      .select()
      .from(pushDeliveryLogs)
      .orderBy(desc(pushDeliveryLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const countQuery = db.select({ count: sql<number>`count(*)` }).from(pushDeliveryLogs);
    
    const [logs, totalCountResult] = await Promise.all([
      logsQuery,
      countQuery
    ]);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total: totalCountResult[0]?.count || 0,
        totalPages: Math.ceil((totalCountResult[0]?.count || 0) / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching push logs:", error);
    res.status(500).json({ error: "푸시 발송 내역 조회 실패" });
  }
});

// ========================================
// 2. 수동 알림 발송 (전체/특정 대상/병원별)
// ========================================
const pushSendLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 5, // 분당 최대 5회
  message: { error: "푸시 발송 요청이 너무 많습니다. 1분 후 다시 시도해주세요." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/push-send", requireAdminOrSuperAdmin, pushSendLimiter, async (req: Request, res: Response) => {
  try {
    const { targetType, targetIds, hospitalId, title, body, actionUrl, imageUrl } = req.body;
    const adminId = (req.user as any)?.id;

    console.log(`[push-send] 요청 수신: targetType=${targetType}, adminId=${adminId}, targetIds=${JSON.stringify(targetIds)}, title="${title}"`);

    if (!title || !body) {
      return res.status(400).json({ error: "제목과 본문은 필수입니다." });
    }

    const { adminManualPayload } = await import("../services/push/push.template");
    const payload = adminManualPayload(title, body, actionUrl, imageUrl);
    
    let result;
    // 사용자 알림함에 저장할 대상 userId 목록
    let notificationTargetUserIds: string[] = [];

    if (targetType === "all") {
      const { sendToTopic } = await import("../services/push/push.service");
      const success = await sendToTopic("all_users", payload, {
        triggerType: "manual",
        targetType: "all",
        title,
        body,
        adminId
      });
      result = { successCount: success ? 1 : 0, failureCount: success ? 0 : 1 };

      // 전체 발송: 모든 활성 사용자 ID 조회
      try {
        const { users } = await import("../../shared/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        const allUsers = await db.select({ id: users.id }).from(users).where(eqOp(users.isDeleted, false));
        notificationTargetUserIds = allUsers.map(u => String(u.id));
      } catch (e) {
        console.error("[푸시→알림함] 전체 사용자 조회 실패:", e);
      }

    } else if (targetType === "hospital" && hospitalId) {
      const { sendToTopic } = await import("../services/push/push.service");
      const success = await sendToTopic(`hospital_${hospitalId}`, payload, {
        triggerType: "manual",
        targetType: "hospital",
        title,
        body,
        adminId,
        targetQuery: { hospital_id: hospitalId }
      });
      result = { successCount: success ? 1 : 0, failureCount: success ? 0 : 1 };

      // 병원별 발송: 해당 병원 소속 사용자 ID 조회
      try {
        const { users } = await import("../../shared/schema");
        const { eq: eqOp, and: andOp } = await import("drizzle-orm");
        const hospitalUsers = await db.select({ id: users.id }).from(users)
          .where(andOp(eqOp(users.hospitalId, hospitalId), eqOp(users.isDeleted, false)));
        notificationTargetUserIds = hospitalUsers.map(u => String(u.id));
      } catch (e) {
        console.error("[푸시→알림함] 병원 사용자 조회 실패:", e);
      }

    } else if (targetType === "specific_users" && Array.isArray(targetIds) && targetIds.length > 0) {
      const { sendToUsers } = await import("../services/push/push.service");
      result = await sendToUsers(targetIds, payload, {
        triggerType: "manual",
        targetType: "specific_users",
        title,
        body,
        adminId,
        targetQuery: { user_ids: targetIds }
      });
      // 개별 발송: targetIds 그대로 사용
      notificationTargetUserIds = targetIds.map((id: any) => String(id));

    } else {
      return res.status(400).json({ error: "유효하지 않은 발송 대상입니다." });
    }

    // === 사용자 알림함(notifications)에도 저장 (비동기, 실패해도 FCM 결과에 영향 없음) ===
    if (notificationTargetUserIds.length > 0) {
      const { createNotification } = await import("../services/notifications");
      // 비동기로 병렬 저장 (응답 속도에 영향 없음)
      Promise.allSettled(
        notificationTargetUserIds.map(userId =>
          createNotification({
            userId,
            type: "admin_push",
            title,
            message: body,
            actionUrl: actionUrl || undefined,
            imageUrl: imageUrl || undefined,
          })
        )
      ).then(results => {
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        console.log(`[푸시→알림함] ${succeeded}/${notificationTargetUserIds.length}명 알림함 저장 완료`);
      }).catch(err => {
        console.error("[푸시→알림함] 저장 중 오류:", err);
      });
    }

    res.json({ success: true, message: "푸시 알림 발송 요청이 처리되었습니다.", result });
  } catch (error) {
    console.error("Error sending manual push:", error);
    res.status(500).json({ error: "수동 푸시 발송 실패" });
  }
});

// ========================================
// 3. 회원 검색 API (푸시 발송 대상 선택용)
// ========================================
router.get("/push-users", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string) || "";
    const hospitalId = req.query.hospitalId ? parseInt(req.query.hospitalId as string) : undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const { users } = await import("../../shared/schema");
    const { like, or, eq, and, count } = await import("drizzle-orm");

    // 검색 조건 구성
    const conditions = [];
    if (search) {
      conditions.push(
        or(
          like(users.username, `%${search}%`),
          like(users.email, `%${search}%`),
          like(users.fullName, `%${search}%`),
          like(users.phoneNumber, `%${search}%`)
        )
      );
    }
    if (hospitalId) {
      conditions.push(eq(users.hospitalId, hospitalId));
    }
    // 삭제되지 않은 사용자만
    conditions.push(eq(users.isDeleted, false));

    const whereClause = conditions.length > 0 ? and(...conditions) : eq(users.isDeleted, false);

    const [userList, totalResult] = await Promise.all([
      db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        phoneNumber: users.phoneNumber,
        hospitalId: users.hospitalId,
        memberType: users.memberType,
      })
        .from(users)
        .where(whereClause)
        .orderBy(desc(users.id))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() })
        .from(users)
        .where(whereClause),
    ]);

    res.json({
      users: userList,
      pagination: {
        page,
        limit,
        total: totalResult[0]?.count || 0,
        totalPages: Math.ceil((totalResult[0]?.count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching push users:", error);
    res.status(500).json({ error: "회원 목록 조회 실패" });
  }
});

// ========================================
// 4. 병원 목록 조회 (푸시 발송 대상 병원 선택용)
// ========================================
router.get("/push-hospitals", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { hospitals } = await import("../../shared/schema");
    const hospitalList = await db
      .select({
        id: hospitals.id,
        name: hospitals.name,
        isActive: hospitals.isActive,
      })
      .from(hospitals)
      .orderBy(hospitals.name);

    res.json({ hospitals: hospitalList });
  } catch (error) {
    console.error("Error fetching hospitals for push:", error);
    res.status(500).json({ error: "병원 목록 조회 실패" });
  }
});

// ========================================
// 5. 알림 템플릿 CRUD
// ========================================

// 템플릿 목록 조회
router.get("/push-templates", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { pushTemplates } = await import("../../shared/schema");
    const templates = await db
      .select()
      .from(pushTemplates)
      .orderBy(desc(pushTemplates.updatedAt));
    res.json({ templates });
  } catch (error) {
    console.error("Error fetching push templates:", error);
    res.status(500).json({ error: "템플릿 목록 조회 실패" });
  }
});

// 템플릿 생성
router.post("/push-templates", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { pushTemplates } = await import("../../shared/schema");
    const { name, title, body, actionUrl, imageUrl, category } = req.body;

    if (!name || !title || !body) {
      return res.status(400).json({ error: "이름, 제목, 본문은 필수입니다." });
    }

    const [newTemplate] = await db.insert(pushTemplates).values({
      name,
      title,
      body,
      actionUrl: actionUrl || null,
      imageUrl: imageUrl || null,
      category: category || "general",
    }).returning();

    res.status(201).json({ success: true, template: newTemplate });
  } catch (error) {
    console.error("Error creating push template:", error);
    res.status(500).json({ error: "템플릿 생성 실패" });
  }
});

// 템플릿 수정
router.patch("/push-templates/:id", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { pushTemplates } = await import("../../shared/schema");
    const { eq } = await import("drizzle-orm");
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "유효한 템플릿 ID가 필요합니다." });
    }

    const { name, title, body, actionUrl, imageUrl, category, isActive } = req.body;
    const updateData: any = { updatedAt: new Date() };

    if (name !== undefined) updateData.name = name;
    if (title !== undefined) updateData.title = title;
    if (body !== undefined) updateData.body = body;
    if (actionUrl !== undefined) updateData.actionUrl = actionUrl;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (category !== undefined) updateData.category = category;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [updated] = await db
      .update(pushTemplates)
      .set(updateData)
      .where(eq(pushTemplates.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "템플릿을 찾을 수 없습니다." });
    }

    res.json({ success: true, template: updated });
  } catch (error) {
    console.error("Error updating push template:", error);
    res.status(500).json({ error: "템플릿 수정 실패" });
  }
});

// 템플릿 삭제
router.delete("/push-templates/:id", requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { pushTemplates } = await import("../../shared/schema");
    const { eq } = await import("drizzle-orm");
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "유효한 템플릿 ID가 필요합니다." });
    }

    await db.delete(pushTemplates).where(eq(pushTemplates.id, id));
    res.json({ success: true, message: "템플릿이 삭제되었습니다." });
  } catch (error) {
    console.error("Error deleting push template:", error);
    res.status(500).json({ error: "템플릿 삭제 실패" });
  }
});

export default router;
