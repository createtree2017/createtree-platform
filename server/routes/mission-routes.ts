import { Router } from "express";
import { db } from "@db";
import { 
  missionCategories, 
  themeMissions, 
  subMissions,
  userMissionProgress,
  subMissionSubmissions,
  missionCategoriesInsertSchema,
  themeMissionsInsertSchema,
  subMissionsInsertSchema,
  VISIBILITY_TYPE,
  MISSION_STATUS
} from "@shared/schema";
import { eq, and, or, desc, asc, sql, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireAdminOrSuperAdmin } from "../middleware/admin-auth";

const router = Router();

// ============================================
// 관리자 - 미션 카테고리 관리 API
// ============================================

// 카테고리 목록 조회
router.get("/admin/mission-categories", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const categories = await db.query.missionCategories.findMany({
      orderBy: [asc(missionCategories.order), asc(missionCategories.id)]
    });

    res.json(categories);
  } catch (error) {
    console.error("Error fetching mission categories:", error);
    res.status(500).json({ error: "미션 카테고리 조회 실패" });
  }
});

// 카테고리 생성
router.post("/admin/mission-categories", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const categoryData = missionCategoriesInsertSchema.parse(req.body);

    const [newCategory] = await db
      .insert(missionCategories)
      .values(categoryData)
      .returning();

    res.status(201).json(newCategory);
  } catch (error: any) {
    console.error("Error creating mission category:", error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "유효하지 않은 데이터", details: error.errors });
    }
    res.status(500).json({ error: "미션 카테고리 생성 실패" });
  }
});

// 카테고리 수정
router.put("/admin/mission-categories/:id", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const categoryData = missionCategoriesInsertSchema.partial().parse(req.body);

    const [updatedCategory] = await db
      .update(missionCategories)
      .set({ ...categoryData, updatedAt: new Date() })
      .where(eq(missionCategories.id, id))
      .returning();

    if (!updatedCategory) {
      return res.status(404).json({ error: "카테고리를 찾을 수 없습니다" });
    }

    res.json(updatedCategory);
  } catch (error: any) {
    console.error("Error updating mission category:", error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "유효하지 않은 데이터", details: error.errors });
    }
    res.status(500).json({ error: "미션 카테고리 수정 실패" });
  }
});

// 카테고리 삭제
router.delete("/admin/mission-categories/:id", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // 카테고리를 사용하는 미션이 있는지 확인
    const missionsUsingCategory = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.categoryId, (
        await db.query.missionCategories.findFirst({
          where: eq(missionCategories.id, id)
        })
      )?.categoryId || '')
    });

    if (missionsUsingCategory) {
      return res.status(400).json({ 
        error: "이 카테고리를 사용하는 미션이 있어 삭제할 수 없습니다" 
      });
    }

    const [deletedCategory] = await db
      .delete(missionCategories)
      .where(eq(missionCategories.id, id))
      .returning();

    if (!deletedCategory) {
      return res.status(404).json({ error: "카테고리를 찾을 수 없습니다" });
    }

    res.json({ message: "카테고리가 삭제되었습니다", category: deletedCategory });
  } catch (error) {
    console.error("Error deleting mission category:", error);
    res.status(500).json({ error: "미션 카테고리 삭제 실패" });
  }
});

// 카테고리 순서 변경
router.patch("/admin/mission-categories/reorder", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const { categoryIds } = req.body as { categoryIds: number[] };

    if (!Array.isArray(categoryIds)) {
      return res.status(400).json({ error: "categoryIds는 배열이어야 합니다" });
    }

    // 각 카테고리의 order 업데이트
    const updates = categoryIds.map((id, index) =>
      db.update(missionCategories)
        .set({ order: index, updatedAt: new Date() })
        .where(eq(missionCategories.id, id))
    );

    await Promise.all(updates);

    res.json({ message: "카테고리 순서가 변경되었습니다" });
  } catch (error) {
    console.error("Error reordering categories:", error);
    res.status(500).json({ error: "카테고리 순서 변경 실패" });
  }
});

// ============================================
// 관리자 - 주제 미션 CRUD API
// ============================================

// 주제 미션 목록 조회 (필터링 지원)
router.get("/admin/missions", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const { visibilityType, hospitalId, isActive, categoryId } = req.query;

    // 필터 조건 동적 생성
    const conditions = [];
    
    if (visibilityType) {
      conditions.push(eq(themeMissions.visibilityType, visibilityType as string));
    }
    
    if (hospitalId) {
      conditions.push(eq(themeMissions.hospitalId, parseInt(hospitalId as string)));
    }
    
    if (isActive !== undefined) {
      conditions.push(eq(themeMissions.isActive, isActive === 'true'));
    }
    
    if (categoryId) {
      conditions.push(eq(themeMissions.categoryId, categoryId as string));
    }

    const missions = await db.query.themeMissions.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        category: true,
        hospital: true,
        subMissions: {
          orderBy: [asc(subMissions.order)]
        }
      },
      orderBy: [asc(themeMissions.order), desc(themeMissions.id)]
    });

    // 세부미션 개수 추가
    const missionsWithCount = missions.map(mission => ({
      ...mission,
      subMissionCount: mission.subMissions.length
    }));

    res.json(missionsWithCount);
  } catch (error) {
    console.error("Error fetching theme missions:", error);
    res.status(500).json({ error: "주제 미션 조회 실패" });
  }
});

