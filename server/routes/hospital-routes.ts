import type { Express } from "express";
import { requireHospitalAdmin } from "../middleware/admin-auth";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/error-handler";
import { validateNumericParam, validatePagination, validateHospitalAccess } from "../middleware/validation";
import { responseFormatter } from "../middleware/response";
import { 
  hospitals,
  users,
} from "../../shared/schema";
import { db } from "@db";
import { eq, and, desc } from "drizzle-orm";

export function registerHospitalRoutes(app: Express): void {



  // Hospital Information Management
  app.get("/hospital/info", requireHospitalAdmin, async (req, res) => {
    try {
      const hospitalId = (req as any).user.hospitalId;
      
      if (!hospitalId) {
        return res.status(403).json({ message: "접근 권한 없음" });
      }
      
      const hospital = await db.query.hospitals.findFirst({
        where: eq(hospitals.id, hospitalId)
      });
      
      if (!hospital) {
        return res.status(404).json({ message: "병원을 찾을 수 없습니다" });
      }
      
      res.json(hospital);
    } catch (error) {
      console.error("Error fetching hospital info:", error);
      res.status(500).json({ error: "Failed to fetch hospital information" });
    }
  });

  // Hospital Reviews Management
  app.get("/hospital/reviews", requireHospitalAdmin, async (req, res) => {
    try {
      const hospitalId = (req as any).user.hospitalId;
      
      if (!hospitalId) {
        return res.status(403).json({ message: "접근 권한 없음" });
      }
      
      // Note: Assuming reviews table exists - adjust based on actual schema
      // For now, returning empty array as placeholder
      res.json([]);
    } catch (error) {
      console.error("Error fetching hospital reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  app.patch("/hospital/reviews/:id/select", requireHospitalAdmin, async (req, res) => {
    try {
      const reviewId = parseInt(req.params.id);
      const hospitalId = (req as any).user.hospitalId;
      
      if (!hospitalId) {
        return res.status(403).json({ message: "접근 권한 없음" });
      }
      
      // Note: Implement review selection logic when reviews table is available
      res.json({ message: "Review selected successfully" });
    } catch (error) {
      console.error("Error selecting review:", error);
      res.status(500).json({ error: "Failed to select review" });
    }
  });

  // 캠페인 관련 라우트 제거됨 (캠페인 기능 제거됨)

  app.get("/api/hospital/info", requireHospitalAdmin, async (req, res) => {
    try {
      const hospitalId = (req as any).user.hospitalId;
      
      if (!hospitalId) {
        return res.status(403).json({ message: "접근 권한 없음" });
      }
      
      const hospital = await db.query.hospitals.findFirst({
        where: eq(hospitals.id, hospitalId)
      });
      
      if (!hospital) {
        return res.status(404).json({ message: "병원을 찾을 수 없습니다" });
      }
      
      res.json(hospital);
    } catch (error) {
      console.error("Error fetching hospital info:", error);
      res.status(500).json({ error: "Failed to fetch hospital information" });
    }
  });
}