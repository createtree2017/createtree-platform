import { Router } from "express";
import { requireAdmin } from "../middleware/auth";
import { pushAutomationController } from "../controllers/push/push.automation.controller";

/**
 * 트리거 기반 자동 푸시 발송 관리 라우터
 */
const pushAutomationRouter = Router();

// 관리자 권한 필수
pushAutomationRouter.use(requireAdmin);

// 규칙 목록 조회
pushAutomationRouter.get("/", pushAutomationController.getRules);

// 통합된 테스트 푸시 (운영자 테스트용)
pushAutomationRouter.post("/test-send", pushAutomationController.testSend);

// 규칙 생성
pushAutomationRouter.post("/", pushAutomationController.createRule);

// 규칙 수정 (상태 변경 등)
pushAutomationRouter.patch("/:id", pushAutomationController.updateRule);

// 규칙 삭제
pushAutomationRouter.delete("/:id", pushAutomationController.deleteRule);

export default pushAutomationRouter;