// 주제 미션 상세 조회
router.get("/admin/missions/:missionId", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const { missionId } = req.params;

    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.missionId, missionId),
      with: {
        category: true,
        hospital: true,
        subMissions: {
          orderBy: [asc(subMissions.order)]
        }
      }
    });

    if (!mission) {
      return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
    }

    res.json(mission);
  } catch (error) {
    console.error("Error fetching theme mission:", error);
    res.status(500).json({ error: "주제 미션 조회 실패" });
  }
});

// 주제 미션 생성
router.post("/admin/missions", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const missionData = themeMissionsInsertSchema.parse(req.body);

    // visibilityType이 hospital인데 hospitalId가 없으면 에러
    if (missionData.visibilityType === VISIBILITY_TYPE.HOSPITAL && !missionData.hospitalId) {
      return res.status(400).json({ 
        error: "병원 전용 미션은 병원을 선택해야 합니다" 
      });
    }

    const [newMission] = await db
      .insert(themeMissions)
      .values(missionData)
      .returning();

    res.status(201).json(newMission);
  } catch (error: any) {
    console.error("Error creating theme mission:", error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "유효하지 않은 데이터", details: error.errors });
    }
    res.status(500).json({ error: "주제 미션 생성 실패" });
  }
});

// 주제 미션 수정
router.put("/admin/missions/:id", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // partial update를 위해 직접 파싱 (refine이 있는 스키마는 partial 사용 불가)
    const missionData = req.body;

    // visibilityType이 hospital인데 hospitalId가 없으면 에러
    if (missionData.visibilityType === VISIBILITY_TYPE.HOSPITAL && !missionData.hospitalId) {
      return res.status(400).json({ 
        error: "병원 전용 미션은 병원을 선택해야 합니다" 
      });
    }

    // visibilityType을 public으로 변경하면 hospitalId 제거
    if (missionData.visibilityType === VISIBILITY_TYPE.PUBLIC) {
      missionData.hospitalId = null;
    }

    // 날짜 필드들을 Date 객체로 변환
    const dateFields = ['startDate', 'endDate'];
    dateFields.forEach(field => {
      if (missionData[field]) {
        missionData[field] = new Date(missionData[field]);
      }
    });

    const [updatedMission] = await db
      .update(themeMissions)
      .set({ ...missionData, updatedAt: new Date() })
      .where(eq(themeMissions.id, id))
      .returning();

    if (!updatedMission) {
      return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
    }

    res.json(updatedMission);
  } catch (error: any) {
    console.error("Error updating theme mission:", error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "유효하지 않은 데이터", details: error.errors });
    }
    res.status(500).json({ error: "주제 미션 수정 실패" });
  }
});

// 주제 미션 삭제
router.delete("/admin/missions/:id", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // cascade delete로 세부 미션, 진행 상황, 제출 기록도 함께 삭제됨
    const [deletedMission] = await db
      .delete(themeMissions)
      .where(eq(themeMissions.id, id))
      .returning();

    if (!deletedMission) {
      return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
    }

    res.json({ message: "미션이 삭제되었습니다", mission: deletedMission });
  } catch (error) {
    console.error("Error deleting theme mission:", error);
    res.status(500).json({ error: "주제 미션 삭제 실패" });
  }
});

// 주제 미션 활성화/비활성화 토글
router.patch("/admin/missions/:id/toggle-active", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // 현재 상태 조회
    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.id, id)
    });

    if (!mission) {
      return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
    }

    // 토글
    const [updatedMission] = await db
      .update(themeMissions)
      .set({ 
        isActive: !mission.isActive,
        updatedAt: new Date()
      })
      .where(eq(themeMissions.id, id))
      .returning();

    res.json(updatedMission);
  } catch (error) {
    console.error("Error toggling mission active status:", error);
    res.status(500).json({ error: "미션 활성화 상태 변경 실패" });
  }
});

// 미션 통계 조회
router.get("/admin/missions/stats", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    // 전체 통계
    const totalMissions = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(themeMissions);

    const activeMissions = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(themeMissions)
      .where(eq(themeMissions.isActive, true));

    const publicMissions = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(themeMissions)
      .where(eq(themeMissions.visibilityType, VISIBILITY_TYPE.PUBLIC));

    const hospitalMissions = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(themeMissions)
      .where(eq(themeMissions.visibilityType, VISIBILITY_TYPE.HOSPITAL));

    res.json({
      total: totalMissions[0]?.count || 0,
      active: activeMissions[0]?.count || 0,
      public: publicMissions[0]?.count || 0,
      hospital: hospitalMissions[0]?.count || 0
    });
  } catch (error) {
    console.error("Error fetching mission stats:", error);
    res.status(500).json({ error: "미션 통계 조회 실패" });
  }
});

// ============================================
// 관리자 - 세부 미션 빌더 API
// ============================================

// 세부 미션 목록 조회
router.get("/admin/missions/:missionId/sub-missions", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const { missionId } = req.params;

    // missionId로 themeMissionId 찾기
    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.missionId, missionId)
    });

    if (!mission) {
      return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
    }

    const subMissionsList = await db.query.subMissions.findMany({
      where: eq(subMissions.themeMissionId, mission.id),
      orderBy: [asc(subMissions.order)]
    });

    res.json(subMissionsList);
  } catch (error) {
    console.error("Error fetching sub missions:", error);
    res.status(500).json({ error: "세부 미션 조회 실패" });
  }
});

