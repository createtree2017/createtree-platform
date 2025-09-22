import { users } from "@shared/schema";
import { InferSelectModel } from "drizzle-orm";

declare global {
  namespace Express {
    interface User extends InferSelectModel<typeof users> {
      // 추가 사용자 필드가 필요하면 여기에 정의
    }

    interface SessionData {
      passport?: {
        user: number;
      };
      // Firebase 인증 관련 세션 필드
      userId?: number;
      firebaseUid?: string;
      userEmail?: string;
      userRole?: string;
      isAdmin?: boolean;
      isHospitalAdmin?: boolean;
      // Google OAuth 사용자 객체 저장을 위한 필드
      user?: {
        uid: string;
        id: number;
        email: string;
        memberType: string;
        role: string;
        [key: string]: any;
      };
    }
  }
}