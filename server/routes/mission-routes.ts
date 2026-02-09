import { Router } from "express";
import { z } from "zod";
import { db } from "@db";
import {
  missionCategories,
  themeMissions,
  subMissions,
  userMissionProgress,
  subMissionSubmissions,
  actionTypes,
  missionFolders,
  users,
  missionCategoriesInsertSchema,
  themeMissionsInsertSchema,
  subMissionsInsertSchema,
  actionTypesInsertSchema,
  missionFoldersInsertSchema,
  VISIBILITY_TYPE,
  MISSION_STATUS
} from "@shared/schema";
import { eq, and, or, desc, asc, sql, inArray, not } from "drizzle-orm";
import * as XLSX from "xlsx";
import { requireAuth } from "../middleware/auth";
import { requireAdminOrSuperAdmin } from "../middleware/admin-auth";
import { createUploadMiddleware } from "../config/upload-config";
import { saveImageToGCS, saveFileToGCS, ensurePermanentUrl } from "../utils/gcs-image-storage";

const router = Router();

// 재귀적으로 모든 하부미션 개수를 계산하는 헬퍼 함수 (자기 자신 포함)
async function countAllMissions(missionId: number): Promise<number> {
  const children = await db.query.themeMissions.findMany({
    where: and(
      eq(themeMissions.parentMissionId, missionId),
      eq(themeMissions.isActive, true)
    )
  });

  let count = 1; // 자기 자신
  for (const child of children) {
    count += await countAllMissions(child.id);
  }
  return count;
}

// 미션 계층 구조를 평탄화하여 트리 데이터로 반환하는 헬퍼 함수
interface MissionTreeNode {
  id: number;
  missionId: string;
  title: string;
  depth: number;
  status: string;
  isUnlocked: boolean;
  children: MissionTreeNode[];
}

async function buildMissionTree(missionId: number, userId: number, depth: number = 1): Promise<MissionTreeNode> {
  const mission = await db.query.themeMissions.findFirst({
    where: eq(themeMissions.id, missionId)
  });

  if (!mission) {
    throw new Error("Mission not found");
  }

  // 사용자 진행 상태 조회
  const progress = await db.query.userMissionProgress.findFirst({
    where: and(
      eq(userMissionProgress.userId, userId),
      eq(userMissionProgress.themeMissionId, missionId)
    )
  });

  // 잠금 해제 여부 계산
  let isUnlocked = true;
  if (mission.parentMissionId) {
    // 부모 미션이 승인되어야 잠금 해제
    const parentProgress = await db.query.userMissionProgress.findFirst({
      where: and(
        eq(userMissionProgress.userId, userId),
        eq(userMissionProgress.themeMissionId, mission.parentMissionId),
        eq(userMissionProgress.status, MISSION_STATUS.APPROVED)
      )
    });
    isUnlocked = !!parentProgress;

    // 3차+ 미션: 부모의 모든 형제도 승인되어야 함
    if (isUnlocked) {
      const parentMission = await db.query.themeMissions.findFirst({
        where: eq(themeMissions.id, mission.parentMissionId)
      });

      if (parentMission?.parentMissionId) {
        const parentSiblings = await db.query.themeMissions.findMany({
          where: and(
            eq(themeMissions.parentMissionId, parentMission.parentMissionId),
            eq(themeMissions.isActive, true)
          )
        });

        for (const sibling of parentSiblings) {
          const siblingProgress = await db.query.userMissionProgress.findFirst({
            where: and(
              eq(userMissionProgress.userId, userId),
              eq(userMissionProgress.themeMissionId, sibling.id),
              eq(userMissionProgress.status, MISSION_STATUS.APPROVED)
            )
          });
          if (!siblingProgress) {
            isUnlocked = false;
            break;
          }
        }
      }
    }
  }

  // 자식 미션들 조회
  const children = await db.query.themeMissions.findMany({
    where: and(
      eq(themeMissions.parentMissionId, missionId),
      eq(themeMissions.isActive, true)
    ),
    orderBy: [asc(themeMissions.order), asc(themeMissions.id)]
  });

  // 재귀적으로 자식 트리 구축
  const childTrees = await Promise.all(
    children.map(child => buildMissionTree(child.id, userId, depth + 1))
  );

  return {
    id: mission.id,
    missionId: mission.missionId,
    title: mission.title,
    depth,
    status: progress?.status || MISSION_STATUS.NOT_STARTED,
    isUnlocked,
    children: childTrees
  };
}

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

// 미션 순서 업데이트 (드래그앤드롭) - :id 라우트보다 먼저 정의해야 함
const missionReorderSchema = z.object({
  missionOrders: z.array(z.object({
    id: z.number().int().positive(),
    order: z.number().int().min(0),
    folderId: z.number().int().positive().nullable()
  }))
});

