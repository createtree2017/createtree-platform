import { Router } from "express";
import { z } from "zod";
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
import { createUploadMiddleware } from "../config/upload-config";
import { saveImageToGCS, saveFileToGCS, ensurePermanentUrl } from "../utils/gcs-image-storage";

const router = Router();

// 미션 파일 업로드용 미들웨어 (모든 파일 형식 허용, 실행 파일 제외)
const missionFileUpload = createUploadMiddleware('uploads', 'all', {
  maxFileSize: 10 * 1024 * 1024, // 10MB
});

// 미션 헤더 이미지 업로드용 미들웨어 (이미지만 허용, 5MB)
const missionHeaderUpload = createUploadMiddleware('uploads', 'image', {
  maxFileSize: 5 * 1024 * 1024, // 5MB
});

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
// 관리자 - 미션 헤더 이미지 업로드 API
// ============================================

// 미션 헤더 이미지 업로드
router.post("/admin/missions/upload-header", requireAdminOrSuperAdmin, missionHeaderUpload.single('headerImage'), async (req, res) => {
  try {
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ success: false, error: "이미지 파일이 필요합니다" });
    }

    // GCS에 이미지 저장 (userId를 'admin'으로 설정, 공용 헤더 이미지)
    const result = await saveImageToGCS(file.buffer, 'admin', 'mission-headers', file.originalname);
    
    // 영구 공개 URL 반환 (originalUrl은 이미 공개 URL)
    const permanentUrl = result.originalUrl;

    console.log(`✅ 미션 헤더 이미지 업로드 성공: ${permanentUrl}`);

    res.json({ 
      success: true, 
      imageUrl: permanentUrl,
      gsPath: result.gsPath
    });
  } catch (error) {
    console.error("Error uploading mission header image:", error);
    res.status(500).json({ success: false, error: "이미지 업로드 실패" });
  }
});

// ============================================
// 관리자 - 주제 미션 CRUD API
// ============================================

// 주제 미션 목록 조회 (필터링 지원)
router.get("/admin/missions", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const { visibilityType, hospitalId, isActive, categoryId, parentMissionId } = req.query;

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

    // 하부미션 필터링: parentMissionId가 주어지면 해당 부모의 하부미션만, 없으면 최상위 미션만
    if (parentMissionId) {
      conditions.push(eq(themeMissions.parentMissionId, parseInt(parentMissionId as string)));
    } else {
      // 기본: 최상위 미션만 조회 (parentMissionId가 null인 것)
      conditions.push(sql`${themeMissions.parentMissionId} IS NULL`);
    }

    // 모든 미션을 조회하고 프론트엔드에서 계층 구조를 구성하도록 변경
    // parentMissionId 필터는 제외하고 모든 미션을 가져온 후 트리 구성
    const baseConditions = conditions.filter(c => c !== sql`${themeMissions.parentMissionId} IS NULL`);
    
    const missions = await db.query.themeMissions.findMany({
      where: baseConditions.length > 0 ? and(...baseConditions) : undefined,
      with: {
        category: true,
        hospital: true,
        subMissions: {
          orderBy: [asc(subMissions.order)]
        }
      },
      orderBy: [asc(themeMissions.order), desc(themeMissions.id)]
    });

    // 계층 구조 구성 (서버에서 처리)
    const missionMap = new Map<number, any>();
    const rootMissions: any[] = [];

    // 먼저 모든 미션을 맵에 저장
    for (const mission of missions) {
      missionMap.set(mission.id, {
        ...mission,
        subMissionCount: mission.subMissions.length,
        childMissions: []
      });
    }

    // 부모-자식 관계 연결
    for (const mission of missions) {
      const missionWithChildren = missionMap.get(mission.id)!;
      if (mission.parentMissionId) {
        const parent = missionMap.get(mission.parentMissionId);
        if (parent) {
          parent.childMissions.push(missionWithChildren);
        } else {
          // 부모가 필터링으로 제외된 경우 루트로 처리
          rootMissions.push(missionWithChildren);
        }
      } else {
        rootMissions.push(missionWithChildren);
      }
    }

    // childMissionCount 계산
    const calculateChildCount = (mission: any): number => {
      let count = mission.childMissions.length;
      for (const child of mission.childMissions) {
        count += calculateChildCount(child);
      }
      return count;
    };

    for (const mission of missionMap.values()) {
      mission.childMissionCount = mission.childMissions.length;
    }

    res.json(rootMissions);
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
    // Duplicate key constraint error
    if (error.code === '23505' && error.constraint === 'theme_missions_mission_id_key') {
      return res.status(400).json({ error: "이미 존재하는 미션 ID입니다. 다른 ID를 사용해주세요." });
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

// ============================================
// 관리자 - 하부미션 관리 API
// ============================================

// 특정 부모 미션의 하부미션 목록 조회
router.get("/admin/missions/:parentId/child-missions", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const parentId = parseInt(req.params.parentId);

    const childMissions = await db.query.themeMissions.findMany({
      where: eq(themeMissions.parentMissionId, parentId),
      with: {
        category: true,
        hospital: true,
        subMissions: {
          orderBy: [asc(subMissions.order)]
        },
        childMissions: true
      },
      orderBy: [asc(themeMissions.order), desc(themeMissions.id)]
    });

    // 각 하부미션의 승인된 사용자 수 조회
    const childMissionsWithStats = await Promise.all(
      childMissions.map(async (mission) => {
        const approvedCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(userMissionProgress)
          .where(
            and(
              eq(userMissionProgress.themeMissionId, mission.id),
              eq(userMissionProgress.status, MISSION_STATUS.APPROVED)
            )
          );

        return {
          ...mission,
          subMissionCount: mission.subMissions.length,
          childMissionCount: mission.childMissions?.length || 0,
          approvedUserCount: approvedCount[0]?.count || 0
        };
      })
    );

    res.json(childMissionsWithStats);
  } catch (error) {
    console.error("Error fetching child missions:", error);
    res.status(500).json({ error: "하부미션 조회 실패" });
  }
});

