import { db } from '@db';
import { autoPushRules, AutoPushRule, users } from '../../../shared/schema';
import { eq, or, and, desc, sql } from 'drizzle-orm';
import { createNotification } from '../notifications';

/**
 * 템플릿의 {{변수}} 를 실제 값으로 치환하는 헬퍼 함수
 */
function interpolateTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

export class PushAutomationService {
  /**
   * 이벤트 트리거 시 조건에 맞는 Rule을 조회하고 푸시를 발송합니다.
   * 
   * @param userId 알림을 받을 유저의 ID
   * @param eventType 이벤트 종류 (예: 'mission_approved')
   * @param variables 치환할 변수 (디폴트로 {{userName}}은 자동 지원)
   */
  async evaluateAndSend(
    userId: number,
    eventType: string,
    variables: Record<string, string> = {}
  ): Promise<boolean> {
    try {
      // 1. 유저 정보 조회 (hospitalId, displayName 등)
      const userResult = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { hospitalId: true, fullName: true, username: true, memberType: true }
      });
      
      const userHospitalId = userResult?.hospitalId || null;
      const isSuperadmin = userResult?.memberType === 'superadmin';
      variables['userName'] = variables['userName'] || userResult?.fullName || userResult?.username || '회원';

      // 2. 해당 이벤트에 대한 On 상태의 Rule 쿼리 (병원 매핑 or 공통 매핑)

      // 3. 일치하는 모든 규칙 조회
      // Query builder needs proper format, fallback to simpler query
      const rules = await db.query.autoPushRules.findMany({
        where: (table, { eq, and, or, isNull }) => {
          const conditions = [
            eq(table.eventType, eventType),
            eq(table.isActive, true)
          ];
          
          let hospitalCondition;
          if (isSuperadmin) {
             // 슈퍼관리자는 전체-1, 자신의 병원, 또는 개발전용(-2) 룰 매칭 가능
             const baseConds = [isNull(table.hospitalId), eq(table.hospitalId, -2)];
             if (userHospitalId) baseConds.push(eq(table.hospitalId, userHospitalId));
             
             hospitalCondition = or(...baseConds);
          } else if (userHospitalId) {
             // 일반 회원은 전체 또는 자신의 병원 룰만 매칭
             hospitalCondition = or(
               isNull(table.hospitalId),
               eq(table.hospitalId, userHospitalId)
             );
          } else {
             hospitalCondition = isNull(table.hospitalId);
          }
          
          return and(...conditions, hospitalCondition);
        },
        // orderBy는 JS에서 보다 정밀하게 처리하기 위해 생략 hoặc 기본 정렬
      });

      if (rules.length === 0) {
        // 매칭되는 규칙이 없음 (발송 취소)
        return false;
      }

      // 4. JS 단에서 정렬: 개발전용(-2) 최우선 -> 우선순위(priority) -> 병원전용 -> 공통(null)
      rules.sort((a, b) => {
        // 1. 개발 전용 룰이 무조건 1순위
        if (a.hospitalId === -2 && b.hospitalId !== -2) return -1;
        if (b.hospitalId === -2 && a.hospitalId !== -2) return 1;
        
        // 2. 관리자가 입력한 priority 기준
        if (a.priority !== b.priority) return b.priority - a.priority;
        
        // 3. 병원 특정 룰이 공통 룰(null)보다 우선
        if (a.hospitalId !== null && b.hospitalId === null) return -1;
        if (a.hospitalId === null && b.hospitalId !== null) return 1;
        
        return 0;
      });

      const targetRule: AutoPushRule = rules[0];

      // 5. 변수 치환
      const finalTitle = interpolateTemplate(targetRule.titleTemplate, variables);
      const finalBody = interpolateTemplate(targetRule.bodyTemplate, variables);
      const actionUrl = targetRule.actionUrlTemplate ? interpolateTemplate(targetRule.actionUrlTemplate, variables) : undefined;

      // 6. 알림 발송 (테이블 저장 + FCM)
      await createNotification({
        userId: String(userId),
        type: targetRule.category || 'system',
        title: finalTitle,
        message: finalBody,
        actionUrl: actionUrl || undefined,
        // 기타 data payload 필요시 추가
      });

      // 7. 통계 업데이트 (비동기 처리)
      this.incrementSentCount(targetRule.id).catch(err => {
        console.error('[PushAutomation] 통계 업데이트 실패:', err);
      });

      return true;
    } catch (error) {
      console.error(`[PushAutomation] evaluateAndSend 에러 (${eventType}):`, error);
      return false;
    }
  }

  private async incrementSentCount(ruleId: number): Promise<void> {
    // raw query fallback or ORM direct update
    // using findFirst + update since drizzle doesn't easily support syntax like sentCount = sentCount + 1 out of the box without sql
    await db.execute(
      sql`UPDATE auto_push_rules SET sent_count = sent_count + 1, last_sent_at = NOW() WHERE id = ${ruleId}`
    );
  }

  // --- CRUD 메서드 (관리자용) ---

  async getRules() {
    return db.query.autoPushRules.findMany({
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });
  }

  async createRule(data: Partial<AutoPushRule>) {
    return db.insert(autoPushRules).values(data as any).returning();
  }

  async updateRule(id: number, data: Partial<AutoPushRule>) {
    return db.update(autoPushRules).set({...data, updatedAt: new Date()}).where(eq(autoPushRules.id, id)).returning();
  }

  async deleteRule(id: number) {
    return db.delete(autoPushRules).where(eq(autoPushRules.id, id)).returning();
  }
}

export const pushAutomationService = new PushAutomationService();