router.put("/admin/missions/reorder", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const parseResult = missionReorderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "잘못된 요청 형식입니다", details: parseResult.error.errors });
    }
    const { missionOrders } = parseResult.data;

    for (const item of missionOrders) {
      await db.update(themeMissions)
        .set({
          order: item.order,
          folderId: item.folderId,
          updatedAt: new Date()
        })
        .where(eq(themeMissions.id, item.id));
    }

    res.json({ success: true });
  } catch (error) {
    console.error("미션 순서 업데이트 오류:", error);
    res.status(500).json({ error: "미션 순서 업데이트 실패" });
  }
});

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

    // 하부미션 필터링: parentMissionId가 주어지면 해당 부모의 하부미션만 조회
    // 그렇지 않으면 모든 미션을 조회하여 트리 구조 구성
    if (parentMissionId) {
      conditions.push(eq(themeMissions.parentMissionId, parseInt(parentMissionId as string)));
    }
    // parentMissionId가 없으면 모든 미션을 조회하여 서버에서 트리 구조 구성

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

    // 날짜 필드들을 Date 객체로 변환 (한국 시간대 기준, 모든 timestamp 필드 포함)
    const dateFields = ['startDate', 'endDate', 'eventDate', 'eventEndTime'];
    dateFields.forEach(field => {
      if (missionData[field]) {
        const value = missionData[field];
        // date-only 형식(YYYY-MM-DD)인 경우 한국 시간대 오프셋 추가
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
          const parsed = new Date(`${value}T00:00:00+09:00`);
          missionData[field] = isNaN(parsed.getTime()) ? null : parsed;
        } else {
          const parsed = new Date(value);
          missionData[field] = isNaN(parsed.getTime()) ? null : parsed;
        }
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

// 주제 미션 복사 (전체 내용 복사 + 제목에 [복사본] + 공개범위 dev)
router.post("/admin/missions/:id/duplicate", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // 원본 미션 조회 (세부미션 포함)
    const original = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.id, id),
      with: {
        subMissions: {
          orderBy: [asc(subMissions.order)]
        },
        childMissions: {
          with: {
            subMissions: {
              orderBy: [asc(subMissions.order)]
            }
          }
        }
      }
    });

    if (!original) {
      return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
    }

    // 새 missionId 생성 (원본 + 타임스탬프)
    const newMissionId = `${original.missionId}-copy-${Date.now()}`;

    // 주제미션 복사 (id, missionId, createdAt, updatedAt, relation 필드 모두 제외)
    const { id: _id, missionId: _mid, createdAt: _ca, updatedAt: _ua, subMissions: _sm, childMissions: _cm, category: _cat, hospital: _h, folder: _f, parentMission: _pm, userProgress: _up, ...missionData } = original as any;

    console.log(`[미션 복사] 복사할 데이터 키:`, Object.keys(missionData));

    const [newMission] = await db
      .insert(themeMissions)
      .values({
        ...missionData,
        missionId: newMissionId,
        title: `[복사본] ${original.title}`,
        visibilityType: VISIBILITY_TYPE.DEV,
        hospitalId: null, // dev 타입이므로 병원 해제
        parentMissionId: null, // 복사본은 항상 최상위 미션
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    console.log(`[미션 복사] 새 미션 생성됨:`, JSON.stringify(newMission, null, 2));

    // 세부미션 복사
    if (original.subMissions && original.subMissions.length > 0) {
      for (const sub of original.subMissions) {
        const { id: _sid, themeMissionId: _tmid, createdAt: _sca, updatedAt: _sua, ...subData } = sub;
        await db.insert(subMissions).values({
          ...subData,
          themeMissionId: newMission.id,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    // 하위미션(child missions) 복사
    if (original.childMissions && original.childMissions.length > 0) {
      for (const child of original.childMissions) {
        const childNewMissionId = `${child.missionId}-copy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const { id: _cid, missionId: _cmid, parentMissionId: _pmid, createdAt: _cca, updatedAt: _cua, subMissions: _csm, childMissions: _ccm, category: _ccat, hospital: _ch, ...childData } = child as any;

        const [newChild] = await db
          .insert(themeMissions)
          .values({
            ...childData,
            missionId: childNewMissionId,
            title: `[복사본] ${child.title}`,
            visibilityType: VISIBILITY_TYPE.DEV,
            hospitalId: null,
            parentMissionId: newMission.id,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();

        // 하위미션의 세부미션도 복사
        if (child.subMissions && child.subMissions.length > 0) {
          for (const sub of child.subMissions) {
            const { id: _sid, themeMissionId: _tmid, createdAt: _sca, updatedAt: _sua, ...subData } = sub;
            await db.insert(subMissions).values({
              ...subData,
              themeMissionId: newChild.id,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        }
      }
    }

    console.log(`[미션 복사] "${original.title}" → "[복사본] ${original.title}" (ID: ${newMission.id})`);
    res.status(201).json(newMission);
  } catch (error: any) {
    console.error("Error duplicating theme mission:", error);
    if (error.code === '23505') {
      return res.status(400).json({ error: "복사 중 중복 오류가 발생했습니다. 다시 시도해주세요." });
    }
    res.status(500).json({ error: "주제 미션 복사 실패" });
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

    // 날짜 변환 (한국 시간대 기준)
    const parseKoreanDate = (dateStr: string | null | undefined) => {
      if (!dateStr) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return new Date(`${dateStr}T00:00:00+09:00`);
      }
      return new Date(dateStr);
    };

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
        startDate: parseKoreanDate(missionData.startDate),
        endDate: parseKoreanDate(missionData.endDate),
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

    // 요청 데이터 복사
    const requestData = {
      ...req.body,
      themeMissionId: mission.id,
      order: nextOrder
    };

    // 날짜 필드 변환 (YYYY-MM-DD 형식을 한국 시간대 기준 timestamp로 변환, 빈 문자열은 null 처리)
    if (requestData.startDate && requestData.startDate.trim() !== '') {
      const startDate = new Date(`${requestData.startDate}T00:00:00+09:00`);
      requestData.startDate = isNaN(startDate.getTime()) ? null : startDate;
    } else {
      requestData.startDate = null;
    }
    if (requestData.endDate && requestData.endDate.trim() !== '') {
      const endDate = new Date(`${requestData.endDate}T23:59:59+09:00`);
      requestData.endDate = isNaN(endDate.getTime()) ? null : endDate;
    } else {
      requestData.endDate = null;
    }

    // sequentialLevel 처리
    if (requestData.sequentialLevel !== undefined) {
      requestData.sequentialLevel = parseInt(requestData.sequentialLevel) || 0;
    } else {
      requestData.sequentialLevel = 0;
    }

    const subMissionData = subMissionsInsertSchema.parse(requestData);

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

    // 요청 데이터 복사
    const requestData = { ...req.body };

    // 날짜 필드 변환 (YYYY-MM-DD 형식을 한국 시간대 기준 timestamp로 변환, 빈 문자열은 null 처리)
    if (requestData.startDate && requestData.startDate.trim() !== '') {
      const startDate = new Date(`${requestData.startDate}T00:00:00+09:00`);
      requestData.startDate = isNaN(startDate.getTime()) ? null : startDate;
    } else {
      requestData.startDate = null;
    }
    if (requestData.endDate && requestData.endDate.trim() !== '') {
      const endDate = new Date(`${requestData.endDate}T23:59:59+09:00`);
      requestData.endDate = isNaN(endDate.getTime()) ? null : endDate;
    } else {
      requestData.endDate = null;
    }

    // sequentialLevel 처리
    if (requestData.sequentialLevel !== undefined) {
      requestData.sequentialLevel = parseInt(requestData.sequentialLevel) || 0;
    }

    const subMissionData = subMissionsInsertSchema.partial().parse(requestData);

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

// 나의 참여 미션 목록 조회 (세부미션에 제출 기록이 있는 미션들)
router.get("/missions/my", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    // 사용자가 제출한 세부미션들의 themeMissionId 목록 조회
    const userSubmissions = await db
      .select({
        themeMissionId: subMissions.themeMissionId
      })
      .from(subMissionSubmissions)
      .innerJoin(subMissions, eq(subMissionSubmissions.subMissionId, subMissions.id))
      .where(eq(subMissionSubmissions.userId, userId))
      .groupBy(subMissions.themeMissionId);

    if (userSubmissions.length === 0) {
      return res.json([]);
    }

    const themeMissionIds = userSubmissions.map(s => s.themeMissionId);

    // 해당 미션들의 최상위 부모 미션 ID를 찾는 함수
    async function getRootMissionId(missionId: number): Promise<number> {
      const mission = await db.query.themeMissions.findFirst({
        where: eq(themeMissions.id, missionId)
      });

      if (!mission || !mission.parentMissionId) {
        return missionId;
      }

      return getRootMissionId(mission.parentMissionId);
    }

    // 모든 참여 미션의 최상위 부모 미션 ID 수집
    const rootMissionIds = await Promise.all(
      themeMissionIds.map(id => getRootMissionId(id))
    );
    const uniqueRootMissionIds = [...new Set(rootMissionIds)];

    // 최상위 미션들 조회
    const missions = await db.query.themeMissions.findMany({
      where: and(
        inArray(themeMissions.id, uniqueRootMissionIds),
        eq(themeMissions.isActive, true)
      ),
      with: {
        category: true,
        hospital: true,
        subMissions: {
          where: eq(subMissions.isActive, true),
          orderBy: [asc(subMissions.order)]
        },
        childMissions: {
          where: eq(themeMissions.isActive, true)
        }
      },
      orderBy: [desc(themeMissions.id)]
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

        // 승인된 세부 미션 개수 조회 (approved 상태만 카운트)
        const approvedCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(subMissionSubmissions)
          .where(
            and(
              eq(subMissionSubmissions.userId, userId),
              eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED),
              sql`${subMissionSubmissions.subMissionId} IN (SELECT id FROM ${subMissions} WHERE ${subMissions.themeMissionId} = ${mission.id})`
            )
          );

        const totalSubMissions = mission.subMissions.length;
        const completedSubMissions = approvedCount[0]?.count || 0;
        const progressPercentage = totalSubMissions > 0
          ? Math.round((completedSubMissions / totalSubMissions) * 100)
          : 0;

        // 전체 하부미션 개수 계산
        const totalMissionCount = await countAllMissions(mission.id);

        return {
          ...mission,
          hasChildMissions: mission.childMissions && mission.childMissions.length > 0,
          childMissionCount: mission.childMissions?.length || 0,
          totalMissionCount,
          userProgress: {
            status: progress?.status || MISSION_STATUS.IN_PROGRESS,
            progressPercent: progressPercentage,
            completedSubMissions,
            totalSubMissions
          },
          hasGift: !!(mission.giftImageUrl || mission.giftDescription)
        };
      })
    );

    res.json(missionsWithProgress);
  } catch (error) {
    console.error("Error fetching user's participated missions:", error);
    res.status(500).json({ error: "참여 미션 조회 실패" });
  }
});

// 사용자용 미션 목록 조회 (공개 범위 필터링, 진행률 계산)
router.get("/missions", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const userHospitalId = req.user?.hospitalId;
    const memberType = req.user?.memberType;
    const isSuperAdmin = memberType === "superadmin";

    if (!userId) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    // 공개 미션 + 내 병원 전용 미션만 조회 + 최상위 미션만 (parentMissionId가 null)
    // dev 타입은 슈퍼관리자만 조회 가능
    const visibilityCondition = isSuperAdmin
      ? or(
        eq(themeMissions.visibilityType, VISIBILITY_TYPE.PUBLIC),
        eq(themeMissions.visibilityType, VISIBILITY_TYPE.DEV),
        and(
          eq(themeMissions.visibilityType, VISIBILITY_TYPE.HOSPITAL),
          userHospitalId ? eq(themeMissions.hospitalId, userHospitalId) : sql`false`
        )
      )
      : or(
        eq(themeMissions.visibilityType, VISIBILITY_TYPE.PUBLIC),
        and(
          eq(themeMissions.visibilityType, VISIBILITY_TYPE.HOSPITAL),
          userHospitalId ? eq(themeMissions.hospitalId, userHospitalId) : sql`false`
        )
      );

    const conditions = [
      eq(themeMissions.isActive, true),
      sql`${themeMissions.parentMissionId} IS NULL`, // 최상위 미션만 조회
      visibilityCondition
    ];

    const missions = await db.query.themeMissions.findMany({
      where: and(...conditions),
      with: {
        category: true,
        subMissions: {
          where: eq(subMissions.isActive, true),
          orderBy: [asc(subMissions.order)],
          with: {
            actionType: true  // 액션타입 포함
          }
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

        // 승인된 세부 미션 개수 조회 (approved 상태만 카운트)
        const approvedCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(subMissionSubmissions)
          .where(
            and(
              eq(subMissionSubmissions.userId, userId),
              eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED),
              sql`${subMissionSubmissions.subMissionId} IN (SELECT id FROM ${subMissions} WHERE ${subMissions.themeMissionId} = ${mission.id})`
            )
          );

        const totalSubMissions = mission.subMissions.length;
        const completedSubMissions = approvedCount[0]?.count || 0;
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

        // 전체 미션 개수 (자기 자신 + 모든 하부미션 재귀 계산)
        const totalMissionCount = await countAllMissions(mission.id);

        // 신청 세부미션 찾기 (이미 조회된 subMissions에서 찾기)
        const applicationSubMission = mission.subMissions.find((sm: any) => sm.actionType?.name === '신청');

        // 디버그 로그
        console.log(`[미션 ${mission.id}] 세부미션 수: ${mission.subMissions.length}, 신청미션: ${applicationSubMission ? '있음' : '없음'}`);
        if (applicationSubMission) {
          console.log(`[미션 ${mission.id}] 신청미션 날짜: ${applicationSubMission.startDate} ~ ${applicationSubMission.endDate}`);
        }

        // 모집 인원 계산 (신청 타입 세부미션이 있을 때만)
        let currentApplicants = 0;
        if (applicationSubMission && mission.capacity) {
          const applicantCount = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(subMissionSubmissions)
            .where(
              and(
                eq(subMissionSubmissions.subMissionId, applicationSubMission.id),
                or(
                  eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED),
                  eq(subMissionSubmissions.status, MISSION_STATUS.SUBMITTED)
                )
              )
            );
          currentApplicants = applicantCount[0]?.count || 0;
        }

        // 모집기간 정보 (신청 세부미션의 날짜)
        const applicationPeriod = applicationSubMission ? {
          startDate: applicationSubMission.startDate,
          endDate: applicationSubMission.endDate
        } : null;

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
          totalMissionCount,
          isApprovedForChildAccess,
          hasGift: !!(mission.giftImageUrl || mission.giftDescription),
          // 모집 정보 추가
          capacity: mission.capacity || null,
          currentApplicants,
          applicationPeriod
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

        // 승인된 세부 미션 개수 조회 (approved 상태만 카운트)
        const approvedCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(subMissionSubmissions)
          .where(
            and(
              eq(subMissionSubmissions.userId, userId),
              eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED),
              sql`${subMissionSubmissions.subMissionId} IN (SELECT id FROM ${subMissions} WHERE ${subMissions.themeMissionId} = ${mission.id})`
            )
          );

        const totalSubMissions = mission.subMissions.length;
        const completedSubMissions = approvedCount[0]?.count || 0;
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
          isApprovedForChildAccess,
          hasGift: !!(mission.giftImageUrl || mission.giftDescription)
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
          orderBy: [asc(subMissions.order)],
          with: {
            actionType: true
          }
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
    const memberType = req.user?.memberType;
    const isSuperAdmin = memberType === "superadmin";

    // dev 타입은 슈퍼관리자만 접근 가능
    if (mission.visibilityType === VISIBILITY_TYPE.DEV) {
      if (!isSuperAdmin) {
        return res.status(403).json({ error: "접근 권한이 없습니다" });
      }
    }

    if (mission.visibilityType === VISIBILITY_TYPE.HOSPITAL) {
      if (!userHospitalId || mission.hospitalId !== userHospitalId) {
        return res.status(403).json({ error: "접근 권한이 없습니다" });
      }
    }

    // 하부미션 접근 제어: 모든 조상 미션이 승인되어야 접근 가능 (재귀적 검증)
    if (mission.parentMissionId) {
      // 모든 조상 미션 체인을 검증하는 헬퍼 함수
      const validateAncestorChain = async (missionId: number): Promise<{ valid: boolean; blockerMission?: any }> => {
        const currentMission = await db.query.themeMissions.findFirst({
          where: eq(themeMissions.id, missionId)
        });

        if (!currentMission) {
          return { valid: false };
        }

        // 현재 미션의 승인 상태 확인
        const progress = await db.query.userMissionProgress.findFirst({
          where: and(
            eq(userMissionProgress.userId, userId),
            eq(userMissionProgress.themeMissionId, missionId)
          )
        });

        if (!progress || progress.status !== MISSION_STATUS.APPROVED) {
          return { valid: false, blockerMission: currentMission };
        }

        // 부모가 있으면 부모도 검증
        if (currentMission.parentMissionId) {
          return validateAncestorChain(currentMission.parentMissionId);
        }

        return { valid: true };
      };

      // 직접 부모 미션의 승인 상태 확인
      const parentProgress = await db.query.userMissionProgress.findFirst({
        where: and(
          eq(userMissionProgress.userId, userId),
          eq(userMissionProgress.themeMissionId, mission.parentMissionId)
        )
      });

      // 부모 미션이 승인되지 않은 경우 접근 차단
      if (!parentProgress || parentProgress.status !== MISSION_STATUS.APPROVED) {
        const parentMission = await db.query.themeMissions.findFirst({
          where: eq(themeMissions.id, mission.parentMissionId)
        });

        return res.status(403).json({
          error: "이전 미션 승인 필요",
          message: `'${parentMission?.title || '이전 미션'}'을(를) 먼저 완료하고 승인을 받아야 이 미션에 접근할 수 있습니다.`,
          parentMissionId: parentMission?.missionId
        });
      }

      // 부모의 모든 조상 체인도 검증
      const parentMission = await db.query.themeMissions.findFirst({
        where: eq(themeMissions.id, mission.parentMissionId)
      });

      if (parentMission?.parentMissionId) {
        const ancestorResult = await validateAncestorChain(parentMission.parentMissionId);
        if (!ancestorResult.valid && ancestorResult.blockerMission) {
          return res.status(403).json({
            error: "상위 미션 승인 필요",
            message: `'${ancestorResult.blockerMission.title}'을(를) 먼저 완료하고 승인을 받아야 이 미션에 접근할 수 있습니다.`,
            parentMissionId: ancestorResult.blockerMission.missionId
          });
        }
      }

      // 깊이(depth) 기반 병렬 잠금해제:
      // - 2차 미션: 부모(1차) 승인만 필요 (위에서 이미 검증됨)
      // - 3차+ 미션: 부모의 모든 형제(같은 조부모의 자식들)가 승인되어야 접근 가능
      const parentMissionData = await db.query.themeMissions.findFirst({
        where: eq(themeMissions.id, mission.parentMissionId)
      });

      if (parentMissionData?.parentMissionId) {
        // 3차 이상 미션: 부모의 모든 형제가 승인되어야 함
        const parentSiblings = await db.query.themeMissions.findMany({
          where: and(
            eq(themeMissions.parentMissionId, parentMissionData.parentMissionId),
            eq(themeMissions.isActive, true)
          )
        });

        // 부모의 모든 형제 미션 승인 상태 확인
        for (const sibling of parentSiblings) {
          const siblingProgress = await db.query.userMissionProgress.findFirst({
            where: and(
              eq(userMissionProgress.userId, userId),
              eq(userMissionProgress.themeMissionId, sibling.id),
              eq(userMissionProgress.status, MISSION_STATUS.APPROVED)
            )
          });

          if (!siblingProgress) {
            return res.status(403).json({
              error: "상위 미션들 완료 필요",
              message: `모든 ${parentSiblings.length}개의 상위 미션을 완료해야 이 미션에 접근할 수 있습니다. '${sibling.title}'을(를) 먼저 완료해주세요.`,
              requiredMissionId: sibling.missionId
            });
          }
        }
      }
      // 2차 미션은 부모 승인만 필요 (위에서 이미 검증됨) - 형제 순서 검사 없음
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

    // 현재 미션이 승인되었는지 확인 (하부 미션 접근 가능 여부)
    const isCurrentMissionApproved = progress?.status === MISSION_STATUS.APPROVED;

    // 현재 미션의 깊이(depth) 계산 (1차 = 1, 2차 = 2, ...)
    let currentMissionDepth = 1;
    let ancestorId: number | null = mission.parentMissionId;

    while (ancestorId) {
      currentMissionDepth++;
      const ancestor = await db.select({ parentMissionId: themeMissions.parentMissionId })
        .from(themeMissions)
        .where(eq(themeMissions.id, ancestorId))
        .limit(1);

      ancestorId = ancestor[0]?.parentMissionId ?? null;
    }

    const childMissionDepth = currentMissionDepth + 1; // 하부 미션들의 깊이는 현재 + 1

    // 하부미션(2차, 3차...) 목록 조회
    const childMissions = await db.query.themeMissions.findMany({
      where: and(
        eq(themeMissions.parentMissionId, mission.id),
        eq(themeMissions.isActive, true)
      ),
      with: {
        category: true,
        subMissions: {
          where: eq(subMissions.isActive, true)
        }
      },
      orderBy: [asc(themeMissions.order), asc(themeMissions.id)]
    });

    // 각 하부미션의 진행 상황 및 잠금 상태 계산
    const childMissionsWithStatus = await Promise.all(
      childMissions.map(async (childMission, index) => {
        // 해당 하부미션의 사용자 진행 상황 조회
        const childProgress = await db.query.userMissionProgress.findFirst({
          where: and(
            eq(userMissionProgress.userId, userId),
            eq(userMissionProgress.themeMissionId, childMission.id)
          )
        });

        // 하부미션 제출 개수 조회
        const childSubmittedCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(subMissionSubmissions)
          .where(
            and(
              eq(subMissionSubmissions.userId, userId),
              sql`${subMissionSubmissions.subMissionId} IN (SELECT id FROM ${subMissions} WHERE ${subMissions.themeMissionId} = ${childMission.id})`
            )
          );

        const childTotalSubMissions = childMission.subMissions.length;
        const childCompletedSubMissions = childSubmittedCount[0]?.count || 0;
        const childProgressPercentage = childTotalSubMissions > 0
          ? Math.round((childCompletedSubMissions / childTotalSubMissions) * 100)
          : 0;

        // 깊이 기반 병렬 잠금해제:
        // - 모든 형제 미션은 부모가 승인되면 동시에 해제됨 (순서 상관없음)
        // - 3차+ 미션의 경우: 부모의 모든 형제(같은 조부모의 자식들)도 승인되어야 함
        let isUnlocked = isCurrentMissionApproved;

        // 3차+ 미션인 경우 (부모의 부모가 있는 경우), 부모의 모든 형제도 승인되어야 함
        if (isUnlocked && mission.parentMissionId) {
          const parentSiblings = await db.query.themeMissions.findMany({
            where: and(
              eq(themeMissions.parentMissionId, mission.parentMissionId),
              eq(themeMissions.isActive, true)
            )
          });

          // 부모의 모든 형제가 승인되어야 잠금 해제
          for (const sibling of parentSiblings) {
            const siblingProgress = await db.query.userMissionProgress.findFirst({
              where: and(
                eq(userMissionProgress.userId, userId),
                eq(userMissionProgress.themeMissionId, sibling.id),
                eq(userMissionProgress.status, MISSION_STATUS.APPROVED)
              )
            });
            if (!siblingProgress) {
              isUnlocked = false;
              break;
            }
          }
        }

        return {
          id: childMission.id,
          missionId: childMission.missionId,
          title: childMission.title,
          order: childMission.order,
          depth: childMissionDepth, // 모든 형제 미션은 같은 depth를 가짐
          status: childProgress?.status || MISSION_STATUS.NOT_STARTED,
          progressPercentage: childProgressPercentage,
          completedSubMissions: childCompletedSubMissions,
          totalSubMissions: childTotalSubMissions,
          isUnlocked,
          isApproved: childProgress?.status === MISSION_STATUS.APPROVED
        };
      })
    );

    // 부모 미션 정보 조회 (네비게이션용)
    let parentMissionInfo = null;
    let rootMissionInfo = null;

    if (mission.parentMissionId) {
      const parentMission = await db.query.themeMissions.findFirst({
        where: eq(themeMissions.id, mission.parentMissionId)
      });
      if (parentMission) {
        parentMissionInfo = {
          id: parentMission.id,
          missionId: parentMission.missionId,
          title: parentMission.title
        };
      }

      // 루트 미션(1차) 찾기: 부모를 따라 올라가기
      type AncestorRecord = { id: number; missionId: string; title: string; parentMissionId: number | null };
      let currentId: number | null = mission.parentMissionId;

      for (let depth = 0; depth < 10 && currentId !== null; depth++) {
        const ancestors: AncestorRecord[] = await db
          .select({
            id: themeMissions.id,
            missionId: themeMissions.missionId,
            title: themeMissions.title,
            parentMissionId: themeMissions.parentMissionId
          })
          .from(themeMissions)
          .where(eq(themeMissions.id, currentId))
          .limit(1);

        if (!ancestors.length) break;
        const foundAncestor = ancestors[0];
        rootMissionInfo = { id: foundAncestor.id, missionId: foundAncestor.missionId, title: foundAncestor.title };
        currentId = foundAncestor.parentMissionId;
      }
    }

    // 전체 미션 개수 계산
    const totalMissionCount = await countAllMissions(mission.id);

    // 1차 미션(루트)인 경우에만 전체 트리 구축
    let missionTree = null;
    if (!mission.parentMissionId) {
      missionTree = await buildMissionTree(mission.id, userId, 1);
    }

    // 현재 신청 인원 계산: '신청' 타입 세부미션의 제출 수
    // 선착순: APPROVED만 카운트 (승인된 인원만 표시)
    // 선정: SUBMITTED + APPROVED 모두 카운트 (신청자 전원 표시)
    let currentApplicants = 0;
    let waitlistCount = 0;
    const applicationSubMission = mission.subMissions.find(sm => sm.actionType?.name === '신청');
    if (applicationSubMission) {
      if (mission.isFirstCome) {
        // 선착순 방식: 승인된 인원만 카운트
        const approvedApplications = await db
          .select({ count: sql<number>`count(DISTINCT ${subMissionSubmissions.userId})::int` })
          .from(subMissionSubmissions)
          .where(
            and(
              eq(subMissionSubmissions.subMissionId, applicationSubMission.id),
              eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED)
            )
          );
        currentApplicants = approvedApplications[0]?.count || 0;

        // 대기 인원 카운트
        const waitlistApplications = await db
          .select({ count: sql<number>`count(DISTINCT ${subMissionSubmissions.userId})::int` })
          .from(subMissionSubmissions)
          .where(
            and(
              eq(subMissionSubmissions.subMissionId, applicationSubMission.id),
              eq(subMissionSubmissions.status, MISSION_STATUS.WAITLIST)
            )
          );
        waitlistCount = waitlistApplications[0]?.count || 0;
      } else {
        // 선정 방식: 제출된 신청자 + 승인된 인원 모두 카운트
        const allApplications = await db
          .select({ count: sql<number>`count(DISTINCT ${subMissionSubmissions.userId})::int` })
          .from(subMissionSubmissions)
          .where(
            and(
              eq(subMissionSubmissions.subMissionId, applicationSubMission.id),
              or(
                eq(subMissionSubmissions.status, MISSION_STATUS.SUBMITTED),
                eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED)
              )
            )
          );
        currentApplicants = allApplications[0]?.count || 0;
      }
    }

    res.json({
      ...mission,
      subMissions: subMissionsWithSubmissions,
      progress: progress || null,
      progressPercentage,
      completedSubMissions,
      totalSubMissions,
      isApprovedForChildAccess: isCurrentMissionApproved,
      childMissions: childMissionsWithStatus,
      parentMission: parentMissionInfo,
      rootMission: rootMissionInfo,
      totalMissionCount,
      missionTree,
      isRootMission: !mission.parentMissionId,
      currentApplicants,
      waitlistCount
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

        // 승인된 세부 미션 개수 조회 (approved 상태만 카운트)
        const approvedCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(subMissionSubmissions)
          .where(
            and(
              eq(subMissionSubmissions.userId, userId),
              eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED),
              sql`${subMissionSubmissions.subMissionId} IN (SELECT id FROM ${subMissions} WHERE ${subMissions.themeMissionId} = ${mission.id})`
            )
          );

        const totalSubMissions = mission.subMissions.length;
        const completedSubMissions = approvedCount[0]?.count || 0;
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

    // 세부 미션 조회 (액션타입 포함)
    const subMission = await db.query.subMissions.findFirst({
      where: and(
        eq(subMissions.id, parseInt(subMissionId)),
        eq(subMissions.themeMissionId, mission.id)
      ),
      with: {
        actionType: true
      }
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

    // 기존 제출 확인 (중복 제출 방지) - CANCELLED 상태는 제외 (재신청 허용)
    const existingSubmission = await db.query.subMissionSubmissions.findFirst({
      where: and(
        eq(subMissionSubmissions.userId, userId),
        eq(subMissionSubmissions.subMissionId, subMission.id),
        not(eq(subMissionSubmissions.status, MISSION_STATUS.CANCELLED))
      )
    });

    // 승인된 제출은 수정 불가 (영구 잠금)
    if (existingSubmission?.isLocked) {
      return res.status(403).json({
        error: "승인된 세부 미션은 수정할 수 없습니다",
        submission: existingSubmission
      });
    }

    // 신청 타입 세부미션인지 확인 (선착순/선정 로직 적용)
    const isApplicationType = subMission.actionType?.name === '신청';

    // 기본 상태 결정 로직
    let submissionStatus: string = MISSION_STATUS.SUBMITTED;
    let shouldLock = false;

    if (isApplicationType && mission.capacity) {
      // 신청 타입이고 모집인원이 설정된 경우
      if (mission.isFirstCome) {
        // 선착순 방식: 우선 SUBMITTED로 저장 후 트랜잭션에서 확인
        submissionStatus = MISSION_STATUS.SUBMITTED;
        shouldLock = false;
      } else {
        // 선정 방식: 제출 상태로 저장 (관리자가 수동 승인)
        submissionStatus = MISSION_STATUS.SUBMITTED;
        shouldLock = false;
      }
    } else {
      // 일반 세부미션: 기존 로직 유지
      const autoApprove = subMission.requireReview === false;
      submissionStatus = autoApprove ? MISSION_STATUS.APPROVED : MISSION_STATUS.SUBMITTED;
      shouldLock = autoApprove;
    }

    // 새로운 제출 또는 업데이트
    let resultSubmission;
    if (existingSubmission) {
      // 기존 제출 업데이트
      const [updatedSubmission] = await db
        .update(subMissionSubmissions)
        .set({
          submissionData,
          status: submissionStatus,
          isLocked: shouldLock,
          submittedAt: new Date(),
          reviewedAt: shouldLock ? new Date() : undefined,
          updatedAt: new Date()
        })
        .where(eq(subMissionSubmissions.id, existingSubmission.id))
        .returning();

      resultSubmission = updatedSubmission;
    } else {
      // 새로운 제출
      const [newSubmission] = await db
        .insert(subMissionSubmissions)
        .values({
          userId,
          subMissionId: subMission.id,
          submissionData,
          status: submissionStatus,
          isLocked: shouldLock,
          submittedAt: new Date(),
          reviewedAt: shouldLock ? new Date() : undefined
        })
        .returning();

      resultSubmission = newSubmission;
    }

    // 선착순 방식: advisory lock으로 동시성 제어
    if (isApplicationType && mission.capacity && mission.isFirstCome) {
      // PostgreSQL advisory lock 사용 (subMission.id 기반)
      // pg_advisory_xact_lock은 트랜잭션 종료 시 자동 해제됨
      const lockKey = subMission.id; // 세부미션 ID를 잠금 키로 사용

      // 잠금 획득 → 카운트 확인 → 업데이트 → 잠금 해제 (단일 트랜잭션)
      const updateResult = await db.execute(sql`
        WITH lock_acquired AS (
          SELECT pg_advisory_xact_lock(${lockKey})
        ),
        current_count AS (
          SELECT COUNT(DISTINCT user_id) as cnt
          FROM ${subMissionSubmissions}
          WHERE sub_mission_id = ${subMission.id}
          AND status = ${MISSION_STATUS.APPROVED}
        )
        UPDATE ${subMissionSubmissions}
        SET 
          status = CASE 
            WHEN (SELECT cnt FROM current_count) < ${mission.capacity}
            THEN ${MISSION_STATUS.APPROVED}
            ELSE ${MISSION_STATUS.WAITLIST}
          END,
          is_locked = CASE 
            WHEN (SELECT cnt FROM current_count) < ${mission.capacity}
            THEN true
            ELSE false
          END,
          reviewed_at = CASE 
            WHEN (SELECT cnt FROM current_count) < ${mission.capacity}
            THEN NOW()
            ELSE reviewed_at
          END,
          updated_at = NOW()
        WHERE id = ${resultSubmission.id}
        RETURNING *
      `);

      const finalSubmission = updateResult.rows[0];
      return res.status(existingSubmission ? 200 : 201).json(finalSubmission);
    }

    res.status(existingSubmission ? 200 : 201).json(resultSubmission);
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

// 신청 세부미션 취소 (신청 타입 전용 - 이력 보존)
router.post("/missions/:missionId/sub-missions/:subMissionId/cancel-application", requireAuth, async (req, res) => {
  try {
    const { missionId, subMissionId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    // 세부미션 조회 (신청 타입인지 확인)
    const subMission = await db.query.subMissions.findFirst({
      where: eq(subMissions.id, parseInt(subMissionId)),
      with: {
        actionType: true,
        themeMission: true
      }
    });

    if (!subMission) {
      return res.status(404).json({ error: "세부 미션을 찾을 수 없습니다" });
    }

    // 신청 타입인지 확인
    if (subMission.actionType?.name !== '신청') {
      return res.status(400).json({ error: "신청 타입 세부미션만 취소할 수 있습니다" });
    }

    // 제출 조회 (CANCELLED 상태가 아닌 것)
    const submission = await db.query.subMissionSubmissions.findFirst({
      where: and(
        eq(subMissionSubmissions.userId, userId),
        eq(subMissionSubmissions.subMissionId, parseInt(subMissionId)),
        not(eq(subMissionSubmissions.status, MISSION_STATUS.CANCELLED))
      )
    });

    if (!submission) {
      return res.status(404).json({ error: "신청 내역을 찾을 수 없습니다" });
    }

    const previousStatus = submission.status;

    // 상태를 CANCELLED로 변경 (이력 보존)
    const [cancelledSubmission] = await db
      .update(subMissionSubmissions)
      .set({
        status: MISSION_STATUS.CANCELLED,
        isLocked: false,
        reviewedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(subMissionSubmissions.id, submission.id))
      .returning();

    // 선착순 모드이고, 취소한 사람이 APPROVED 상태였으면 대기자 자동 승인
    if (subMission.themeMission?.isFirstCome && previousStatus === MISSION_STATUS.APPROVED) {
      // 대기 중인 사람 중 가장 먼저 제출한 사람 찾기
      const waitlistSubmission = await db.query.subMissionSubmissions.findFirst({
        where: and(
          eq(subMissionSubmissions.subMissionId, parseInt(subMissionId)),
          eq(subMissionSubmissions.status, MISSION_STATUS.WAITLIST)
        ),
        orderBy: asc(subMissionSubmissions.submittedAt)
      });

      if (waitlistSubmission) {
        // 대기자를 승인 상태로 변경
        await db
          .update(subMissionSubmissions)
          .set({
            status: MISSION_STATUS.APPROVED,
            isLocked: true,
            reviewedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(subMissionSubmissions.id, waitlistSubmission.id));

        console.log(`✅ [신청 취소] 대기자 ${waitlistSubmission.userId} 자동 승인`);
      }
    }

    res.json({
      message: "신청이 취소되었습니다. 다시 신청하실 수 있습니다.",
      submission: cancelledSubmission
    });
  } catch (error) {
    console.error("Error canceling application:", error);
    res.status(500).json({ error: "신청 취소 실패" });
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
            waitlist: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.WAITLIST} THEN 1 END)::int`,
            cancelled: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.CANCELLED} THEN 1 END)::int`,
            total: sql<number>`COUNT(*)::int`
          })
          .from(subMissionSubmissions)
          .where(inArray(subMissionSubmissions.subMissionId, subMissionIds));

        return {
          ...mission,
          stats: statsResult[0] || { pending: 0, approved: 0, rejected: 0, waitlist: 0, cancelled: 0, total: 0 }
        };
      })
    );

    // 계층 구조 구성 (서버에서 처리)
    // 필터링된 미션들 사이에서 부모-자식 관계를 구성
    // 부모가 필터링으로 제외되었지만 자식은 포함된 경우, 자식을 루트로 승격
    const missionMap = new Map<number, any>();
    const rootMissions: any[] = [];
    const includedMissionIds = new Set(missionsWithStats.map(m => m.id));

    // 먼저 모든 미션을 맵에 저장
    for (const mission of missionsWithStats) {
      missionMap.set(mission.id, {
        ...mission,
        childMissions: []
      });
    }

    // 부모-자식 관계 연결 또는 루트로 승격
    for (const mission of missionsWithStats) {
      const missionWithChildren = missionMap.get(mission.id)!;

      if (mission.parentMissionId) {
        // 부모가 현재 결과에 포함되어 있는지 확인
        if (includedMissionIds.has(mission.parentMissionId)) {
          const parent = missionMap.get(mission.parentMissionId);
          if (parent) {
            parent.childMissions.push(missionWithChildren);
          }
        } else {
          // 부모가 필터링으로 제외된 경우 루트로 처리 (orphan 승격)
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

    // 세부미션 조회 (actionType 포함)
    const subMissionsList = await db.query.subMissions.findMany({
      where: eq(subMissions.themeMissionId, mission.id),
      orderBy: [asc(subMissions.order)],
      with: {
        actionType: true
      }
    });

    // 각 세부미션별 제출 통계 계산
    const subMissionsWithStats = await Promise.all(
      subMissionsList.map(async (subMission) => {
        const statsResult = await db
          .select({
            pending: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.SUBMITTED} THEN 1 END)::int`,
            approved: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.APPROVED} THEN 1 END)::int`,
            rejected: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.REJECTED} THEN 1 END)::int`,
            waitlist: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.WAITLIST} THEN 1 END)::int`,
            cancelled: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.CANCELLED} THEN 1 END)::int`,
            total: sql<number>`COUNT(*)::int`
          })
          .from(subMissionSubmissions)
          .where(eq(subMissionSubmissions.subMissionId, subMission.id));

        return {
          ...subMission,
          stats: statsResult[0] || { pending: 0, approved: 0, rejected: 0, waitlist: 0, cancelled: 0, total: 0 }
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

    // 제출 조회 (세부 미션 정보 포함)
    const submission = await db.query.subMissionSubmissions.findFirst({
      where: eq(subMissionSubmissions.id, submissionId),
      with: {
        subMission: true
      }
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

    // 주제 미션의 모든 세부 미션이 승인되었는지 확인하고 업데이트
    const themeMissionId = submission.subMission.themeMissionId;
    const userId = submission.userId;

    // 해당 주제 미션의 모든 활성 세부 미션 조회
    const allSubMissions = await db.query.subMissions.findMany({
      where: and(
        eq(subMissions.themeMissionId, themeMissionId),
        eq(subMissions.isActive, true)
      )
    });

    // 각 세부 미션의 승인 상태 확인
    const allApproved = await Promise.all(
      allSubMissions.map(async (sm) => {
        const smSubmission = await db.query.subMissionSubmissions.findFirst({
          where: and(
            eq(subMissionSubmissions.subMissionId, sm.id),
            eq(subMissionSubmissions.userId, userId),
            eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED)
          )
        });
        return !!smSubmission;
      })
    );

    const allSubMissionsApproved = allApproved.every(Boolean);

    // 모든 세부 미션이 승인되면 주제 미션도 승인 상태로 업데이트
    if (allSubMissionsApproved && allSubMissions.length > 0) {
      // 기존 진행 상황 조회
      const existingProgress = await db.query.userMissionProgress.findFirst({
        where: and(
          eq(userMissionProgress.userId, userId),
          eq(userMissionProgress.themeMissionId, themeMissionId)
        )
      });

      if (existingProgress) {
        // 기존 진행 상황 업데이트
        await db
          .update(userMissionProgress)
          .set({
            status: MISSION_STATUS.APPROVED,
            updatedAt: new Date()
          })
          .where(eq(userMissionProgress.id, existingProgress.id));
      } else {
        // 새로운 진행 상황 생성
        await db.insert(userMissionProgress).values({
          userId: userId,
          themeMissionId: themeMissionId,
          status: MISSION_STATUS.APPROVED,
          startedAt: new Date()
        } as any);
      }
    }

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
    const { hospitalId, missionId } = req.query;

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

    // 특정 주제미션 필터링 (주제미션 상세 뷰에서 해당 미션 통계만 조회)
    let missionFilterSql = sql``;
    if (missionId) {
      const filterMissionId = parseInt(missionId as string, 10);
      if (!isNaN(filterMissionId)) {
        missionFilterSql = sql`AND tm.id = ${filterMissionId}`;
      }
    }

    const stats = await db.execute(sql`
      SELECT
        COUNT(CASE WHEN sms.status = ${MISSION_STATUS.SUBMITTED} THEN 1 END)::int as pending,
        COUNT(CASE WHEN sms.status = ${MISSION_STATUS.APPROVED} THEN 1 END)::int as approved,
        COUNT(CASE WHEN sms.status = ${MISSION_STATUS.REJECTED} THEN 1 END)::int as rejected,
        COUNT(CASE WHEN sms.status = ${MISSION_STATUS.WAITLIST} THEN 1 END)::int as waitlist,
        COUNT(CASE WHEN sms.status = ${MISSION_STATUS.CANCELLED} THEN 1 END)::int as cancelled,
        COUNT(*)::int as total
      FROM ${subMissionSubmissions} sms
      JOIN ${subMissions} sm ON sms.sub_mission_id = sm.id
      JOIN ${themeMissions} tm ON sm.theme_mission_id = tm.id
      WHERE 1=1 ${hospitalFilterSql} ${missionFilterSql}
    `);

    res.json(stats.rows[0] || { pending: 0, approved: 0, rejected: 0, waitlist: 0, cancelled: 0, total: 0 });
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

// 미션 파일 업로드 (제작소 제출용 - PDF, JPEG, WEBP 지원)
router.post("/missions/upload-pdf", requireAuth, missionFileUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "파일이 업로드되지 않았습니다" });
    }

    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "사용자 인증 정보가 없습니다" });
    }

    // 허용된 파일 형식 검증 (PDF, JPEG, WEBP)
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/webp'
    ];

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: "PDF, JPEG, WEBP 파일만 업로드 가능합니다" });
    }

    // 파일 크기 검증 (50MB)
    const maxSize = 50 * 1024 * 1024;
    if (req.file.size > maxSize) {
      return res.status(400).json({ error: "파일 크기는 50MB 이하여야 합니다" });
    }

    // 파일 형식에 따른 폴더 결정
    const isImage = req.file.mimetype.startsWith('image/');
    const folder = isImage ? 'mission-images' : 'mission-pdfs';
    const contentType = req.file.mimetype;

    console.log(`📤 [미션 파일 업로드] 사용자 ${userId} - 파일명: ${req.file.originalname}, 형식: ${contentType}`);

    const result = await saveFileToGCS(
      req.file.buffer,
      userId,
      folder,
      req.file.originalname || 'submission',
      contentType
    );

    console.log(`✅ [미션 파일 업로드] GCS 저장 완료: ${result.originalUrl}`);

    res.json({
      success: true,
      pdfUrl: result.originalUrl,
      gsPath: result.gsPath,
      fileName: result.fileName
    });

  } catch (error) {
    console.error("❌ [미션 파일 업로드] 오류:", error);
    res.status(500).json({
      error: "파일 업로드 실패",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// ============================================
// 액션 타입 관리 API
// ============================================

// 모든 액션 타입 조회 (관리자용)
router.get("/action-types", requireAuth, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const allTypes = await db.query.actionTypes.findMany({
      orderBy: asc(actionTypes.order)
    });
    res.json(allTypes);
  } catch (error) {
    console.error("❌ [액션 타입 조회] 오류:", error);
    res.status(500).json({ error: "액션 타입 조회 실패" });
  }
});

// 활성화된 액션 타입만 조회 (미션 생성/수정 시 사용)
router.get("/action-types/active", requireAuth, async (req, res) => {
  try {
    const activeTypes = await db.query.actionTypes.findMany({
      where: eq(actionTypes.isActive, true),
      orderBy: asc(actionTypes.order)
    });
    res.json(activeTypes);
  } catch (error) {
    console.error("❌ [액션 타입 조회] 오류:", error);
    res.status(500).json({ error: "액션 타입 조회 실패" });
  }
});

// 액션 타입 생성 (관리자용)
router.post("/action-types", requireAuth, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const parsed = actionTypesInsertSchema.parse(req.body);

    // 다음 순서 번호 조회
    const lastType = await db.query.actionTypes.findFirst({
      orderBy: desc(actionTypes.order)
    });
    const nextOrder = (lastType?.order || 0) + 1;

    const [newType] = await db.insert(actionTypes).values({
      ...parsed,
      order: nextOrder,
      isSystem: false
    }).returning();

    res.status(201).json(newType);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error("❌ [액션 타입 생성] 오류:", error);
    res.status(500).json({ error: "액션 타입 생성 실패" });
  }
});