// 하부미션 생성 스키마 (부모로부터 상속되는 필드 제외)
const childMissionCreateSchema = z.object({
  missionId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  order: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

// 하부미션 생성 (부모 미션 ID 필수)
router.post("/admin/missions/:parentId/child-missions", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const parentId = parseInt(req.params.parentId);
    
    // 부모 미션 존재 확인
    const parentMission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.id, parentId)
    });

    if (!parentMission) {
      return res.status(404).json({ error: "부모 미션을 찾을 수 없습니다" });
    }

    // 하부미션용 스키마로 검증 (visibilityType, hospitalId 제외)
    const missionData = childMissionCreateSchema.parse(req.body);

    // 하부미션은 부모의 병원/공개범위를 상속
    const [newChildMission] = await db
      .insert(themeMissions)
      .values({
        missionId: missionData.missionId,
        title: missionData.title,
        description: missionData.description || "",
        categoryId: missionData.categoryId || null,
        order: missionData.order,
        isActive: missionData.isActive,
        startDate: missionData.startDate ? new Date(missionData.startDate) : null,
        endDate: missionData.endDate ? new Date(missionData.endDate) : null,
        parentMissionId: parentId,
        hospitalId: parentMission.hospitalId,
        visibilityType: parentMission.visibilityType
      })
      .returning();

    res.status(201).json(newChildMission);
  } catch (error: any) {
    console.error("Error creating child mission:", error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "유효하지 않은 데이터", details: error.errors });
    }
    res.status(500).json({ error: "하부미션 생성 실패" });
  }
});

