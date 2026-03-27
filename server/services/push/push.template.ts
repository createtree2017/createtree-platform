/**
 * 푸시 알림 메시지 템플릿 팩토리
 * 각 이벤트 타입별 {notification, data} 페이로드를 생성
 */

interface PushPayload {
  notification: { title: string; body: string };
  data?: Record<string, string>;
}

/** 미션 승인 알림 */
export function missionApprovedPayload(missionTitle: string, actionUrl: string): PushPayload {
  return {
    notification: {
      title: '✅ 미션 승인 완료',
      body: `"${missionTitle}" 미션이 승인되었습니다!`,
    },
    data: {
      type: 'mission_approved',
      action_url: actionUrl,
    },
  };
}

/** 미션 반려 알림 */
export function missionRejectedPayload(missionTitle: string, reason: string, actionUrl: string): PushPayload {
  return {
    notification: {
      title: '❌ 미션 반려',
      body: `"${missionTitle}" 미션이 반려되었습니다. 사유: ${reason}`,
    },
    data: {
      type: 'mission_rejected',
      action_url: actionUrl,
      reason,
    },
  };
}

/** 등급 업 알림 */
export function gradeUpPayload(newGrade: string): PushPayload {
  return {
    notification: {
      title: '🎉 등급 업!',
      body: `축하합니다! ${newGrade} 등급으로 승급했습니다!`,
    },
    data: {
      type: 'grade_up',
      action_url: '/my-profile',
      new_grade: newGrade,
    },
  };
}

/** 시스템 공지 */
export function systemNoticePayload(title: string, body: string, actionUrl?: string): PushPayload {
  return {
    notification: { title, body },
    data: {
      type: 'system_notice',
      action_url: actionUrl || '/',
    },
  };
}

/** 선물 수령 알림 */
export function giftReceivedPayload(giftName: string): PushPayload {
  return {
    notification: {
      title: '🎁 선물이 도착했습니다!',
      body: `"${giftName}" 선물을 확인해보세요.`,
    },
    data: {
      type: 'gift_received',
      action_url: '/my-gifts',
    },
  };
}

/** 관리자 수동 발송 (제목/본문 직접 입력) */
export function adminManualPayload(title: string, body: string, actionUrl?: string, imageUrl?: string): PushPayload {
  const data: Record<string, string> = {
    type: 'admin_manual',
    action_url: actionUrl || '/',
  };
  if (imageUrl) {
    data.image_url = imageUrl;
  }
  return {
    notification: { title, body },
    data,
  };
}