// 액션 타입 수정 (관리자용)
router.patch("/action-types/:id", requireAuth, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const typeId = parseInt(req.params.id);

    const existing = await db.query.actionTypes.findFirst({
      where: eq(actionTypes.id, typeId)
    });

    if (!existing) {
      return res.status(404).json({ error: "액션 타입을 찾을 수 없습니다" });
    }

    // 시스템 타입은 이름만 수정 불가
    if (existing.isSystem && req.body.name && req.body.name !== existing.name) {
      return res.status(400).json({ error: "시스템 기본 액션 타입의 이름은 변경할 수 없습니다" });
    }

    const [updated] = await db.update(actionTypes)
      .set({
        ...req.body,
        updatedAt: new Date()
      })
      .where(eq(actionTypes.id, typeId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error("❌ [액션 타입 수정] 오류:", error);
    res.status(500).json({ error: "액션 타입 수정 실패" });
  }
});

// 액션 타입 삭제 (관리자용)
router.delete("/action-types/:id", requireAuth, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const typeId = parseInt(req.params.id);

    const existing = await db.query.actionTypes.findFirst({
      where: eq(actionTypes.id, typeId)
    });

    if (!existing) {
      return res.status(404).json({ error: "액션 타입을 찾을 수 없습니다" });
    }

    // 시스템 타입은 삭제 불가
    if (existing.isSystem) {
      return res.status(400).json({ error: "시스템 기본 액션 타입은 삭제할 수 없습니다" });
    }

    // 사용 중인지 확인
    const usedInMissions = await db.query.subMissions.findFirst({
      where: eq(subMissions.actionTypeId, typeId)
    });

    if (usedInMissions) {
      return res.status(400).json({ error: "사용 중인 액션 타입은 삭제할 수 없습니다" });
    }

    await db.delete(actionTypes).where(eq(actionTypes.id, typeId));

    res.json({ success: true });
  } catch (error) {
    console.error("❌ [액션 타입 삭제] 오류:", error);
    res.status(500).json({ error: "액션 타입 삭제 실패" });
  }
});