// 세부 미션 추가 (+ 버튼)
router.post("/admin/missions/:missionId/sub-missions", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const { missionId } = req.params;
    
    // missionId로 themeMissionId 찾기
    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.missionId, missionId)
    });

    if (!mission) {
      return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
    }

    // 현재 최대 order 값 찾기
    const maxOrderResult = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX("order"), -1)::int` })
      .from(subMissions)
      .where(eq(subMissions.themeMissionId, mission.id));

    const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

    const subMissionData = subMissionsInsertSchema.parse({
      ...req.body,
      themeMissionId: mission.id,
      order: nextOrder
    });

    const [newSubMission] = await db
      .insert(subMissions)
      .values(subMissionData)
      .returning();

    res.status(201).json(newSubMission);
  } catch (error: any) {
    console.error("Error creating sub mission:", error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "유효하지 않은 데이터", details: error.errors });
    }
    res.status(500).json({ error: "세부 미션 생성 실패" });
  }
});

// 세부 미션 수정
router.put("/admin/missions/:missionId/sub-missions/:subId", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const subId = parseInt(req.params.subId);
    const subMissionData = subMissionsInsertSchema.partial().parse(req.body);

    const [updatedSubMission] = await db
      .update(subMissions)
      .set({ ...subMissionData, updatedAt: new Date() })
      .where(eq(subMissions.id, subId))
      .returning();

    if (!updatedSubMission) {
      return res.status(404).json({ error: "세부 미션을 찾을 수 없습니다" });
    }

    res.json(updatedSubMission);
  } catch (error: any) {
    console.error("Error updating sub mission:", error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "유효하지 않은 데이터", details: error.errors });
    }
    res.status(500).json({ error: "세부 미션 수정 실패" });
  }
});

// 세부 미션 삭제
router.delete("/admin/missions/:missionId/sub-missions/:subId", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const subId = parseInt(req.params.subId);

    const [deletedSubMission] = await db
      .delete(subMissions)
      .where(eq(subMissions.id, subId))
      .returning();

    if (!deletedSubMission) {
      return res.status(404).json({ error: "세부 미션을 찾을 수 없습니다" });
    }

    res.json({ message: "세부 미션이 삭제되었습니다", subMission: deletedSubMission });
  } catch (error) {
    console.error("Error deleting sub mission:", error);
    res.status(500).json({ error: "세부 미션 삭제 실패" });
  }
});

// 세부 미션 순서 변경 (drag & drop)
router.patch("/admin/missions/:missionId/sub-missions/reorder", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const { subMissionIds } = req.body as { subMissionIds: number[] };

    if (!Array.isArray(subMissionIds)) {
      return res.status(400).json({ error: "subMissionIds는 배열이어야 합니다" });
    }

    // 각 세부 미션의 order 업데이트
    const updates = subMissionIds.map((id, index) =>
      db.update(subMissions)
        .set({ order: index, updatedAt: new Date() })
        .where(eq(subMissions.id, id))
    );

    await Promise.all(updates);

    res.json({ message: "세부 미션 순서가 변경되었습니다" });
  } catch (error) {
    console.error("Error reordering sub missions:", error);
    res.status(500).json({ error: "세부 미션 순서 변경 실패" });
  }
});

// 세부 미션 활성화/비활성화 토글
router.patch("/admin/missions/:missionId/sub-missions/:subId/toggle-active", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const subId = parseInt(req.params.subId);

    // 현재 상태 조회
    const subMission = await db.query.subMissions.findFirst({
      where: eq(subMissions.id, subId)
    });

    if (!subMission) {
      return res.status(404).json({ error: "세부 미션을 찾을 수 없습니다" });
    }

    // 토글
    const [updatedSubMission] = await db
      .update(subMissions)
      .set({ 
        isActive: !subMission.isActive,
        updatedAt: new Date()
      })
      .where(eq(subMissions.id, subId))
      .returning();

    res.json(updatedSubMission);
  } catch (error) {
    console.error("Error toggling sub mission active status:", error);
    res.status(500).json({ error: "세부 미션 활성화 상태 변경 실패" });
  }
});

// ============================================
// 사용자 - 미션 목록 및 상세 API
// ============================================

// 사용자용 미션 목록 조회 (공개 범위 필터링, 진행률 계산)
router.get("/missions", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const userHospitalId = req.user?.hospitalId;

    if (!userId) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    // 공개 미션 + 내 병원 전용 미션만 조회
    const conditions = [
      eq(themeMissions.isActive, true),
      or(
        eq(themeMissions.visibilityType, VISIBILITY_TYPE.PUBLIC),
        and(
          eq(themeMissions.visibilityType, VISIBILITY_TYPE.HOSPITAL),
          userHospitalId ? eq(themeMissions.hospitalId, userHospitalId) : sql`false`
        )
      )
    ];

    const missions = await db.query.themeMissions.findMany({
      where: and(...conditions),
      with: {
        category: true,
        subMissions: {
          where: eq(subMissions.isActive, true),
          orderBy: [asc(subMissions.order)]
        }
      },
      orderBy: [asc(themeMissions.order), desc(themeMissions.id)]
    });

    // 각 미션의 진행률 계산
    const missionsWithProgress = await Promise.all(
      missions.map(async (mission) => {
        // 사용자의 미션 진행 상황 조회
        const progress = await db.query.userMissionProgress.findFirst({
          where: and(
            eq(userMissionProgress.userId, userId),
            eq(userMissionProgress.themeMissionId, mission.id)
          )
        });

        // 제출된 세부 미션 개수 조회
        const submittedCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(subMissionSubmissions)
          .where(
            and(
              eq(subMissionSubmissions.userId, userId),
              sql`${subMissionSubmissions.subMissionId} IN (SELECT id FROM ${subMissions} WHERE ${subMissions.themeMissionId} = ${mission.id})`
            )
          );

        const totalSubMissions = mission.subMissions.length;
        const completedSubMissions = submittedCount[0]?.count || 0;
        const progressPercentage = totalSubMissions > 0 
          ? Math.round((completedSubMissions / totalSubMissions) * 100) 
          : 0;

        // 날짜 기준 상태 계산
        let status = progress?.status || MISSION_STATUS.NOT_STARTED;
        if (!progress) {
          const now = new Date();
          const startDate = mission.startDate ? new Date(mission.startDate) : null;
          const endDate = mission.endDate ? new Date(mission.endDate) : null;

          if (startDate && endDate) {
            if (now < startDate) {
              status = MISSION_STATUS.NOT_STARTED;
            } else if (now >= startDate && now <= endDate) {
              status = MISSION_STATUS.IN_PROGRESS;
            } else {
              status = MISSION_STATUS.NOT_STARTED; // 기간 종료
            }
          } else if (startDate && now >= startDate) {
            status = MISSION_STATUS.IN_PROGRESS;
          }
        }

        return {
          ...mission,
          userProgress: progress ? {
            ...progress,
            status: progress.status,
            progressPercent: progressPercentage,
            completedSubMissions,
            totalSubMissions
          } : {
            status,
            progressPercent: progressPercentage,
            completedSubMissions,
            totalSubMissions
          },
          progressPercentage,
          completedSubMissions,
          totalSubMissions
        };
      })
    );

    res.json(missionsWithProgress);
  } catch (error) {
    console.error("Error fetching user missions:", error);
    res.status(500).json({ error: "미션 목록 조회 실패" });
  }
});

// 사용자용 미션 상세 조회
router.get("/missions/:missionId", requireAuth, async (req, res) => {
  try {
    const { missionId } = req.params;
    const userId = req.user?.userId;
    const userHospitalId = req.user?.hospitalId;

    if (!userId) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    // 미션 조회
    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.missionId, missionId),
      with: {
        category: true,
        subMissions: {
          where: eq(subMissions.isActive, true),
          orderBy: [asc(subMissions.order)]
        }
      }
    });

    if (!mission) {
      return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
    }

    // 활성화 여부 확인
    if (!mission.isActive) {
      return res.status(403).json({ error: "비활성화된 미션입니다" });
    }

    // 공개 범위 확인
    if (mission.visibilityType === VISIBILITY_TYPE.HOSPITAL) {
      if (!userHospitalId || mission.hospitalId !== userHospitalId) {
        return res.status(403).json({ error: "접근 권한이 없습니다" });
      }
    }

    // 사용자 진행 상황 조회
    const progress = await db.query.userMissionProgress.findFirst({
      where: and(
        eq(userMissionProgress.userId, userId),
        eq(userMissionProgress.themeMissionId, mission.id)
      )
    });

    // 각 세부 미션의 제출 정보 조회
    const subMissionsWithSubmissions = await Promise.all(
      mission.subMissions.map(async (subMission) => {
        const submission = await db.query.subMissionSubmissions.findFirst({
          where: and(
            eq(subMissionSubmissions.userId, userId),
            eq(subMissionSubmissions.subMissionId, subMission.id)
          ),
          orderBy: [desc(subMissionSubmissions.submittedAt)]
        });

        return {
          ...subMission,
          submission: submission || null
        };
      })
    );

    const totalSubMissions = mission.subMissions.length;
    const completedSubMissions = subMissionsWithSubmissions.filter(
      sm => sm.submission?.status === MISSION_STATUS.APPROVED
    ).length;
    const progressPercentage = totalSubMissions > 0 
      ? Math.round((completedSubMissions / totalSubMissions) * 100) 
      : 0;

    res.json({
      ...mission,
      subMissions: subMissionsWithSubmissions,
      progress: progress || null,
      progressPercentage,
      completedSubMissions,
      totalSubMissions
    });
  } catch (error) {
    console.error("Error fetching mission detail:", error);
    res.status(500).json({ error: "미션 상세 조회 실패" });
  }
});

// 내 미션 진행 상황 조회
router.get("/my-missions", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    // 내가 시작한 모든 미션 조회
    const myProgress = await db.query.userMissionProgress.findMany({
      where: eq(userMissionProgress.userId, userId),
      with: {
        themeMission: {
          with: {
            category: true,
            subMissions: {
              where: eq(subMissions.isActive, true)
            }
          }
        }
      },
      orderBy: [desc(userMissionProgress.createdAt)]
    });

    // 각 미션의 상세 진행 정보 추가
    const detailedProgress = await Promise.all(
      myProgress.map(async (progress) => {
        const mission = progress.themeMission;
        
        // 제출된 세부 미션 개수 조회
        const submittedCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(subMissionSubmissions)
          .where(
            and(
              eq(subMissionSubmissions.userId, userId),
              sql`${subMissionSubmissions.subMissionId} IN (SELECT id FROM ${subMissions} WHERE ${subMissions.themeMissionId} = ${mission.id})`
            )
          );

        const totalSubMissions = mission.subMissions.length;
        const completedSubMissions = submittedCount[0]?.count || 0;
        const progressPercentage = totalSubMissions > 0 
          ? Math.round((completedSubMissions / totalSubMissions) * 100) 
          : 0;

        return {
          ...progress,
          progressPercentage,
          completedSubMissions,
          totalSubMissions
        };
      })
    );

    res.json(detailedProgress);
  } catch (error) {
    console.error("Error fetching my missions:", error);
    res.status(500).json({ error: "내 미션 조회 실패" });
  }
});

// ============================================
// 사용자 - 세부 미션 제출 API
// ============================================

// 미션 시작 (진행 상황 생성)
router.post("/missions/:missionId/start", requireAuth, async (req, res) => {
  try {
    const { missionId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    // 미션 조회
    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.missionId, missionId)
    });

    if (!mission) {
      return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
    }

    // 이미 시작한 미션인지 확인
    const existingProgress = await db.query.userMissionProgress.findFirst({
      where: and(
        eq(userMissionProgress.userId, userId),
        eq(userMissionProgress.themeMissionId, mission.id)
      )
    });

    if (existingProgress) {
      return res.status(400).json({ error: "이미 시작한 미션입니다", progress: existingProgress });
    }

    // 진행 상황 생성
    const [newProgress] = await db
      .insert(userMissionProgress)
      .values({
        userId,
        themeMissionId: mission.id,
        status: MISSION_STATUS.IN_PROGRESS
      })
      .returning();

    res.status(201).json(newProgress);
  } catch (error) {
    console.error("Error starting mission:", error);
    res.status(500).json({ error: "미션 시작 실패" });
  }
});

// 세부 미션 제출
router.post("/missions/:missionId/sub-missions/:subMissionId/submit", requireAuth, async (req, res) => {
  try {
    const { missionId, subMissionId } = req.params;
    const submissionData = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    // 미션 조회
    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.missionId, missionId)
    });

    if (!mission) {
      return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
    }

    // 세부 미션 조회
    const subMission = await db.query.subMissions.findFirst({
      where: and(
        eq(subMissions.id, parseInt(subMissionId)),
        eq(subMissions.themeMissionId, mission.id)
      )
    });

    if (!subMission) {
      return res.status(404).json({ error: "세부 미션을 찾을 수 없습니다" });
    }

    // 미션 진행 상황 확인 (없으면 자동 생성)
    let progress = await db.query.userMissionProgress.findFirst({
      where: and(
        eq(userMissionProgress.userId, userId),
        eq(userMissionProgress.themeMissionId, mission.id)
      )
    });

    if (!progress) {
      [progress] = await db
        .insert(userMissionProgress)
        .values({
          userId,
          themeMissionId: mission.id,
          status: MISSION_STATUS.IN_PROGRESS
        })
        .returning();
    }

    // 기존 제출 확인 (중복 제출 방지)
    const existingSubmission = await db.query.subMissionSubmissions.findFirst({
      where: and(
        eq(subMissionSubmissions.userId, userId),
        eq(subMissionSubmissions.subMissionId, subMission.id)
      )
    });

    // 승인된 제출은 수정 불가 (영구 잠금)
    if (existingSubmission?.isLocked) {
      return res.status(403).json({ 
        error: "승인된 세부 미션은 수정할 수 없습니다",
        submission: existingSubmission
      });
    }

    // 새로운 제출 또는 업데이트
    if (existingSubmission) {
      // 기존 제출 업데이트
      const [updatedSubmission] = await db
        .update(subMissionSubmissions)
        .set({
          submissionData,
          status: MISSION_STATUS.SUBMITTED,
          submittedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(subMissionSubmissions.id, existingSubmission.id))
        .returning();

      res.json(updatedSubmission);
    } else {
      // 새로운 제출
      const [newSubmission] = await db
        .insert(subMissionSubmissions)
        .values({
          userId,
          subMissionId: subMission.id,
          submissionData,
          status: MISSION_STATUS.SUBMITTED,
          submittedAt: new Date()
        })
        .returning();

      res.status(201).json(newSubmission);
    }
  } catch (error) {
    console.error("Error submitting sub mission:", error);
    res.status(500).json({ error: "세부 미션 제출 실패" });
  }
});

// 세부 미션 제출 취소
router.delete("/missions/:missionId/sub-missions/:subMissionId/submission", requireAuth, async (req, res) => {
  try {
    const { missionId, subMissionId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    // 제출 조회
    const submission = await db.query.subMissionSubmissions.findFirst({
      where: and(
        eq(subMissionSubmissions.userId, userId),
        eq(subMissionSubmissions.subMissionId, parseInt(subMissionId))
      )
    });

    if (!submission) {
      return res.status(404).json({ error: "제출 내역을 찾을 수 없습니다" });
    }

    // 승인된 제출은 취소 불가
    if (submission.isLocked) {
      return res.status(403).json({ error: "승인된 세부 미션은 취소할 수 없습니다" });
    }

    // 제출 삭제
    const [deletedSubmission] = await db
      .delete(subMissionSubmissions)
      .where(eq(subMissionSubmissions.id, submission.id))
      .returning();

    res.json({ message: "제출이 취소되었습니다", submission: deletedSubmission });
  } catch (error) {
    console.error("Error canceling submission:", error);
    res.status(500).json({ error: "제출 취소 실패" });
  }
});

// 미션 완료 (모든 세부 미션 승인 확인)
router.post("/missions/:missionId/complete", requireAuth, async (req, res) => {
  try {
    const { missionId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    // 미션 조회
    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.missionId, missionId),
      with: {
        subMissions: {
          where: eq(subMissions.isActive, true)
        }
      }
    });

    if (!mission) {
      return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
    }

    // 진행 상황 조회
    const progress = await db.query.userMissionProgress.findFirst({
      where: and(
        eq(userMissionProgress.userId, userId),
        eq(userMissionProgress.themeMissionId, mission.id)
      )
    });

    if (!progress) {
      return res.status(404).json({ error: "미션 진행 내역을 찾을 수 없습니다" });
    }

    // 모든 세부 미션이 승인되었는지 확인
    const totalSubMissions = mission.subMissions.length;
    const approvedSubmissions = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(subMissionSubmissions)
      .where(
        and(
          eq(subMissionSubmissions.userId, userId),
          eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED),
          sql`${subMissionSubmissions.subMissionId} IN (SELECT id FROM ${subMissions} WHERE ${subMissions.themeMissionId} = ${mission.id})`
        )
      );

    const approvedCount = approvedSubmissions[0]?.count || 0;

    if (approvedCount < totalSubMissions) {
      return res.status(400).json({ 
        error: "모든 세부 미션이 승인되어야 완료할 수 있습니다",
        approved: approvedCount,
        total: totalSubMissions
      });
    }

    // 미션 완료 처리
    const [completedProgress] = await db
      .update(userMissionProgress)
      .set({
        status: MISSION_STATUS.APPROVED,
        updatedAt: new Date()
      })
      .where(eq(userMissionProgress.id, progress.id))
      .returning();

    res.json(completedProgress);
  } catch (error) {
    console.error("Error completing mission:", error);
    res.status(500).json({ error: "미션 완료 실패" });
  }
});

// ============================================
// 관리자 - 검수 API
// ============================================

// 주제미션 리스트 + 제출 통계 (계층 구조 1단계)
router.get("/admin/review/theme-missions", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const userRole = req.user?.memberType;
    const userHospitalId = req.user?.hospitalId;
    const { hospitalId } = req.query;

    // hospital_admin은 hospitalId 쿼리 파라미터 사용 불가
    if (userRole === 'hospital_admin' && hospitalId) {
      return res.status(403).json({ error: "병원 관리자는 다른 병원의 데이터를 조회할 수 없습니다" });
    }

    // 병원 관리자는 자기 병원 미션만 조회 (강제)
    const conditions = [];
    if (userRole === 'hospital_admin') {
      if (!userHospitalId) {
        return res.status(403).json({ error: "병원 정보가 없습니다" });
      }
      conditions.push(
        or(
          eq(themeMissions.visibilityType, VISIBILITY_TYPE.PUBLIC),
          and(
            eq(themeMissions.visibilityType, VISIBILITY_TYPE.HOSPITAL),
            eq(themeMissions.hospitalId, userHospitalId)
          )
        )
      );
    }

    // 주제미션 조회
    const missions = await db.query.themeMissions.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        category: true,
        hospital: true,
        subMissions: {
          orderBy: [asc(subMissions.order)]
        }
      },
      orderBy: [asc(themeMissions.order), desc(themeMissions.id)]
    });

    // 각 주제미션별 제출 통계 계산
    const missionsWithStats = await Promise.all(
      missions.map(async (mission) => {
        // 해당 주제미션의 모든 세부미션 ID 가져오기
        const subMissionIds = mission.subMissions.map(sm => sm.id);

        if (subMissionIds.length === 0) {
          return {
            ...mission,
            stats: {
              pending: 0,
              approved: 0,
              rejected: 0,
              total: 0
            }
          };
        }

        // 제출 통계 계산 - SQL 인젝션 방지를 위해 inArray 사용
        const statsResult = await db
          .select({
            pending: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.SUBMITTED} THEN 1 END)::int`,
            approved: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.APPROVED} THEN 1 END)::int`,
            rejected: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.REJECTED} THEN 1 END)::int`,
            total: sql<number>`COUNT(*)::int`
          })
          .from(subMissionSubmissions)
          .where(inArray(subMissionSubmissions.subMissionId, subMissionIds));

        return {
          ...mission,
          stats: statsResult[0] || { pending: 0, approved: 0, rejected: 0, total: 0 }
        };
      })
    );

    res.json(missionsWithStats);
  } catch (error) {
    console.error("Error fetching theme missions with stats:", error);
    res.status(500).json({ error: "주제미션 통계 조회 실패" });
  }
});

