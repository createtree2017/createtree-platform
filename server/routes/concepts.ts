import { Router } from "express";
import { db } from "../../db";
import {
  concepts,
  personas,
  conceptCategories,
  abTests,
  abTestVariants,
  hospitalMembers,
} from "../../shared/schema";
import { eq, and, or, asc } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { getSystemSettings } from "../utils/settings";

const router = Router();

// API to increment usage count for a persona (for recommendation engine)
router.post("/api/personas/:id/use", async (req, res) => {
  try {
    const personaId = req.params.id;

    // Check if persona exists
    const existingPersona = await db.query.personas.findFirst({
      where: eq(personas.personaId, personaId)
    });

    if (!existingPersona) {
      return res.status(404).json({ error: "Persona not found" });
    }

    // Increment use count
    const [updatedPersona] = await db.update(personas)
      .set({
        useCount: (existingPersona.useCount || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(personas.personaId, personaId))
      .returning();

    return res.json({ success: true, useCount: updatedPersona.useCount });
  } catch (error) {
    console.error("Error incrementing persona use count:", error);
    return res.status(500).json({ error: "Failed to increment persona use count" });
  }
});

// API to recommend personas based on various factors
router.get("/api/personas/recommend", async (req, res) => {
  try {
    // Get query parameters
    const timeOfDay = req.query.timeOfDay as string ||
                      (() => {
                        const hour = new Date().getHours();
                        if (hour >= 5 && hour < 12) return "morning";
                        if (hour >= 12 && hour < 17) return "afternoon";
                        if (hour >= 17 && hour < 21) return "evening";
                        return "night";
                      })();

    // Get emotion keywords from query if provided
    const emotions = req.query.emotions
                    ? (req.query.emotions as string).split(',')
                    : [];

    // Get all active personas
    const allPersonas = await db.query.personas.findMany({
      where: eq(personas.isActive, true)
    });

    // Score each persona based on recommendation factors
    const scoredPersonas = allPersonas.map(persona => {
      let score = 0;

      // Factor 1: Time of day match
      if (persona.timeOfDay === timeOfDay || persona.timeOfDay === "all") {
        score += 10;
      }

      // Factor 2: Emotional keyword match
      const personaEmotions = persona.emotionalKeywords as string[] || [];
      emotions.forEach(emotion => {
        if (personaEmotions.includes(emotion)) {
          score += 5;
        }
      });

      // Factor 3: Featured status
      if (persona.isFeatured) {
        score += 15;
      }

      // Factor 4: Popularity (use count)
      score += Math.min(persona.useCount || 0, 50) / 5;

      return { persona, score };
    });

    // Sort by score (descending) and return top results
    scoredPersonas.sort((a, b) => b.score - a.score);

    // Return top recommendations with scores
    return res.json({
      timeOfDay,
      emotions,
      recommendations: scoredPersonas.slice(0, 5).map(({ persona, score }) => ({
        id: persona.personaId,
        name: persona.name,
        avatarEmoji: persona.avatarEmoji,
        description: persona.description,
        score: Math.round(score),
        categories: persona.categories as string[] || [],
      }))
    });
  } catch (error) {
    console.error("Error getting persona recommendations:", error);
    return res.status(500).json({ error: "Failed to get persona recommendations" });
  }
});

// Get all active concept categories (public endpoint)
router.get("/api/concept-categories", async (req, res) => {
  try {
    const activeCategories = await db.select().from(conceptCategories)
      .where(eq(conceptCategories.isActive, true))
      .orderBy(asc(conceptCategories.order));
    return res.json(activeCategories);
  } catch (error) {
    console.error("Error fetching public concept categories:", error);
    return res.status(500).json({ error: "Failed to fetch concept categories" });
  }
});

// Get model capabilities - Public endpoint (no auth required)
router.get("/api/model-capabilities", async (req, res) => {
  try {
    // 시스템 설정에서 지원하는 AI 모델 목록 반환
    const systemSettings = await getSystemSettings();
    const supportedModels = systemSettings.supportedAiModels as string[];
    
    console.log("[Model Capabilities] 지원 가능한 모델 목록 반환:", supportedModels);

    // 지원되는 모델 목록을 객체 형태로 반환 (이전 API 호환성 유지)
    const modelCapabilities: Record<string, boolean> = {};
    supportedModels.forEach((model: string) => {
      modelCapabilities[model] = true;
    });

    return res.json(modelCapabilities);
  } catch (error) {
    console.error("Error fetching model capabilities:", error);
    
    // 에러 발생 시 기본 모델 목록 반환 (graceful fallback)
    const fallbackCapabilities = {
      "openai": true,
      "gemini": true
    };
    console.warn("[Model Capabilities] 에러로 인해 기본값을 반환합니다:", fallbackCapabilities);
    
    return res.json(fallbackCapabilities);
  }
});

// Get all active concepts (public endpoint)
router.get("/api/concepts", async (req, res) => {
  try {
    // 사용자 인증 정보 가져오기 (쿠키 우선, 헤더 대안)
    let userHospitalId = null;
    let isAdmin = false;
    
    // 쿠키에서 먼저 확인 (브라우저 로그인)
    let token = req.cookies?.auth_token;
    
    // Authorization 헤더에서 대안으로 확인 (API 호출)
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

        const userId = decoded.userId || decoded.id;
        if (userId) {
          // 🔥 관리자 권한 확인
          isAdmin = decoded.memberType === 'admin' || decoded.memberType === 'superadmin';
          
          console.log(`[컨셉 조회] 사용자 ID: ${userId}, 관리자: ${isAdmin}, memberType: ${decoded.memberType}`);

          // 일반 사용자인 경우에만 병원 멤버십 확인
          if (!isAdmin) {
            const hospitalMember = await db.query.hospitalMembers.findFirst({
              where: eq(hospitalMembers.userId, userId)
            });

            if (hospitalMember) {
              userHospitalId = hospitalMember.hospitalId;
              console.log(`[컨셉 조회] 일반 사용자의 병원 ID: ${userHospitalId}`);
            }
          }
        }
      } catch (error) {
        // 토큰 검증 실패시 공개 컨셉만 보여줌
        console.log('[컨셉 조회] JWT 토큰 검증 실패:', error);
      }
    }

    // 🎯 컨셉 필터링: 관리자면 모든 활성화된 컨셉, 일반 사용자면 공개 + 본인 병원 전용
    let whereConditions;
    
    if (isAdmin) {
      // 관리자: 모든 활성화된 컨셉 (공개 + 병원전용 모두)
      whereConditions = eq(concepts.isActive, true);
      console.log('[컨셉 조회] 관리자 - 모든 활성화된 컨셉 반환');
    } else {
      // 일반 사용자: 공개 + 본인 소속 병원 전용
      whereConditions = and(
        eq(concepts.isActive, true),
        or(
          eq(concepts.visibilityType, 'public'),
          userHospitalId ? and(
            eq(concepts.visibilityType, 'hospital'),
            eq(concepts.hospitalId, userHospitalId)
          ) : undefined
        )
      );
      console.log(`[컨셉 조회] 일반 사용자 - 공개 + 병원 ${userHospitalId} 전용 컨셉 반환`);
    }

    const activeConcepts = await db.select().from(concepts)
      .where(whereConditions)
      .orderBy(asc(concepts.order));

    // URL 변환 함수 - SignedURL을 직접 공개 URL로 변환
    const convertToDirectUrl = (url: string): string => {
      if (!url) return url;
      try {
        // SignedURL인 경우 직접 공개 URL로 변환
        if (url.includes('GoogleAccessId=') || url.includes('Signature=')) {
          const urlObj = new URL(url);
          const pathname = urlObj.pathname;
          if (pathname.includes('/createtree-upload/')) {
            const filePath = pathname.substring(pathname.indexOf('/createtree-upload/') + '/createtree-upload/'.length);
            return `https://storage.googleapis.com/createtree-upload/${filePath}`;
          }
        }
        // 이미 직접 URL인 경우 그대로 반환
        return url;
      } catch (error) {
        return url;
      }
    };

    // 모든 컨셉의 썸네일 URL을 직접 공개 URL로 변환
    const convertedConcepts = activeConcepts.map(concept => ({
      ...concept,
      thumbnailUrl: concept.thumbnailUrl ? convertToDirectUrl(concept.thumbnailUrl) : concept.thumbnailUrl
    }));

    return res.json(convertedConcepts);
  } catch (error) {
    console.error("Error fetching public concepts:", error);
    return res.status(500).json({ error: "Failed to fetch concepts" });
  }
});