// 액션 타입 순서 변경 (관리자용)
router.post("/action-types/reorder", requireAuth, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const { orderedIds } = req.body as { orderedIds: number[] };

    if (!orderedIds || !Array.isArray(orderedIds)) {
      return res.status(400).json({ error: "orderedIds 배열이 필요합니다" });
    }

    // 트랜잭션으로 순서 업데이트
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(actionTypes)
        .set({ order: i + 1, updatedAt: new Date() })
        .where(eq(actionTypes.id, orderedIds[i]));
    }

    const updated = await db.query.actionTypes.findMany({
      orderBy: asc(actionTypes.order)
    });

    res.json(updated);
  } catch (error) {
    console.error("❌ [액션 타입 순서 변경] 오류:", error);
    res.status(500).json({ error: "액션 타입 순서 변경 실패" });
  }
});

// ============================================
// 출석 인증 API
// ============================================

// 출석 비밀번호 확인 (사용자용)
router.post("/sub-missions/:id/verify-attendance", requireAuth, async (req, res) => {
  try {
    const subMissionId = parseInt(req.params.id);
    const { password } = req.body;
    const userId = (req as any).user.id;

    const subMission = await db.query.subMissions.findFirst({
      where: eq(subMissions.id, subMissionId),
      with: {
        actionType: true
      }
    });

    if (!subMission) {
      return res.status(404).json({ error: "세부 미션을 찾을 수 없습니다" });
    }

    // 출석인증 제출 타입인지 확인
    const submissionTypes = subMission.submissionTypes || [];
    if (!submissionTypes.includes('attendance')) {
      return res.status(400).json({ error: "출석인증 제출 타입이 아닙니다" });
    }

    // 비밀번호 확인
    if (subMission.attendancePassword !== password) {
      return res.status(400).json({ error: "비밀번호가 일치하지 않습니다" });
    }

    // 출석 제출 생성 또는 업데이트
    const existing = await db.query.subMissionSubmissions.findFirst({
      where: and(
        eq(subMissionSubmissions.userId, userId),
        eq(subMissionSubmissions.subMissionId, subMissionId)
      )
    });

    if (existing) {
      // 이미 제출이 있으면 상태 업데이트
      await db.update(subMissionSubmissions)
        .set({
          status: MISSION_STATUS.APPROVED,
          isLocked: true,
          reviewedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(subMissionSubmissions.id, existing.id));
    } else {
      // 새 제출 생성 (자동 승인)
      await db.insert(subMissionSubmissions).values({
        userId,
        subMissionId,
        status: MISSION_STATUS.APPROVED,
        isLocked: true,
        reviewedAt: new Date()
      });
    }

    res.json({ success: true, message: "출석이 확인되었습니다" });
  } catch (error) {
    console.error("❌ [출석 인증] 오류:", error);
    res.status(500).json({ error: "출석 인증 실패" });
  }
});

// 신청 현황 조회 (미션 상세에서 사용)
router.get("/theme-missions/:id/application-status", async (req, res) => {
  try {
    const missionId = parseInt(req.params.id);

    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.id, missionId),
      with: {
        subMissions: {
          with: {
            actionType: true
          }
        }
      }
    });

    if (!mission) {
      return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
    }

    // 신청 타입 세부미션 찾기
    const applicationSubMission = mission.subMissions.find(sm =>
      sm.actionType?.name === '신청'
    );

    if (!applicationSubMission) {
      return res.json({
        capacity: mission.capacity || null,
        currentCount: 0,
        isFirstCome: mission.isFirstCome || false,
        hasApplication: false
      });
    }

    // 승인된 신청 수 계산
    const approvedCount = await db.select({ count: sql<number>`count(*)` })
      .from(subMissionSubmissions)
      .where(and(
        eq(subMissionSubmissions.subMissionId, applicationSubMission.id),
        eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED)
      ));

    res.json({
      capacity: mission.capacity || null,
      currentCount: Number(approvedCount[0]?.count || 0),
      isFirstCome: mission.isFirstCome || false,
      hasApplication: true
    });
  } catch (error) {
    console.error("❌ [신청 현황 조회] 오류:", error);
    res.status(500).json({ error: "신청 현황 조회 실패" });
  }
});