// 부모 미션에서 승인된 사용자 목록 조회 (하부미션 생성 전 확인용)
router.get("/admin/missions/:parentId/approved-users", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const parentId = parseInt(req.params.parentId);

    const approvedProgress = await db.query.userMissionProgress.findMany({
      where: and(
        eq(userMissionProgress.themeMissionId, parentId),
        eq(userMissionProgress.status, MISSION_STATUS.APPROVED)
      ),
      with: {
        user: true
      }
    });

    const users = approvedProgress.map(p => ({
      userId: p.userId,
      name: (p.user as any)?.name || '알 수 없음',
      email: (p.user as any)?.email || '',
      approvedAt: p.reviewedAt
    }));

    res.json({
      parentMissionId: parentId,
      approvedCount: users.length,
      users
    });
  } catch (error) {
    console.error("Error fetching approved users:", error);
    res.status(500).json({ error: "승인된 사용자 조회 실패" });
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

    // 공개 미션 + 내 병원 전용 미션만 조회 + 최상위 미션만 (parentMissionId가 null)
    const conditions = [
      eq(themeMissions.isActive, true),
      sql`${themeMissions.parentMissionId} IS NULL`, // 최상위 미션만 조회
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
        },
        childMissions: {
          where: eq(themeMissions.isActive, true)
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

        // 하부미션 접근 가능 여부 (승인된 경우에만)
        const hasChildMissions = (mission.childMissions?.length || 0) > 0;
        const isApprovedForChildAccess = progress?.status === MISSION_STATUS.APPROVED;

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
          totalSubMissions,
          hasChildMissions,
          childMissionCount: mission.childMissions?.length || 0,
          isApprovedForChildAccess
        };
      })
    );

    res.json(missionsWithProgress);
  } catch (error) {
    console.error("Error fetching user missions:", error);
    res.status(500).json({ error: "미션 목록 조회 실패" });
  }
});