// 🎯 컨셉별 변수 조회 API (공개 - 사용자용)
router.get("/api/concepts/:conceptId/variables", async (req, res) => {
  try {
    const { conceptId } = req.params;

    // 활성화된 컨셉만 조회 (공개 API이므로)
    const concept = await db.query.concepts.findFirst({
      where: and(
        eq(concepts.conceptId, conceptId),
        eq(concepts.isActive, true) // 🔥 활성화된 컨셉만
      )
    });

    if (!concept) {
      return res.status(404).json({ error: "Active concept not found" });
    }

    // 변수 정보 파싱 및 반환
    let variables = [];
    if (concept.variables) {
      try {
        variables = typeof concept.variables === 'string'
          ? JSON.parse(concept.variables)
          : concept.variables;
      } catch (e) {
        console.log(`[변수 조회] ${conceptId} 컨셉의 변수 파싱 실패`);
        variables = [];
      }
    }

    console.log(`[변수 조회] ${conceptId} 컨셉 변수:`, variables);
    console.log(`[변수 조회] ${conceptId} 반환할 JSON:`, JSON.stringify(variables));

    return res.json(variables);
  } catch (error) {
    console.error("[변수 조회] API 에러:", error);
    return res.status(500).json({ error: "Failed to fetch concept variables" });
  }
});

// Get active A/B test for a concept
router.get("/api/concepts/:conceptId/abtest", async (req, res) => {
  try {
    const conceptId = req.params.conceptId;

    // Find active A/B test for the concept
    const activeTest = await db.query.abTests.findFirst({
      where: and(
        eq(abTests.conceptId, conceptId),
        eq(abTests.isActive, true)
      ),
    });

    if (!activeTest) {
      return res.status(404).json({ error: "No active A/B test found for this concept" });
    }

    // Get variants for the test
    const variants = await db.query.abTestVariants.findMany({
      where: eq(abTestVariants.testId, activeTest.testId),
    });

    return res.json({
      ...activeTest,
      variants
    });
  } catch (error) {
    console.error("Error fetching active A/B test:", error);
    return res.status(500).json({ error: "Failed to fetch active A/B test" });
  }
});

export default router;