// ==========================================
// 📁 미션 폴더 관리 API (관리자용)
// ==========================================

// 폴더 목록 조회
router.get("/admin/mission-folders", requireAdminOrSuperAdmin, async (_req, res) => {
  try {
    const folders = await db.query.missionFolders.findMany({
      orderBy: [asc(missionFolders.order), asc(missionFolders.id)],
      with: {
        themeMissions: {
          where: and(
            eq(themeMissions.isActive, true),
            sql`${themeMissions.parentMissionId} IS NULL`
          ),
          orderBy: [asc(themeMissions.order)]
        }
      }
    });
    res.json(folders);
  } catch (error) {
    console.error("폴더 목록 조회 오류:", error);
    res.status(500).json({ error: "폴더 목록 조회 실패" });
  }
});

// 폴더 생성
router.post("/admin/mission-folders", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const data = missionFoldersInsertSchema.parse(req.body);

    // 최대 order 값 조회
    const maxOrderResult = await db.select({ maxOrder: sql<number>`COALESCE(MAX("order"), 0)` })
      .from(missionFolders);
    const newOrder = (maxOrderResult[0]?.maxOrder || 0) + 1;

    const [folder] = await db.insert(missionFolders)
      .values({ ...data, order: newOrder })
      .returning();

    res.status(201).json(folder);
  } catch (error) {
    console.error("폴더 생성 오류:", error);
    res.status(500).json({ error: "폴더 생성 실패" });
  }
});

