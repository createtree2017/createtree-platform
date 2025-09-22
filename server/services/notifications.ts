/**
 * 알림 시스템 서비스 함수들
 * Phase 5: 참여형 마일스톤 알림 시스템
 */

import { db } from '@db';
import { 
  notifications, 
  notificationSettings, 
  milestoneApplications,
  Notification,
  NotificationInsert,
  NotificationSettings
} from '@shared/schema.ts';
import { eq, desc, and } from 'drizzle-orm';

/**
 * 알림 생성 (범용)
 */
export async function createNotification(data: {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
}): Promise<Notification> {
  try {
    const [notification] = await db
      .insert(notifications)
      .values({
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data ? JSON.parse(JSON.stringify(data.data)) : null,
        isRead: false,
      })
      .returning();

    return notification as Notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * 사용자 알림 목록 조회
 */
export async function getUserNotifications(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  } = {}
): Promise<{ notifications: Notification[]; unreadCount: number }> {
  try {
    const { limit = 20, offset = 0, unreadOnly = false } = options;

    // 알림 목록 조회
    const whereConditions = [eq(notifications.userId, userId)];
    if (unreadOnly) {
      whereConditions.push(eq(notifications.isRead, false));
    }

    const userNotifications = await db.query.notifications.findMany({
      where: and(...whereConditions),
      orderBy: desc(notifications.createdAt),
      limit,
      offset,
    });

    // 읽지 않은 알림 개수 조회
    const unreadNotifications = await db.query.notifications.findMany({
      where: and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      )
    });

    return {
      notifications: userNotifications.map(n => ({
        ...n,
        data: n.data as any
      })) as Notification[],
      unreadCount: unreadNotifications.length
    };
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
}

/**
 * 알림 읽음 처리
 */
export async function markNotificationAsRead(
  notificationId: number,
  userId: string
): Promise<Notification | null> {
  try {
    const [updatedNotification] = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date()
      })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ))
      .returning();

    return updatedNotification ? {
      ...updatedNotification,
      data: updatedNotification.data as any
    } as Notification : null;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

/**
 * 모든 알림 읽음 처리
 */
export async function markAllNotificationsAsRead(userId: string): Promise<number> {
  try {
    const result = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date()
      })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ))
      .returning();

    return result.length;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
}

/**
 * 알림 삭제
 */
export async function deleteNotification(
  notificationId: number,
  userId: string
): Promise<boolean> {
  try {
    const result = await db
      .delete(notifications)
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ))
      .returning();

    return result.length > 0;
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
}

// ===== 참여형 마일스톤 전용 알림 함수들 =====

/**
 * 마일스톤 신청 알림 생성
 */
export async function createApplicationNotification(
  userId: string,
  milestoneTitle: string,
  hospitalName: string
): Promise<Notification> {
  return createNotification({
    userId,
    type: 'milestone_application',
    title: '참여형 마일스톤 신청 완료',
    message: `"${milestoneTitle}" 캠페인 신청이 완료되었습니다. ${hospitalName}에서 검토 후 연락드립니다.`,
    data: { milestoneTitle, hospitalName }
  });
}

/**
 * 마일스톤 승인 알림 생성
 */
export async function createApplicationApprovedNotification(
  userId: string,
  milestoneTitle: string,
  hospitalName: string,
  notes?: string
): Promise<Notification> {
  const message = notes 
    ? `"${milestoneTitle}" 캠페인 참여가 승인되었습니다! ${hospitalName} 메모: ${notes}`
    : `"${milestoneTitle}" 캠페인 참여가 승인되었습니다! ${hospitalName}에서 곧 연락드립니다.`;

  return createNotification({
    userId,
    type: 'application_approved',
    title: '🎉 참여형 마일스톤 승인',
    message,
    data: { milestoneTitle, hospitalName, notes }
  });
}

/**
 * 마일스톤 거절 알림 생성
 */
