import { Request, Response } from 'express';
import { pushAutomationService } from '../../services/push/push.automation.service';

/**
 * 트리거 기반 자동 푸시 발송 관리용 컨트롤러
 * (관리자 페이지 연동용)
 */
export const pushAutomationController = {
  // [GET] 목록 조회
  getRules: async (req: Request, res: Response) => {
    try {
      const rules = await pushAutomationService.getRules();
      res.json(rules);
    } catch (error) {
      console.error('[PushAutomationController] getRules 에러:', error);
      res.status(500).json({ error: 'Failed to fetch auto push rules' });
    }
  },

  // [POST] 규칙 생성
  createRule: async (req: Request, res: Response) => {
    try {
      const { id, createdAt, updatedAt, sentCount, lastSentAt, ...validData } = req.body;
      const result = await pushAutomationService.createRule(validData);
      res.status(201).json(result[0]);
    } catch (error) {
      console.error('[PushAutomationController] createRule 에러:', error);
      res.status(400).json({ error: 'Failed to create auto push rule' });
    }
  },

  // [PATCH] 규칙 수정 (Toggle On/Off 등)
  updateRule: async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { id: _id, createdAt, updatedAt, sentCount, lastSentAt, ...validData } = req.body;
      
      const result = await pushAutomationService.updateRule(id, validData);
      if (result.length === 0) {
        return res.status(404).json({ error: 'Rule not found' });
      }
      
      res.json(result[0]);
    } catch (error) {
      console.error('[PushAutomationController] updateRule 에러:', error);
      res.status(400).json({ error: 'Failed to update auto push rule' });
    }
  },

  // [DELETE] 규칙 삭제
  deleteRule: async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      const result = await pushAutomationService.deleteRule(id);
      if (result.length === 0) {
        return res.status(404).json({ error: 'Rule not found' });
      }
      
      res.json({ message: 'Deleted successfully' });
    } catch (error) {
      console.error('[PushAutomationController] deleteRule 에러:', error);
      res.status(500).json({ error: 'Failed to delete auto push rule' });
    }
  },

  // [POST] 관리자 기기로 테스트 발송
  testSend: async (req: Request, res: Response) => {
    try {
      const { ruleId, targetToken } = req.body; // 나중에 고도화
      // 간단히 현재 로그인한 어드민 본인에게 쏴줄 수도 있음.
      // 일단 API 껍데기만 먼저 구성
      res.json({ message: 'Not implemented testing directly yet' });
    } catch (error) {
      console.error('[PushAutomationController] testSend 에러:', error);
      res.status(500).json({ error: 'Failed to test auto push rule' });
    }
  }
};