// 폴더 순서 업데이트 (/:id 라우트보다 먼저 등록해야 "reorder"가 :id로 매칭되지 않음)
const folderReorderSchema = z.object({
  folderIds: z.array(z.number().int().positive())
});

router.put("/admin/mission-folders/reorder", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const parseResult = folderReorderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "잘못된 요청 형식입니다", details: parseResult.error.errors });
    }
    const { folderIds } = parseResult.data;

    for (let i = 0; i < folderIds.length; i++) {
      await db.update(missionFolders)
        .set({ order: i, updatedAt: new Date() })
        .where(eq(missionFolders.id, folderIds[i]));
    }

    res.json({ success: true });
  } catch (error) {
    console.error("폴더 순서 업데이트 오류:", error);
    res.status(500).json({ error: "폴더 순서 업데이트 실패" });
  }
});

// 폴더 수정
router.put("/admin/mission-folders/:id", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const folderId = parseInt(req.params.id);
    const { name, color, isCollapsed } = req.body;

    const [updated] = await db.update(missionFolders)
      .set({
        name,
        color,
        isCollapsed,
        updatedAt: new Date()
      })
      .where(eq(missionFolders.id, folderId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "폴더를 찾을 수 없습니다" });
    }

    res.json(updated);
  } catch (error) {
    console.error("폴더 수정 오류:", error);
    res.status(500).json({ error: "폴더 수정 실패" });
  }
});