// 세부미션 리스트 + 제출 통계 (계층 구조 2단계)
router.get("/admin/review/theme-missions/:missionId/sub-missions", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const { missionId } = req.params;
    const userRole = req.user?.memberType;
    const userHospitalId = req.user?.hospitalId;

    // missionId로 themeMission 찾기
    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.missionId, missionId)
    });

    if (!mission) {
      return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
    }

    // hospital_admin은 자기 병원 미션만 접근 가능
    if (userRole === 'hospital_admin') {
      if (!userHospitalId) {
        return res.status(403).json({ error: "병원 정보가 없습니다" });
      }
      // PUBLIC 미션이거나 자기 병원 미션인지 확인
      if (mission.visibilityType === VISIBILITY_TYPE.HOSPITAL && mission.hospitalId !== userHospitalId) {
        return res.status(403).json({ error: "접근 권한이 없습니다" });
      }
    }

    // 세부미션 조회
    const subMissionsList = await db.query.subMissions.findMany({
      where: eq(subMissions.themeMissionId, mission.id),
      orderBy: [asc(subMissions.order)]
    });

    // 각 세부미션별 제출 통계 계산
    const subMissionsWithStats = await Promise.all(
      subMissionsList.map(async (subMission) => {
        const statsResult = await db
          .select({
            pending: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.SUBMITTED} THEN 1 END)::int`,
            approved: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.APPROVED} THEN 1 END)::int`,
            rejected: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.REJECTED} THEN 1 END)::int`,
            total: sql<number>`COUNT(*)::int`
          })
          .from(subMissionSubmissions)
          .where(eq(subMissionSubmissions.subMissionId, subMission.id));

        return {
          ...subMission,
          stats: statsResult[0] || { pending: 0, approved: 0, rejected: 0, total: 0 }
        };
      })
    );

    res.json(subMissionsWithStats);
  } catch (error) {
    console.error("Error fetching sub missions with stats:", error);
    res.status(500).json({ error: "세부미션 통계 조회 실패" });
  }
});

// 제출 내역 조회 (계층 구조 3단계 + 필터 지원)
router.get("/admin/review/submissions", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const { subMissionId, status, hospitalId } = req.query;
    const userRole = req.user?.memberType;
    const userHospitalId = req.user?.hospitalId;

    // hospital_admin은 hospitalId 쿼리 파라미터 사용 불가
    if (userRole === 'hospital_admin' && hospitalId) {
      return res.status(403).json({ error: "병원 관리자는 다른 병원의 데이터를 조회할 수 없습니다" });
    }

    // 병원 관리자는 자기 병원 제출만 조회 (데이터베이스 레벨에서 필터링)
    let submissions;
    if (userRole === 'hospital_admin') {
      if (!userHospitalId) {
        return res.status(403).json({ error: "병원 정보가 없습니다" });
      }

      // hospital_admin은 데이터베이스에서 직접 필터링
      // 1. 먼저 접근 가능한 themeMission ID들을 가져옴
      const accessibleMissions = await db.query.themeMissions.findMany({
        where: or(
          eq(themeMissions.visibilityType, VISIBILITY_TYPE.PUBLIC),
          and(
            eq(themeMissions.visibilityType, VISIBILITY_TYPE.HOSPITAL),
            eq(themeMissions.hospitalId, userHospitalId)
          )
        ),
        columns: { id: true }
      });

      const accessibleMissionIds = accessibleMissions.map(m => m.id);

      if (accessibleMissionIds.length === 0) {
        return res.json([]);
      }

      // 2. 접근 가능한 미션의 세부미션들만 조회
      const accessibleSubMissions = await db.query.subMissions.findMany({
        where: inArray(subMissions.themeMissionId, accessibleMissionIds),
        columns: { id: true }
      });

      const accessibleSubMissionIds = accessibleSubMissions.map(sm => sm.id);

      if (accessibleSubMissionIds.length === 0) {
        return res.json([]);
      }

      // 3. 조건 구성
      const conditions = [
        inArray(subMissionSubmissions.subMissionId, accessibleSubMissionIds)
      ];

      if (subMissionId) {
        const requestedSubMissionId = parseInt(subMissionId as string);
        // 요청한 세부미션이 접근 가능한 목록에 있는지 확인
        if (!accessibleSubMissionIds.includes(requestedSubMissionId)) {
          return res.status(403).json({ error: "접근 권한이 없습니다" });
        }
        conditions.push(eq(subMissionSubmissions.subMissionId, requestedSubMissionId));
      }

      if (status && status !== 'all') {
        conditions.push(eq(subMissionSubmissions.status, status as string));
      }

      // 4. 제출 내역 조회
      submissions = await db.query.subMissionSubmissions.findMany({
        where: and(...conditions),
        with: {
          user: true,
          subMission: {
            with: {
              themeMission: {
                with: {
                  category: true,
                  hospital: true
                }
              }
            }
          }
        },
        orderBy: [desc(subMissionSubmissions.submittedAt)]
      });
    } else {
      // super_admin 또는 admin은 모든 제출 조회 가능
      const conditions = [];

      if (subMissionId) {
        conditions.push(eq(subMissionSubmissions.subMissionId, parseInt(subMissionId as string)));
      }

      if (status && status !== 'all') {
        conditions.push(eq(subMissionSubmissions.status, status as string));
      }

      submissions = await db.query.subMissionSubmissions.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          user: true,
          subMission: {
            with: {
              themeMission: {
                with: {
                  category: true,
                  hospital: true
                }
              }
            }
          }
        },
        orderBy: [desc(subMissionSubmissions.submittedAt)]
      });
    }

    res.json(submissions);
  } catch (error) {
    console.error("Error fetching submissions:", error);
    res.status(500).json({ error: "제출 내역 조회 실패" });
  }
});

// 검수 대기 목록 조회
router.get("/admin/review/pending", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const { hospitalId } = req.query;
    const userRole = req.user?.memberType;
    const userHospitalId = req.user?.hospitalId;

    // 병원 관리자는 자기 병원만 조회
    let filterHospitalId = hospitalId ? parseInt(hospitalId as string) : undefined;
    if (userRole === 'hospital_admin') {
      filterHospitalId = userHospitalId || undefined;
    }

    // 제출 상태인 세부 미션 조회
    const pendingSubmissions = await db.query.subMissionSubmissions.findMany({
      where: eq(subMissionSubmissions.status, MISSION_STATUS.SUBMITTED),
      with: {
        subMission: {
          with: {
            themeMission: {
              with: {
                category: true,
                hospital: true
              }
            }
          }
        }
      },
      orderBy: [asc(subMissionSubmissions.submittedAt)]
    });

    // 병원 필터링
    const filteredSubmissions = filterHospitalId
      ? pendingSubmissions.filter(s => s.subMission.themeMission.hospitalId === filterHospitalId)
      : pendingSubmissions;

    res.json(filteredSubmissions);
  } catch (error) {
    console.error("Error fetching pending reviews:", error);
    res.status(500).json({ error: "검수 대기 목록 조회 실패" });
  }
});

// 세부 미션 승인
router.post("/admin/review/submissions/:submissionId/approve", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const submissionId = parseInt(req.params.submissionId);
    const { reviewerNote } = req.body;
    const reviewerId = req.user?.userId;

    if (!reviewerId) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    // 제출 조회
    const submission = await db.query.subMissionSubmissions.findFirst({
      where: eq(subMissionSubmissions.id, submissionId)
    });

    if (!submission) {
      return res.status(404).json({ error: "제출 내역을 찾을 수 없습니다" });
    }

    // 이미 승인/거절된 경우
    if (submission.status !== MISSION_STATUS.SUBMITTED) {
      return res.status(400).json({ error: "이미 검수 완료된 제출입니다" });
    }

    // 승인 처리 및 영구 잠금
    const [approvedSubmission] = await db
      .update(subMissionSubmissions)
      .set({
        status: MISSION_STATUS.APPROVED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: reviewerNote,
        isLocked: true, // 영구 잠금
        updatedAt: new Date()
      })
      .where(eq(subMissionSubmissions.id, submissionId))
      .returning();

    res.json(approvedSubmission);
  } catch (error) {
    console.error("Error approving submission:", error);
    res.status(500).json({ error: "승인 처리 실패" });
  }
});

// 세부 미션 거절
router.post("/admin/review/submissions/:submissionId/reject", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const submissionId = parseInt(req.params.submissionId);
    const { reviewerNote } = req.body;
    const reviewerId = req.user?.userId;

    if (!reviewerId) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    if (!reviewerNote) {
      return res.status(400).json({ error: "거절 사유를 입력해주세요" });
    }

    // 제출 조회
    const submission = await db.query.subMissionSubmissions.findFirst({
      where: eq(subMissionSubmissions.id, submissionId)
    });

    if (!submission) {
      return res.status(404).json({ error: "제출 내역을 찾을 수 없습니다" });
    }

    // 이미 승인/거절된 경우
    if (submission.status !== MISSION_STATUS.SUBMITTED) {
      return res.status(400).json({ error: "이미 검수 완료된 제출입니다" });
    }

    // 거절 처리 (영구 잠금 하지 않음 - 재제출 가능)
    const [rejectedSubmission] = await db
      .update(subMissionSubmissions)
      .set({
        status: MISSION_STATUS.REJECTED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: reviewerNote,
        updatedAt: new Date()
      })
      .where(eq(subMissionSubmissions.id, submissionId))
      .returning();

    res.json(rejectedSubmission);
  } catch (error) {
    console.error("Error rejecting submission:", error);
    res.status(500).json({ error: "거절 처리 실패" });
  }
});

// 검수 통계
router.get("/admin/review/stats", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const userRole = req.user?.memberType;
    const userHospitalId = req.user?.hospitalId;

    // 병원 관리자는 자기 병원만
    const hospitalFilter = userRole === 'hospital_admin' && userHospitalId
      ? sql`AND tm.hospital_id = ${userHospitalId}`
      : sql``;

    const stats = await db.execute(sql`
      SELECT
        COUNT(CASE WHEN sms.status = ${MISSION_STATUS.SUBMITTED} THEN 1 END)::int as pending,
        COUNT(CASE WHEN sms.status = ${MISSION_STATUS.APPROVED} THEN 1 END)::int as approved,
        COUNT(CASE WHEN sms.status = ${MISSION_STATUS.REJECTED} THEN 1 END)::int as rejected,
        COUNT(*)::int as total
      FROM ${subMissionSubmissions} sms
      JOIN ${subMissions} sm ON sms.sub_mission_id = sm.id
      JOIN ${themeMissions} tm ON sm.theme_mission_id = tm.id
      WHERE 1=1 ${hospitalFilter}
    `);

    res.json(stats.rows[0] || { pending: 0, approved: 0, rejected: 0, total: 0 });
  } catch (error) {
    console.error("Error fetching review stats:", error);
    res.status(500).json({ error: "검수 통계 조회 실패" });
  }
});

export default router;