export async function createApplicationRejectedNotification(
  userId: string,
  milestoneTitle: string,
  hospitalName: string,
  notes?: string
): Promise<Notification> {
  const message = notes
    ? `"${milestoneTitle}" 캠페인 참여가 아쉽게도 선정되지 않았습니다. ${hospitalName} 메모: ${notes}`
    : `"${milestoneTitle}" 캠페인 참여가 아쉽게도 선정되지 않았습니다. 다음 기회에 다시 도전해주세요.`;

  return createNotification({
    userId,
    type: 'application_rejected',
    title: '참여형 마일스톤 결과',
    message,
    data: { milestoneTitle, hospitalName, notes }
  });
}

/**
 * 캠페인 시작 알림 생성
 */
export async function createCampaignStartNotification(
  userId: string,
  milestoneTitle: string,
  hospitalName: string
): Promise<Notification> {
  return createNotification({
    userId,
    type: 'campaign_start',
    title: '🚀 참여형 마일스톤 시작',
    message: `"${milestoneTitle}" 캠페인이 시작되었습니다! ${hospitalName}에서 준비한 특별한 프로그램에 참여하세요.`,
    data: { milestoneTitle, hospitalName }
  });
}

/**
 * 캠페인 마감 임박 알림 생성
 */
export async function createCampaignDeadlineNotification(
  userId: string,
  milestoneTitle: string,
  hospitalName: string,
  daysLeft: number
): Promise<Notification> {
  return createNotification({
    userId,
    type: 'campaign_deadline',
    title: '⏰ 참여형 마일스톤 마감 임박',
    message: `"${milestoneTitle}" 캠페인 신청이 ${daysLeft}일 후 마감됩니다. ${hospitalName}의 특별한 프로그램에 놓치지 말고 참여하세요!`,
    data: { milestoneTitle, hospitalName, daysLeft }
  });
}

// ===== 알림 설정 관리 =====

/**
 * 사용자 알림 설정 조회
 */
export async function getUserNotificationSettings(userId: string): Promise<NotificationSettings | null> {
  try {
    const settings = await db.query.notificationSettings.findFirst({
      where: eq(notificationSettings.userId, userId)
    });

    return settings || null;
  } catch (error) {
    console.error('Error getting notification settings:', error);
    throw error;
  }
}

/**
 * 사용자 알림 설정 생성/업데이트
 */
export async function updateNotificationSettings(
  userId: string,
  settings: Partial<NotificationSettings>
): Promise<NotificationSettings> {
  try {
    // 기존 설정 확인
    const existingSettings = await getUserNotificationSettings(userId);

    if (existingSettings) {
      // 업데이트
      const [updatedSettings] = await db
        .update(notificationSettings)
        .set({
          ...settings,
          updatedAt: new Date()
        })
        .where(eq(notificationSettings.userId, userId))
        .returning();

      return updatedSettings;
    } else {
      // 새로 생성
      const [newSettings] = await db
        .insert(notificationSettings)
        .values({
          userId,
          ...settings
        })
        .returning();

      return newSettings;
    }
  } catch (error) {
    console.error('Error updating notification settings:', error);
    throw error;
  }
}

/**
 * 알림 허용 여부 확인
 */
export async function shouldSendNotification(
  userId: string,
  notificationType: string
): Promise<boolean> {
  try {
    const settings = await getUserNotificationSettings(userId);
    
    // 설정이 없으면 기본적으로 모든 알림 허용
    if (!settings) {
      return true;
    }

    // 알림 타입별 확인
    switch (notificationType) {
      case 'milestone_application':
        return settings.milestoneApplications ?? true;
      case 'application_approved':
      case 'application_rejected':
        return settings.applicationStatusChanges ?? true;
      case 'campaign_start':
      case 'campaign_deadline':
        return settings.campaignReminders ?? true;
      case 'campaign_update':
        return settings.campaignUpdates ?? true;
      case 'system_notification':
        return settings.systemNotifications ?? true;
      default:
        return true; // 알 수 없는 타입은 기본 허용
    }
  } catch (error) {
    console.error('Error checking notification permission:', error);
    return true; // 오류 시 기본 허용
  }
}