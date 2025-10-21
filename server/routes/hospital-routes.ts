import type { Express } from "express";
import { requireHospitalAdmin, requireAdminOrSuperAdmin } from "../middleware/admin-auth";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/error-handler";
import { validateNumericParam, validatePagination, validateHospitalAccess } from "../middleware/validation";
import { responseFormatter } from "../middleware/response";
import { 
  hospitals,
  users,
  hospitalCodes,
} from "../../shared/schema";
import { db } from "@db";
import { eq, and, desc, asc } from "drizzle-orm";
import QRCode from "qrcode";
import { QR_CONFIG } from "../../shared/qr-config";

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
        return res.status(400).json({
          success: false,
          error: "병원 정보가 설정되지 않았습니다.",
          message: "계정에 병원 ID가 연결되어 있지 않습니다."
        });
      }

      console.log(`병원 정보 조회 - 병원 ID: ${hospitalId}`);
      
      const hospital = await db.query.hospitals.findFirst({
        where: eq(hospitals.id, hospitalId),
        columns: {
          id: true,
          name: true,
          address: true,
          phone: true,
          email: true,
          logoUrl: true,
          themeColor: true
        }
      });
      
      if (!hospital) {
        return res.status(404).json({ error: "병원을 찾을 수 없습니다." });
      }

      console.log(`[병원 정보 조회] 병원관리자 ${(req as any).user.userId}가 병원 ${hospital.name} 정보 조회`);
      
      return res.json({
        success: true,
        data: hospital
      });
    } catch (error) {
      console.error("Error fetching hospital info:", error);
      res.status(500).json({ error: "Failed to fetch hospital information" });
    }
  });

  // 병원 목록 조회 API (공개)
  app.get("/api/hospitals", async (req, res) => {
    try {
      const hospitalsList = await db.query.hospitals.findMany({
        where: eq(hospitals.isActive, true),
        orderBy: asc(hospitals.name),
        columns: {
          id: true,
          name: true,
          slug: true,
          address: true,
          phone: true,
          email: true,
          logoUrl: true
        }
      });

      return res.json(hospitalsList);
    } catch (error) {
      console.error("병원 목록 조회 오류:", error);
      return res.status(500).json({ error: "병원 목록을 가져오는 중 오류가 발생했습니다." });
    }
  });

  // QR코드 데이터 생성 API (공개)
  app.get("/api/qr/hospital/:hospitalId/:codeId", async (req, res) => {
    try {
      const { hospitalId, codeId } = req.params;

      const codeData = await db.select()
        .from(hospitalCodes)
        .where(and(
          eq(hospitalCodes.id, parseInt(codeId)),
          eq(hospitalCodes.hospitalId, parseInt(hospitalId)),
          eq(hospitalCodes.isQREnabled, true),
          eq(hospitalCodes.isActive, true)
        ))
        .limit(1);

      if (!codeData.length) {
        return res.status(404).json({ error: "QR 코드를 찾을 수 없습니다" });
      }

      const baseUrl = process.env.NODE_ENV === 'production'
        ? `https://${req.get('host')}`
        : `http://${req.get('host')}`;

      const qrData = `${baseUrl}/signup?hospital=${hospitalId}&code=${codeData[0].code}&type=qr`;

      return res.status(200).json({
        qrData,
        description: codeData[0].qrDescription,
        codeType: codeData[0].codeType,
        remainingSlots: codeData[0].maxUsage ? codeData[0].maxUsage - codeData[0].currentUsage : null
      });

    } catch (error) {
      console.error('QR 데이터 생성 오류:', error);
      return res.status(500).json({ error: "QR 데이터 생성 중 오류가 발생했습니다" });
    }
  });

  // QR 코드 생성 API (관리자 전용)
  app.get("/api/qr/generate/:hospitalId/:codeId", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const { hospitalId, codeId } = req.params;

      const codeInfo = await db.select({
        id: hospitalCodes.id,
        hospitalId: hospitalCodes.hospitalId,
        hospitalName: hospitals.name,
        code: hospitalCodes.code,
        codeType: hospitalCodes.codeType,
        isQREnabled: hospitalCodes.isQREnabled,
        isActive: hospitalCodes.isActive,
        expiresAt: hospitalCodes.expiresAt,
        qrDescription: hospitalCodes.qrDescription,
      })
      .from(hospitalCodes)
      .leftJoin(hospitals, eq(hospitalCodes.hospitalId, hospitals.id))
      .where(and(
        eq(hospitalCodes.id, parseInt(codeId)),
        eq(hospitalCodes.hospitalId, parseInt(hospitalId)),
        eq(hospitalCodes.isActive, true),
        eq(hospitalCodes.isQREnabled, true)
      ))
      .limit(1);

      if (codeInfo.length === 0) {
        return res.status(404).json({ error: "QR 활성화된 코드를 찾을 수 없습니다" });
      }

      const code = codeInfo[0];

      const qrData = {
        type: QR_CONFIG.TYPE,
        version: QR_CONFIG.VERSION,
        hospitalId: code.hospitalId,
        hospitalName: code.hospitalName,
        codeId: code.id,
        code: code.code,
        codeType: code.codeType,
        description: code.qrDescription,
        generated: new Date().toISOString(),
        expires: code.expiresAt ? new Date(code.expiresAt).toISOString() : null,
        url: `${req.protocol}://${req.get('host')}/api/qr/verify`
      };

      const qrString = `${req.protocol}://${req.get('host')}/signup?type=qr&hospital=${code.hospitalId}&code=${code.code}`;
      const qrImageBuffer = await QRCode.toBuffer(qrString, {
        type: 'png',
        width: QR_CONFIG.IMAGE_WIDTH,
        margin: QR_CONFIG.IMAGE_MARGIN,
        color: {
          dark: QR_CONFIG.DARK_COLOR,
          light: QR_CONFIG.LIGHT_COLOR
        }
      });

      res.set({
        'Content-Type': 'image/png',
        'Content-Length': qrImageBuffer.length,
        'Cache-Control': QR_CONFIG.CACHE_CONTROL,
        'Content-Disposition': `inline; filename="hospital-${hospitalId}-code-${codeId}.png"`
      });

      res.send(qrImageBuffer);

    } catch (error) {
      console.error('QR 코드 생성 오류:', error);
      res.status(500).json({ error: "QR 코드 생성에 실패했습니다" });
    }
  });

  // QR 코드 데이터 조회 API (관리자 전용)
  app.get("/api/qr/data/:hospitalId/:codeId", requireAdminOrSuperAdmin, async (req, res) => {
    try {
      const { hospitalId, codeId } = req.params;

      const codeInfo = await db.select({
        id: hospitalCodes.id,
        hospitalId: hospitalCodes.hospitalId,
        hospitalName: hospitals.name,
        code: hospitalCodes.code,
        codeType: hospitalCodes.codeType,
        isQREnabled: hospitalCodes.isQREnabled,
        isActive: hospitalCodes.isActive,
        expiresAt: hospitalCodes.expiresAt,
        qrDescription: hospitalCodes.qrDescription,
      })
      .from(hospitalCodes)
      .leftJoin(hospitals, eq(hospitalCodes.hospitalId, hospitals.id))
      .where(and(
        eq(hospitalCodes.id, parseInt(codeId)),
        eq(hospitalCodes.hospitalId, parseInt(hospitalId)),
        eq(hospitalCodes.isActive, true),
        eq(hospitalCodes.isQREnabled, true)
      ))
      .limit(1);

      if (codeInfo.length === 0) {
        return res.status(404).json({ error: "QR 활성화된 코드를 찾을 수 없습니다" });
      }

      const code = codeInfo[0];

      const qrData = {
        type: QR_CONFIG.TYPE,
        version: QR_CONFIG.VERSION,
        hospitalId: code.hospitalId,
        hospitalName: code.hospitalName,
        codeId: code.id,
        code: code.code,
        codeType: code.codeType,
        description: code.qrDescription,
        generated: new Date().toISOString(),
        expires: code.expiresAt ? new Date(code.expiresAt).toISOString() : null,
        url: `${req.protocol}://${req.get('host')}/api/qr/verify`
      };

      res.json({
        success: true,
        qrData,
        qrString: `${req.protocol}://${req.get('host')}/signup?type=qr&hospital=${code.hospitalId}&code=${code.code}`,
        imageUrl: `/api/qr/generate/${hospitalId}/${codeId}`
      });

    } catch (error) {
      console.error('QR 데이터 조회 오류:', error);
      res.status(500).json({ error: "QR 데이터 조회에 실패했습니다" });
    }
  });

  // QR 스캔 검증 API (공개)
  app.post("/api/qr/verify", async (req, res) => {
    try {
      const { qrData } = req.body;

      if (!qrData || typeof qrData !== 'string') {
        return res.status(400).json({ error: "유효하지 않은 QR 데이터입니다" });
      }

      let parsedData;
      try {
        parsedData = JSON.parse(qrData);
      } catch {
        return res.status(400).json({ error: "QR 데이터 형식이 올바르지 않습니다" });
      }

      if (parsedData.type !== QR_CONFIG.TYPE || !parsedData.hospitalId || !parsedData.codeId) {
        return res.status(400).json({ error: "병원 인증 QR 코드가 아닙니다" });
      }

      if (parsedData.expires && new Date(parsedData.expires) < new Date()) {
        return res.status(400).json({ error: "만료된 QR 코드입니다" });
      }

      const codeInfo = await db.select({
        id: hospitalCodes.id,
        hospitalId: hospitalCodes.hospitalId,
        hospitalName: hospitals.name,
        code: hospitalCodes.code,
        codeType: hospitalCodes.codeType,
        maxUsage: hospitalCodes.maxUsage,
        currentUsage: hospitalCodes.currentUsage,
        isQREnabled: hospitalCodes.isQREnabled,
        isActive: hospitalCodes.isActive,
      })
      .from(hospitalCodes)
      .leftJoin(hospitals, eq(hospitalCodes.hospitalId, hospitals.id))
      .where(and(
        eq(hospitalCodes.id, parsedData.codeId),
        eq(hospitalCodes.hospitalId, parsedData.hospitalId),
        eq(hospitalCodes.code, parsedData.code),
        eq(hospitalCodes.isActive, true),
        eq(hospitalCodes.isQREnabled, true)
      ))
      .limit(1);

      if (codeInfo.length === 0) {
        return res.status(404).json({ error: "유효하지 않은 QR 코드입니다" });
      }

      const code = codeInfo[0];

      if ((code.codeType === 'limited' || code.codeType === 'qr_limited') &&
          code.maxUsage && code.currentUsage >= code.maxUsage) {
        return res.status(400).json({ error: "사용 가능한 인원이 초과되었습니다" });
      }

      res.json({
        success: true,
        message: "QR 코드 인증 성공",
        hospital: {
          id: code.hospitalId,
          name: code.hospitalName
        },
        code: code.code,
        codeType: code.codeType,
        autoFill: {
          hospitalId: code.hospitalId,
          promoCode: code.code
        }
      });

    } catch (error) {
      console.error('QR 스캔 검증 오류:', error);
      res.status(500).json({ error: "QR 코드 검증에 실패했습니다" });
    }
  });
}