// 사용자용 하부미션 목록 조회 (부모 미션에서 승인된 사용자만 접근 가능)
router.get("/missions/:parentId/child-missions", requireAuth, async (req, res) => {
  try {
    const parentId = parseInt(req.params.parentId);
    const userId = req.user?.userId;
    const userHospitalId = req.user?.hospitalId;

    if (!userId) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    // 부모 미션 조회
    const parentMission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.id, parentId)
    });

    if (!parentMission) {
      return res.status(404).json({ error: "부모 미션을 찾을 수 없습니다" });
    }

    // 부모 미션에서 승인되었는지 확인
    const parentProgress = await db.query.userMissionProgress.findFirst({
      where: and(
        eq(userMissionProgress.userId, userId),
        eq(userMissionProgress.themeMissionId, parentId),
        eq(userMissionProgress.status, MISSION_STATUS.APPROVED)
      )
    });

    if (!parentProgress) {
      return res.status(403).json({ 
        error: "접근 권한이 없습니다",
        message: "부모 미션에서 승인을 받아야 하부미션에 접근할 수 있습니다"
      });
    }

    // 하부미션 목록 조회
    const childMissions = await db.query.themeMissions.findMany({
      where: and(
        eq(themeMissions.parentMissionId, parentId),
        eq(themeMissions.isActive, true)
      ),
      with: {
        category: true,
        subMissions: {
          where: eq(subMissions.isActive, true),
          orderBy: [asc(subMissions.order)]
        },
        childMissions: {
          where: eq(themeMissions.isActive, true)
        }
      },
      orderBy: [asc(themeMissions.order), desc(themeMissions.id)]
    });

    // 각 하부미션의 진행률 계산
    const childMissionsWithProgress = await Promise.all(
      childMissions.map(async (mission) => {
        const progress = await db.query.userMissionProgress.findFirst({
          where: and(
            eq(userMissionProgress.userId, userId),
            eq(userMissionProgress.themeMissionId, mission.id)
          )
        });

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

        const hasChildMissions = (mission.childMissions?.length || 0) > 0;
        const isApprovedForChildAccess = progress?.status === MISSION_STATUS.APPROVED;

        return {
          ...mission,
          userProgress: progress ? {
            ...progress,
            progressPercent: progressPercentage,
            completedSubMissions,
            totalSubMissions
          } : {
            status: MISSION_STATUS.NOT_STARTED,
            progressPercent: progressPercentage,
            completedSubMissions,
            totalSubMissions
          },
          progressPercentage,
          completedSubMissions,
          totalSubMissions,
          hasChildMissions,
          childMissionCount: mission.childMissions?.length || 0,
          isApprovedForChildAccess
        };
      })
    );

    res.json({
      parentMission: {
        id: parentMission.id,
        missionId: parentMission.missionId,
        title: parentMission.title
      },
      childMissions: childMissionsWithProgress
    });
  } catch (error) {
    console.error("Error fetching child missions:", error);
    res.status(500).json({ error: "하부미션 조회 실패" });
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

        // 🔧 만료된 서명 URL을 영구 공개 URL로 변환 (submissionData JSON 필드에서)
        if (submission) {
          const originalData = submission.submissionData as any;
          if (originalData) {
            // Clone to avoid mutating original data
            const data = JSON.parse(JSON.stringify(originalData));
            
            // 레거시 단일 데이터 처리 (gsPath가 있을 때만)
            if (data.fileUrl && data.gsPath) {
              data.fileUrl = ensurePermanentUrl(data.fileUrl, data.gsPath);
            }
            if (data.imageUrl && data.gsPath) {
              data.imageUrl = ensurePermanentUrl(data.imageUrl, data.gsPath);
            }
            // 슬롯 배열 데이터 처리
            if (data.slots && Array.isArray(data.slots)) {
              data.slots = data.slots.map((slot: any) => ({
                ...slot,
                fileUrl: (slot.fileUrl && slot.gsPath) ? ensurePermanentUrl(slot.fileUrl, slot.gsPath) : slot.fileUrl,
                imageUrl: (slot.imageUrl && slot.gsPath) ? ensurePermanentUrl(slot.imageUrl, slot.gsPath) : slot.imageUrl
              }));
            }
            
            return {
              ...subMission,
              submission: { ...submission, submissionData: data }
            };
          }
        }

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

    // 미션 기간 검증
    if (mission.startDate && mission.endDate) {
      const now = new Date();
      const startDate = new Date(mission.startDate);
      const endDate = new Date(mission.endDate);
      
      // 시작일의 00:00:00으로 설정
      startDate.setHours(0, 0, 0, 0);
      // 종료일의 23:59:59로 설정
      endDate.setHours(23, 59, 59, 999);
      
      if (now < startDate) {
        return res.status(400).json({ 
          error: "미션이 아직 시작되지 않았습니다",
          startDate: mission.startDate 
        });
      }
      
      if (now > endDate) {
        return res.status(400).json({ 
          error: "미션 기간이 종료되었습니다",
          endDate: mission.endDate 
        });
      }
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
    } else if (hospitalId && hospitalId !== 'all') {
      // superadmin/admin이 특정 병원으로 필터링하는 경우
      const filterHospitalId = parseInt(hospitalId as string, 10);
      if (!isNaN(filterHospitalId)) {
        conditions.push(eq(themeMissions.hospitalId, filterHospitalId));
      }
    }

    // 주제미션 조회 (모든 미션 가져와서 트리 구조로 변환)
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

    // 계층 구조 구성 (서버에서 처리)
    const missionMap = new Map<number, any>();
    const rootMissions: any[] = [];

    // 먼저 모든 미션을 맵에 저장
    for (const mission of missionsWithStats) {
      missionMap.set(mission.id, {
        ...mission,
        childMissions: []
      });
    }

    // 부모-자식 관계 연결
    for (const mission of missionsWithStats) {
      const missionWithChildren = missionMap.get(mission.id)!;
      if (mission.parentMissionId) {
        const parent = missionMap.get(mission.parentMissionId);
        if (parent) {
          parent.childMissions.push(missionWithChildren);
        } else {
          // 부모가 필터링으로 제외된 경우 루트로 처리
          rootMissions.push(missionWithChildren);
        }
      } else {
        rootMissions.push(missionWithChildren);
      }
    }

    res.json(rootMissions);
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

    // 🔧 만료된 서명 URL을 영구 공개 URL로 변환 (submissionData JSON 필드에서)
    const processedSubmissions = submissions.map((submission: any) => {
      const originalData = submission.submissionData as any;
      if (!originalData) return submission;
      
      // Clone to avoid mutating original data
      const processedData = JSON.parse(JSON.stringify(originalData));
      
      // 레거시 단일 데이터 처리 (gsPath가 있을 때만)
      if (processedData.fileUrl && processedData.gsPath) {
        processedData.fileUrl = ensurePermanentUrl(processedData.fileUrl, processedData.gsPath);
      }
      if (processedData.imageUrl && processedData.gsPath) {
        processedData.imageUrl = ensurePermanentUrl(processedData.imageUrl, processedData.gsPath);
      }
      // 슬롯 배열 데이터 처리
      if (processedData.slots && Array.isArray(processedData.slots)) {
        processedData.slots = processedData.slots.map((slot: any) => ({
          ...slot,
          fileUrl: (slot.fileUrl && slot.gsPath) ? ensurePermanentUrl(slot.fileUrl, slot.gsPath) : slot.fileUrl,
          imageUrl: (slot.imageUrl && slot.gsPath) ? ensurePermanentUrl(slot.imageUrl, slot.gsPath) : slot.imageUrl
        }));
      }
      
      return {
        ...submission,
        submissionData: processedData
      };
    });

    res.json(processedSubmissions);
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
    const { hospitalId } = req.query;

    // 병원 관리자는 자기 병원만
    let hospitalFilterSql = sql``;
    if (userRole === 'hospital_admin' && userHospitalId) {
      hospitalFilterSql = sql`AND tm.hospital_id = ${userHospitalId}`;
    } else if (hospitalId && hospitalId !== 'all') {
      // superadmin/admin이 특정 병원으로 필터링하는 경우
      const filterHospitalId = parseInt(hospitalId as string, 10);
      if (!isNaN(filterHospitalId)) {
        hospitalFilterSql = sql`AND tm.hospital_id = ${filterHospitalId}`;
      }
    }

    const stats = await db.execute(sql`
      SELECT
        COUNT(CASE WHEN sms.status = ${MISSION_STATUS.SUBMITTED} THEN 1 END)::int as pending,
        COUNT(CASE WHEN sms.status = ${MISSION_STATUS.APPROVED} THEN 1 END)::int as approved,
        COUNT(CASE WHEN sms.status = ${MISSION_STATUS.REJECTED} THEN 1 END)::int as rejected,
        COUNT(*)::int as total
      FROM ${subMissionSubmissions} sms
      JOIN ${subMissions} sm ON sms.sub_mission_id = sm.id
      JOIN ${themeMissions} tm ON sm.theme_mission_id = tm.id
      WHERE 1=1 ${hospitalFilterSql}
    `);

    res.json(stats.rows[0] || { pending: 0, approved: 0, rejected: 0, total: 0 });
  } catch (error) {
    console.error("Error fetching review stats:", error);
    res.status(500).json({ error: "검수 통계 조회 실패" });
  }
});

