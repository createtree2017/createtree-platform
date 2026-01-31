import { users } from "@shared/schema";
import { InferSelectModel } from "drizzle-orm";

declare global {
  namespace Express {
    interface User extends InferSelectModel<typeof users> {
      // 추가 사용자 필드가 필요하면 여기에 정의
    }

    // 🔥 Firebase 미들웨어를 위한 Request 확장
    interface Request {
      /**
       * Firebase Storage에서 다운로드한 이미지 버퍼들
       * processFirebaseImageUrls 미들웨어에 의해 설정됨
       */
      downloadedBuffers?: Buffer[];

      /**
       * Firebase 업로드 모드 여부
       * true = imageUrls 사용, false = req.files 사용
       */
      isFirebaseMode?: boolean;
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

export { };