// 폴더 삭제 (폴더 내 미션은 폴더 해제)
router.delete("/admin/mission-folders/:id", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const folderId = parseInt(req.params.id);

    // 폴더 내 미션의 folderId를 null로 설정
    await db.update(themeMissions)
      .set({ folderId: null })
      .where(eq(themeMissions.folderId, folderId));

    // 폴더 삭제
    await db.delete(missionFolders)
      .where(eq(missionFolders.id, folderId));

    res.json({ success: true });
  } catch (error) {
    console.error("폴더 삭제 오류:", error);
    res.status(500).json({ error: "폴더 삭제 실패" });
  }
});


// 미션 폴더 이동
router.put("/admin/missions/:id/folder", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const missionId = parseInt(req.params.id);
    const { folderId } = req.body as { folderId: number | null };

    const [updated] = await db.update(themeMissions)
      .set({ folderId, updatedAt: new Date() })
      .where(eq(themeMissions.id, missionId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
    }

    res.json(updated);
  } catch (error) {
    console.error("미션 폴더 이동 오류:", error);
    res.status(500).json({ error: "미션 폴더 이동 실패" });
  }
});

// 미션 신청 정보 엑셀 다운로드
const exportMissionIdSchema = z.object({
  missionId: z.string().min(1, "missionId가 필요합니다")
});