// ============================================
// 미션 파일 업로드 API (사용자용)
// ============================================

// 파일 업로드 (GCS 영구 저장)
router.post("/missions/upload", requireAuth, missionFileUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "파일이 업로드되지 않았습니다" });
    }

    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "사용자 인증 정보가 없습니다" });
    }

    // submissionType 파라미터 확인 (file 또는 image)
    const submissionType = req.query.submissionType as string || 'file';

    // 파일 크기 검증 (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (req.file.size > maxSize) {
      return res.status(400).json({ error: "파일 크기는 10MB 이하여야 합니다" });
    }

    // submissionType에 따른 MIME 타입 검증
    if (submissionType === 'image') {
      // image 타입: 이미지만 허용
      const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
      if (!allowedImageTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ 
          error: "이미지 파일만 업로드 가능합니다 (JPEG, PNG, GIF, WEBP)" 
        });
      }
    } else {
      // file 타입: 모든 파일 허용 (일반적인 파일 형식만)
      const blockedMimeTypes = ['application/x-msdownload', 'application/x-executable'];
      if (blockedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ 
          error: "실행 파일은 업로드할 수 없습니다" 
        });
      }
    }

    console.log(`📤 [미션 파일 업로드] 사용자 ${userId} - 타입: ${submissionType}, 파일명: ${req.file.originalname} (${req.file.mimetype})`);

    // 모든 타입 원본 그대로 저장 (최적화 없음)
    const result = await saveFileToGCS(
      req.file.buffer,
      userId,
      'missions',
      req.file.originalname,
      req.file.mimetype
    );

    console.log(`✅ [미션 ${submissionType} 업로드] GCS 원본 저장 완료: ${result.originalUrl}`);

    res.json({
      success: true,
      fileUrl: result.originalUrl,
      thumbnailUrl: '', // 원본 보존 모드: 썸네일 없음
      gsPath: result.gsPath,
      fileName: result.fileName,
      mimeType: result.mimeType
    });

  } catch (error) {
    console.error("❌ [미션 파일 업로드] 오류:", error);
    res.status(500).json({ 
      error: "파일 업로드 실패", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
