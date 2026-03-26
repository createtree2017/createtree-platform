import { db } from "@db";
import { themeMissions, subMissions, subMissionSubmissions, userMissionProgress, actionTypes, MISSION_STATUS, VISIBILITY_TYPE, bigMissions, bigMissionTopics, userBigMissionProgress } from "@shared/schema";
import { eq, and, or, asc, desc, sql, inArray } from "drizzle-orm";
import { ensurePermanentUrl } from "../../utils/gcs-image-storage";
import * as XLSX from "xlsx";
import { createNotification } from "../notifications";

export class AdminMissionReviewService {
  async getThemeMissionsWithStats(userRole: string | undefined, userHospitalId: number | undefined, hospitalIdQuery: any) {
    if (userRole === "hospital_admin" && hospitalIdQuery) {
      throw new Error("UNAUTHORIZED_HOSPITAL");
    }

    const conditions = [];
    if (userRole === "hospital_admin") {
      if (!userHospitalId) throw new Error("NO_HOSPITAL_INFO");
      conditions.push(
        or(
          eq(themeMissions.visibilityType, VISIBILITY_TYPE.PUBLIC),
          and(
            eq(themeMissions.visibilityType, VISIBILITY_TYPE.HOSPITAL),
            eq(themeMissions.hospitalId, userHospitalId)
          )
        )
      );
    } else if (hospitalIdQuery && hospitalIdQuery !== "all") {
      const filterHospitalId = parseInt(hospitalIdQuery, 10);
      if (!isNaN(filterHospitalId)) {
        conditions.push(eq(themeMissions.hospitalId, filterHospitalId));
      }
    }

    const missions = await db.query.themeMissions.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        category: true,
        hospital: true,
        subMissions: { orderBy: [asc(subMissions.order)] },
      },
      orderBy: [asc(themeMissions.order), desc(themeMissions.id)],
    });

    const missionsWithStats = await Promise.all(
      missions.map(async (mission) => {
        const subMissionIds = mission.subMissions.map((sm) => sm.id);
        if (subMissionIds.length === 0) {
          return {
            ...mission,
            stats: { pending: 0, approved: 0, rejected: 0, total: 0 },
          };
        }

        const statsResult = await db
          .select({
            pending: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.SUBMITTED} THEN 1 END)::int`,
            approved: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.APPROVED} THEN 1 END)::int`,
            rejected: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.REJECTED} THEN 1 END)::int`,
            waitlist: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.WAITLIST} THEN 1 END)::int`,
            cancelled: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.CANCELLED} THEN 1 END)::int`,
            total: sql<number>`COUNT(*)::int`,
          })
          .from(subMissionSubmissions)
          .where(inArray(subMissionSubmissions.subMissionId, subMissionIds));

        return {
          ...mission,
          stats: statsResult[0] || { pending: 0, approved: 0, rejected: 0, waitlist: 0, cancelled: 0, total: 0 },
        };
      })
    );

    const missionMap = new Map<number, any>();
    const rootMissions: any[] = [];
    const includedMissionIds = new Set(missionsWithStats.map((m) => m.id));

    for (const mission of missionsWithStats) {
      missionMap.set(mission.id, { ...mission, childMissions: [] });
    }

    for (const mission of missionsWithStats) {
      const missionWithChildren = missionMap.get(mission.id)!;
      if (mission.parentMissionId) {
        if (includedMissionIds.has(mission.parentMissionId)) {
          const parent = missionMap.get(mission.parentMissionId);
          if (parent) parent.childMissions.push(missionWithChildren);
        } else {
          rootMissions.push(missionWithChildren);
        }
      } else {
        rootMissions.push(missionWithChildren);
      }
    }

    return rootMissions;
  }

  async getSubMissionsWithStats(missionId: string, userRole: string | undefined, userHospitalId: number | undefined) {
    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.missionId, missionId),
    });

    if (!mission) throw new Error("MISSION_NOT_FOUND");

    if (userRole === "hospital_admin") {
      if (!userHospitalId) throw new Error("NO_HOSPITAL_INFO");
      if (mission.visibilityType === VISIBILITY_TYPE.HOSPITAL && mission.hospitalId !== userHospitalId) {
        throw new Error("UNAUTHORIZED");
      }
    }

    const subMissionsList = await db.query.subMissions.findMany({
      where: eq(subMissions.themeMissionId, mission.id),
      orderBy: [asc(subMissions.order)],
      with: { actionType: true },
    });

    return await Promise.all(
      subMissionsList.map(async (subMission) => {
        const statsResult = await db
          .select({
            pending: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.SUBMITTED} THEN 1 END)::int`,
            approved: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.APPROVED} THEN 1 END)::int`,
            rejected: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.REJECTED} THEN 1 END)::int`,
            waitlist: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.WAITLIST} THEN 1 END)::int`,
            cancelled: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.CANCELLED} THEN 1 END)::int`,
            total: sql<number>`COUNT(*)::int`,
          })
          .from(subMissionSubmissions)
          .where(eq(subMissionSubmissions.subMissionId, subMission.id));

        return {
          ...subMission,
          stats: statsResult[0] || { pending: 0, approved: 0, rejected: 0, waitlist: 0, cancelled: 0, total: 0 },
        };
      })
    );
  }

  async getSubmissions(queryStr: any, userRole: string | undefined, userHospitalId: number | undefined) {
    const { subMissionId, status, hospitalId } = queryStr;

    if (userRole === "hospital_admin" && hospitalId) {
      throw new Error("UNAUTHORIZED_HOSPITAL");
    }

    let submissions;
    if (userRole === "hospital_admin") {
      if (!userHospitalId) throw new Error("NO_HOSPITAL_INFO");

      const accessibleMissions = await db.query.themeMissions.findMany({
        where: or(
          eq(themeMissions.visibilityType, VISIBILITY_TYPE.PUBLIC),
          and(
            eq(themeMissions.visibilityType, VISIBILITY_TYPE.HOSPITAL),
            eq(themeMissions.hospitalId, userHospitalId)
          )
        ),
        columns: { id: true },
      });

      const accessibleMissionIds = accessibleMissions.map((m) => m.id);
      if (accessibleMissionIds.length === 0) return [];

      const accessibleSubMissions = await db.query.subMissions.findMany({
        where: inArray(subMissions.themeMissionId, accessibleMissionIds),
        columns: { id: true },
      });

      const accessibleSubMissionIds = accessibleSubMissions.map((sm) => sm.id);
      if (accessibleSubMissionIds.length === 0) return [];

      const conditions = [inArray(subMissionSubmissions.subMissionId, accessibleSubMissionIds)];

      if (subMissionId) {
        const requestedSubMissionId = parseInt(subMissionId as string);
        if (!accessibleSubMissionIds.includes(requestedSubMissionId)) {
          throw new Error("UNAUTHORIZED");
        }
        conditions.push(eq(subMissionSubmissions.subMissionId, requestedSubMissionId));
      }

      if (status && status !== "all") {
        conditions.push(eq(subMissionSubmissions.status, status as string));
      }

      submissions = await db.query.subMissionSubmissions.findMany({
        where: and(...conditions),
        with: {
          user: true,
          subMission: {
            with: {
              themeMission: {
                with: { category: true, hospital: true },
              },
            },
          },
        },
        orderBy: [desc(subMissionSubmissions.submittedAt)],
      });
    } else {
      const conditions = [];
      if (subMissionId) {
        conditions.push(eq(subMissionSubmissions.subMissionId, parseInt(subMissionId as string)));
      }
      if (status && status !== "all") {
        conditions.push(eq(subMissionSubmissions.status, status as string));
      }

      submissions = await db.query.subMissionSubmissions.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          user: true,
          subMission: {
            with: {
              themeMission: {
                with: { category: true, hospital: true },
              },
            },
          },
        },
        orderBy: [desc(subMissionSubmissions.submittedAt)],
      });
    }

    return submissions.map((submission: any) => {
      const originalData = submission.submissionData as any;
      if (!originalData) return submission;

      const processedData = JSON.parse(JSON.stringify(originalData));
      if (processedData.fileUrl && processedData.gsPath) {
        processedData.fileUrl = ensurePermanentUrl(processedData.fileUrl, processedData.gsPath);
      }
      if (processedData.imageUrl && processedData.gsPath) {
        processedData.imageUrl = ensurePermanentUrl(processedData.imageUrl, processedData.gsPath);
      }
      if (processedData.slots && Array.isArray(processedData.slots)) {
        processedData.slots = processedData.slots.map((slot: any) => ({
          ...slot,
          fileUrl: slot.fileUrl && slot.gsPath ? ensurePermanentUrl(slot.fileUrl, slot.gsPath) : slot.fileUrl,
          imageUrl: slot.imageUrl && slot.gsPath ? ensurePermanentUrl(slot.imageUrl, slot.gsPath) : slot.imageUrl,
        }));
      }
      return { ...submission, submissionData: processedData };
    });
  }

  async getPendingSubmissions(userRole: string | undefined, userHospitalId: number | undefined) {
    if (userRole === "hospital_admin") {
      if (!userHospitalId) throw new Error("NO_HOSPITAL_INFO");

      const accessibleMissions = await db.query.themeMissions.findMany({
        where: or(
          eq(themeMissions.visibilityType, VISIBILITY_TYPE.PUBLIC),
          and(
            eq(themeMissions.visibilityType, VISIBILITY_TYPE.HOSPITAL),
            eq(themeMissions.hospitalId, userHospitalId)
          )
        ),
        columns: { id: true },
      });

      const accessibleMissionIds = accessibleMissions.map((m) => m.id);
      if (accessibleMissionIds.length === 0) return [];

      const accessibleSubMissions = await db.query.subMissions.findMany({
        where: inArray(subMissions.themeMissionId, accessibleMissionIds),
        columns: { id: true },
      });

      const accessibleSubMissionIds = accessibleSubMissions.map((sm) => sm.id);
      if (accessibleSubMissionIds.length === 0) return [];

      return await db.query.subMissionSubmissions.findMany({
        where: and(
          inArray(subMissionSubmissions.subMissionId, accessibleSubMissionIds),
          eq(subMissionSubmissions.status, MISSION_STATUS.SUBMITTED)
        ),
        with: {
          user: true,
          subMission: {
            with: {
              themeMission: {
                with: { category: true },
              },
            },
          },
        },
        orderBy: [desc(subMissionSubmissions.submittedAt)],
        limit: 50,
      });
    }

    return await db.query.subMissionSubmissions.findMany({
      where: eq(subMissionSubmissions.status, MISSION_STATUS.SUBMITTED),
      with: {
        user: true,
        subMission: {
          with: {
            themeMission: {
              with: { category: true },
            },
          },
        },
      },
      orderBy: [desc(subMissionSubmissions.submittedAt)],
      limit: 50,
    });
  }

  async approveSubmission(submissionId: number, adminId: number) {
    const submission = await db.query.subMissionSubmissions.findFirst({
      where: eq(subMissionSubmissions.id, submissionId),
      with: {
        subMission: {
          with: { themeMission: true }
        }
      }
    });

    if (!submission) throw new Error("NOT_FOUND");
    if (submission.status !== MISSION_STATUS.SUBMITTED) throw new Error("NOT_PENDING");

    const [approved] = await db
      .update(subMissionSubmissions)
      .set({
        status: MISSION_STATUS.APPROVED,
        isLocked: true,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subMissionSubmissions.id, submissionId))
      .returning();

    // Trigger big mission progress recalculation asynchronously
    if (approved) {
      this.recalculateUserBigMissionProgress(approved.userId).catch(err => {
        console.error(`Failed to recalculate big mission progress for user ${approved.userId}:`, err);
      });

      // FCM 알림 발송 (비동기)
      const themeTitle = (submission as any)?.subMission?.themeMission?.title || "미션";
      createNotification({
        userId: String(approved.userId),
        type: "mission_approve",
        title: "미션 승인 안내",
        message: `축하합니다! [${themeTitle}] 미션이 승인되었습니다. 🎉`,
        data: { submissionId: String(submissionId) },
        actionUrl: "/mymissions",
      }).catch(err => console.error("FCM 미션 승인 알림 실패:", err));
    }

    return approved;
  }

  async rejectSubmission(submissionId: number, adminId: number, rejectReason: string) {
    const submission = await db.query.subMissionSubmissions.findFirst({
      where: eq(subMissionSubmissions.id, submissionId),
      with: {
        subMission: {
          with: { themeMission: true }
        }
      }
    });

    if (!submission) throw new Error("NOT_FOUND");
    if (submission.status !== MISSION_STATUS.SUBMITTED) throw new Error("NOT_PENDING");

    const [rejected] = await db
      .update(subMissionSubmissions)
      .set({
        status: MISSION_STATUS.REJECTED,
        isLocked: false,
        rejectReason: rejectReason || null,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subMissionSubmissions.id, submissionId))
      .returning();

    // Trigger big mission progress recalculation asynchronously
    if (rejected) {
      this.recalculateUserBigMissionProgress(rejected.userId).catch(err => {
        console.error(`Failed to recalculate big mission progress for user ${rejected.userId}:`, err);
      });

      // FCM 알림 발송 (비동기)
      const themeTitle = (submission as any)?.subMission?.themeMission?.title || "미션";
      createNotification({
        userId: String(rejected.userId),
        type: "mission_reject",
        title: "미션 반려 안내",
        message: `[${themeTitle}] 미션이 반려되었습니다. 사유를 확인해주세요.`,
        data: { submissionId: String(submissionId) },
        actionUrl: "/mymissions",
      }).catch(err => console.error("FCM 미션 반려 알림 실패:", err));
    }

    return rejected;
  }

  async bulkUpdateStatus(submissionIds: number[], status: string, adminId: number, rejectReason?: string) {
    if (![MISSION_STATUS.APPROVED, MISSION_STATUS.REJECTED, MISSION_STATUS.SUBMITTED, MISSION_STATUS.WAITLIST, MISSION_STATUS.CANCELLED].includes(status as any)) {
      throw new Error("INVALID_STATUS");
    }

    const isLocked = status === MISSION_STATUS.APPROVED;

    const updatedRecords = await db
      .update(subMissionSubmissions)
      .set({
        status: status as any,
        isLocked,
        rejectReason: status === MISSION_STATUS.REJECTED ? (rejectReason || null) : null,
        reviewedBy: [MISSION_STATUS.APPROVED, MISSION_STATUS.REJECTED].includes(status as any) ? adminId : null,
        reviewedAt: [MISSION_STATUS.APPROVED, MISSION_STATUS.REJECTED].includes(status as any) ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(inArray(subMissionSubmissions.id, submissionIds))
      .returning();

    // Trigger big mission recalculation asynchronously for all modified users
    if (updatedRecords.length > 0) {
      const uniqueUserIds = [...new Set(updatedRecords.map(r => r.userId))];
      uniqueUserIds.forEach(userId => {
        this.recalculateUserBigMissionProgress(userId).catch(err => {
          console.error(`Failed to recalculate big mission progress for user ${userId}:`, err);
        });

        // FCM 벌크 업데이트 알림 (비동기)
        const type = status === MISSION_STATUS.APPROVED ? "mission_approve" : status === MISSION_STATUS.REJECTED ? "mission_reject" : "system";
        const title = status === MISSION_STATUS.APPROVED ? "미션 승인 안내" : status === MISSION_STATUS.REJECTED ? "미션 반려 안내" : "알림";
        const message = status === MISSION_STATUS.APPROVED 
          ? "제출하신 미션이 승인되었습니다. 🎉" 
          : status === MISSION_STATUS.REJECTED 
            ? "제출하신 미션이 반려되었습니다. 확인 부탁드립니다." 
            : "미션 상태가 변경되었습니다.";

        createNotification({
          userId: String(userId),
          type,
          title,
          message,
          actionUrl: "/mymissions",
        }).catch(err => console.error("FCM 벌크 업데이트 알림 실패:", err));
      });
    }

    return updatedRecords[0];
  }

  async getRecentActivities(userRole: string | undefined, userHospitalId: number | undefined) {
    let submissionsCondition = undefined;

    if (userRole === "hospital_admin") {
      if (!userHospitalId) throw new Error("NO_HOSPITAL_INFO");

      const accessibleMissions = await db.query.themeMissions.findMany({
        where: or(
          eq(themeMissions.visibilityType, VISIBILITY_TYPE.PUBLIC),
          and(
            eq(themeMissions.visibilityType, VISIBILITY_TYPE.HOSPITAL),
            eq(themeMissions.hospitalId, userHospitalId)
          )
        ),
        columns: { id: true },
      });

      const accessibleMissionIds = accessibleMissions.map((m) => m.id);
      if (accessibleMissionIds.length === 0) return { recentSubmissions: [], recentApplications: [] };

      const accessibleSubMissions = await db.query.subMissions.findMany({
        where: inArray(subMissions.themeMissionId, accessibleMissionIds),
        columns: { id: true },
      });

      const accessibleSubMissionIds = accessibleSubMissions.map((sm) => sm.id);
      if (accessibleSubMissionIds.length === 0) return { recentSubmissions: [], recentApplications: [] };

      submissionsCondition = inArray(subMissionSubmissions.subMissionId, accessibleSubMissionIds);
    }

    const recentSubmissions = await db.query.subMissionSubmissions.findMany({
      where: submissionsCondition,
      with: {
        user: true,
        subMission: {
          with: {
            themeMission: {
              with: { category: true },
            },
          },
        },
      },
      orderBy: [desc(subMissionSubmissions.submittedAt)],
      limit: 10,
    });

    const recentApplications = await db.query.subMissionSubmissions.findMany({
      where: submissionsCondition ? and(
        submissionsCondition,
        eq(subMissionSubmissions.status, MISSION_STATUS.SUBMITTED)
      ) : eq(subMissionSubmissions.status, MISSION_STATUS.SUBMITTED),
      with: {
        user: true,
        subMission: {
          with: {
            themeMission: {
              with: { category: true },
            },
            actionType: true,
          },
        },
      },
      orderBy: [desc(subMissionSubmissions.submittedAt)],
      limit: 10,
    });

    return { recentSubmissions, recentApplications };
  }

  /**
   * 미션 제출 정보를 엑셀 파일로 내보내기
   * (리팩토링 중 누락되었던 기능 복원 - 원본 커밋 3b82be4)
   */
  async exportMissionExcel(missionId: string) {
    // 주제미션 조회
    const themeMission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.missionId, missionId),
    });

    if (!themeMission) {
      throw new Error("MISSION_NOT_FOUND");
    }

    // 해당 주제미션의 세부미션 목록 조회 (제출 데이터 포함 - 단일 쿼리로 N+1 방지)
    const subMissionList = await db.query.subMissions.findMany({
      where: eq(subMissions.themeMissionId, themeMission.id),
      orderBy: asc(subMissions.order),
      with: {
        submissions: {
          with: {
            user: true,
          },
          orderBy: desc(subMissionSubmissions.submittedAt),
        },
      },
    });

    if (subMissionList.length === 0) {
      throw new Error("NO_SUB_MISSIONS");
    }

    const workbook = XLSX.utils.book_new();
    const usedSheetNames = new Set<string>();

    for (const subMission of subMissionList) {
      const submissions = subMission.submissions || [];

      // 상태 레이블 변환 함수
      const getStatusLabel = (status: string) => {
        const statusMap: Record<string, string> = {
          submitted: "검수 대기",
          approved: "승인",
          rejected: "보류",
          pending: "대기",
          waitlist: "대기자",
          cancelled: "취소",
        };
        return statusMap[status] || status;
      };

      // 슬롯에서 제출형식과 내용을 추출하는 함수
      const extractSlotRows = (
        data: any,
      ): Array<{ format: string; content: string }> => {
        if (!data) return [{ format: "-", content: "-" }];

        const rows: Array<{ format: string; content: string }> = [];

        // 슬롯 배열 처리
        if (data.slots && Array.isArray(data.slots)) {
          data.slots.forEach((slot: any, index: number) => {
            const slotLabel = `슬롯${index + 1}`;
            if (slot.linkUrl)
              rows.push({ format: `${slotLabel}[링크]`, content: slot.linkUrl });
            if (slot.imageUrl)
              rows.push({ format: `${slotLabel}[이미지]`, content: slot.imageUrl });
            if (slot.fileUrl)
              rows.push({ format: `${slotLabel}[파일]`, content: slot.fileUrl });
            if (slot.textContent)
              rows.push({ format: `${slotLabel}[텍스트]`, content: slot.textContent });
            if (slot.memo)
              rows.push({ format: `${slotLabel}[메모]`, content: slot.memo });
          });
        }

        // 레거시 단일 데이터 처리 (슬롯이 없는 경우)
        if (!data.slots || !Array.isArray(data.slots) || data.slots.length === 0) {
          if (data.linkUrl) rows.push({ format: "링크", content: data.linkUrl });
          if (data.imageUrl) rows.push({ format: "이미지", content: data.imageUrl });
          if (data.fileUrl) rows.push({ format: "파일", content: data.fileUrl });
          if (data.textContent) rows.push({ format: "텍스트", content: data.textContent });
          if (data.memo) rows.push({ format: "메모", content: data.memo });
        }

        // 제작소 제출
        if (data.studioProjectId) {
          rows.push({
            format: "제작소",
            content: `${data.studioProjectTitle || data.studioProjectId}`,
          });
        }

        // 신청 정보
        if (data.registrationName)
          rows.push({ format: "신청자명", content: data.registrationName });
        if (data.registrationPhone)
          rows.push({ format: "신청연락처", content: data.registrationPhone });

        return rows.length > 0 ? rows : [{ format: "-", content: "-" }];
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
          minute: "2-digit",
        });
      };

      // 시트 데이터 생성
      const sheetData = [
        ["사용자명", "닉네임", "전화번호", "제출일시", "상태", "제출형식", "내용"],
      ];

      for (const submission of submissions) {
        const user = submission.user;
        const submissionData = submission.submissionData as any;
        const slotRows = extractSlotRows(submissionData);

        // 슬롯별로 행을 나눠서 표시
        slotRows.forEach((row, idx) => {
          sheetData.push([
            idx === 0 ? (user as any)?.fullName || "-" : "",
            idx === 0 ? (user as any)?.username || "-" : "",
            idx === 0 ? (user as any)?.phoneNumber || "-" : "",
            idx === 0 ? formatDateTime(submission.submittedAt) : "",
            idx === 0 ? getStatusLabel(submission.status) : "",
            row.format,
            row.content,
          ]);
        });
      }

      // 시트 생성 및 추가
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

      // 컬럼 너비 설정
      worksheet["!cols"] = [
        { wch: 15 }, // 사용자명
        { wch: 15 }, // 닉네임
        { wch: 15 }, // 전화번호
        { wch: 20 }, // 제출일시
        { wch: 12 }, // 상태
        { wch: 18 }, // 제출형식
        { wch: 60 }, // 내용
      ];

      // 시트 이름 (최대 31자, 특수문자 제거, 중복 방지)
      let baseSheetName = subMission.title
        .replace(/[\\/*?:\[\]]/g, "")
        .slice(0, 31);

      let sheetName = baseSheetName;
      let counter = 2;

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

    // 파일명 생성 (한국 시간대)
    const now = new Date();
    const dateStr = now
      .toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      .replace(/\. /g, "-")
      .replace(/\./g, "");

    const fileName = encodeURIComponent(
      `${themeMission.title}_${dateStr}.xlsx`,
    );

    return { buffer, fileName };
  }

  /**
   * 큰미션 달성률 동적 재계산 로직 (Phase 1 Refactoring 복구)
   */
  private async recalculateUserBigMissionProgress(userId: number) {
    try {
      // 1. 해당 유저의 승인된 (APPROVED) 서브미션 추출 및 연관된 카테고리 ID 수집
      const approvedSubmissions = await db.query.subMissionSubmissions.findMany({
        where: and(
          eq(subMissionSubmissions.userId, userId),
          eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED)
        ),
        with: {
          subMission: {
            with: {
              themeMission: true
            }
          }
        }
      });

      const completedCategoryIds = new Set<string>();
      for (const sub of approvedSubmissions) {
        if (sub.subMission?.themeMission?.categoryId) {
          completedCategoryIds.add(sub.subMission.themeMission.categoryId);
        }
      }

      // 2. 활성화된 전체 큰미션과 하위 토픽 조회
      const activeBigMissions = await db.query.bigMissions.findMany({
        where: eq(bigMissions.isActive, true),
        with: {
          topics: {
            where: eq(bigMissionTopics.isActive, true)
          }
        }
      });

      // 3. 재계산 및 업데이트/인서트
      for (const mission of activeBigMissions) {
        const totalTopics = mission.topics.length;
        if (totalTopics === 0) continue;

        let completedTopicsCount = 0;
        for (const topic of mission.topics) {
          if (completedCategoryIds.has(topic.categoryId)) {
            completedTopicsCount++;
          }
        }

        const newStatus = completedTopicsCount > 0 
          ? (completedTopicsCount >= totalTopics ? "completed" : "in_progress")
          : "not_started";

        const existingProgress = await db.query.userBigMissionProgress.findFirst({
          where: and(
            eq(userBigMissionProgress.userId, userId),
            eq(userBigMissionProgress.bigMissionId, mission.id)
          )
        });

        if (existingProgress) {
          if (existingProgress.completedTopics !== completedTopicsCount || existingProgress.status !== newStatus) {
             const completedAt = newStatus === "completed" && existingProgress.status !== "completed" 
                ? new Date() 
                : (newStatus !== "completed" ? null : existingProgress.completedAt);

             await db.update(userBigMissionProgress)
               .set({
                 completedTopics: completedTopicsCount,
                 totalTopics,
                 status: newStatus,
                 completedAt,
                 updatedAt: new Date()
               })
               .where(eq(userBigMissionProgress.id, existingProgress.id));
          }
        } else if (completedTopicsCount > 0) {
          await db.insert(userBigMissionProgress).values({
             userId,
             bigMissionId: mission.id,
             completedTopics: completedTopicsCount,
             totalTopics,
             status: newStatus,
             completedAt: newStatus === "completed" ? new Date() : null,
          });
        }
      }
    } catch (error) {
      console.error(`Error recalculating big mission progress for user ${userId}:`, error);
    }
  }
}