router.get("/admin/missions/:missionId/export-excel", requireAdminOrSuperAdmin, async (req, res) => {
  try {
    // Zod 파라미터 검증
    const parseResult = exportMissionIdSchema.safeParse(req.params);
    if (!parseResult.success) {
      return res.status(400).json({ error: "잘못된 요청입니다", details: parseResult.error.errors });
    }
    const { missionId } = parseResult.data;

    // 주제미션 조회
    const themeMission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.missionId, missionId)
    });

    if (!themeMission) {
      return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
    }

    // 해당 주제미션의 세부미션 목록 조회 (제출 데이터 포함 - 단일 쿼리로 N+1 해결)
    const subMissionList = await db.query.subMissions.findMany({
      where: eq(subMissions.themeMissionId, themeMission.id),
      orderBy: asc(subMissions.order),
      with: {
        submissions: {
          with: {
            user: true
          },
          orderBy: desc(subMissionSubmissions.submittedAt)
        }
      }
    });

    if (subMissionList.length === 0) {
      return res.status(400).json({ error: "세부미션이 없습니다" });
    }

    const workbook = XLSX.utils.book_new();
    const usedSheetNames = new Set<string>();

    for (const subMission of subMissionList) {
      // 이미 with로 가져온 submissions 사용
      const submissions = subMission.submissions || [];

      // 상태 레이블 변환 함수
      const getStatusLabel = (status: string) => {
        const statusMap: Record<string, string> = {
          submitted: "검수 대기",
          approved: "승인",
          rejected: "보류",
          pending: "대기",
          waitlist: "대기자",
          cancelled: "취소"
        };
        return statusMap[status] || status;
      };

      // 제출 내용을 문자열로 변환하는 함수
      const formatSubmissionData = (data: any): string => {
        if (!data) return "";

        const parts: string[] = [];

        // 슬롯 배열 처리
        if (data.slots && Array.isArray(data.slots)) {
          data.slots.forEach((slot: any, index: number) => {
            const slotParts: string[] = [];
            if (slot.imageUrl) slotParts.push(`이미지: ${slot.imageUrl}`);
            if (slot.fileUrl) slotParts.push(`파일: ${slot.fileUrl}`);
            if (slot.linkUrl) slotParts.push(`링크: ${slot.linkUrl}`);
            if (slot.textContent) slotParts.push(`텍스트: ${slot.textContent}`);
            if (slot.rating !== undefined && slot.rating !== null) slotParts.push(`별점: ${slot.rating}/5`);
            if (slot.memo) slotParts.push(`메모: ${slot.memo}`);
            if (slotParts.length > 0) {
              parts.push(`[슬롯${index + 1}] ${slotParts.join(", ")}`);
            }
          });
        }

        // 레거시 단일 데이터 처리
        if (data.imageUrl) parts.push(`이미지: ${data.imageUrl}`);
        if (data.fileUrl) parts.push(`파일: ${data.fileUrl}`);
        if (data.linkUrl) parts.push(`링크: ${data.linkUrl}`);
        if (data.textContent) parts.push(`텍스트: ${data.textContent}`);
        if (data.rating !== undefined && data.rating !== null) parts.push(`별점: ${data.rating}/5`);
        if (data.memo) parts.push(`메모: ${data.memo}`);

        // 제작소 제출
        if (data.studioProjectId) {
          parts.push(`제작소 프로젝트ID: ${data.studioProjectId}`);
          if (data.studioProjectTitle) parts.push(`제작소 작업물: ${data.studioProjectTitle}`);
        }

        // 신청 정보 (선착순/선정 미션)
        if (data.registrationName) parts.push(`신청자명: ${data.registrationName}`);
        if (data.registrationPhone) parts.push(`신청연락처: ${data.registrationPhone}`);

        return parts.join("\n");
      };

      // 날짜 포맷 함수 (한국 시간대)
      const formatDateTime = (date: Date | string | null): string => {
        if (!date) return "";
        const d = new Date(date);
        return d.toLocaleString("ko-KR", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        });
      };

      // 시트 데이터 생성
      const sheetData = [
        ["사용자명", "닉네임", "전화번호", "제출일시", "상태", "제출내용"]
      ];

      for (const submission of submissions) {
        const user = submission.user;
        const submissionData = submission.submissionData as any;

        sheetData.push([
          user?.fullName || "-",
          user?.username || "-",
          user?.phoneNumber || "-",
          formatDateTime(submission.submittedAt),
          getStatusLabel(submission.status),
          formatSubmissionData(submissionData)
        ]);
      }

      // 시트 생성 및 추가
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

      // 컬럼 너비 설정
      worksheet["!cols"] = [
        { wch: 15 },  // 사용자명
        { wch: 15 },  // 닉네임
        { wch: 15 },  // 전화번호
        { wch: 20 },  // 제출일시
        { wch: 12 },  // 상태
        { wch: 60 }   // 제출내용
      ];

      // 시트 이름 (최대 31자, 특수문자 제거, 중복 방지)
      let baseSheetName = subMission.title
        .replace(/[\\/*?:\[\]]/g, "")
        .slice(0, 31);

      let sheetName = baseSheetName;
      let counter = 2;

      // 중복 시트 이름 방지
      while (usedSheetNames.has(sheetName)) {
        const suffix = ` (${counter})`;
        sheetName = baseSheetName.slice(0, 31 - suffix.length) + suffix;
        counter++;
      }
      usedSheetNames.add(sheetName);

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    // 엑셀 파일 생성
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // 파일명 생성 (한국 시간)
    const now = new Date();
    const dateStr = now.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).replace(/\. /g, "-").replace(/\./g, "");

    const fileName = encodeURIComponent(`${themeMission.title}_${dateStr}.xlsx`);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${fileName}`);
    res.send(buffer);

  } catch (error) {
    console.error("엑셀 내보내기 오류:", error);
    res.status(500).json({ error: "엑셀 내보내기 실패" });
  }
});

export default router;
