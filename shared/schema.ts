import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";
// 태몽동화 모듈 제거됨 (테이블 삭제로 인해)

// 🎯 간단한 작은 배너 시스템 (메인 슬라이드 배너와 동일한 구조)
export const smallBanners = pgTable("small_banners", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("imageUrl").notNull(),
  linkUrl: text("linkUrl"), // 클릭 시 이동할 URL
  isActive: boolean("isActive").default(true),
  order: integer("order").default(0), // 정렬 순서
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User table - 확장된 사용자 테이블
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password"),  // 소셜 로그인 사용자는 비밀번호 없을 수 있음
  email: varchar("email", { length: 255 }).unique(),
  fullName: varchar("full_name", { length: 100 }),
  emailVerified: boolean("email_verified").default(false),
  memberType: varchar("member_type", { length: 20 }).default("free"),  // free, pro, membership, hospital_admin, admin, superadmin
  hospitalId: integer("hospital_id"),
  promoCode: varchar("promo_code", { length: 50 }),
  lastLogin: timestamp("last_login"),
  phoneNumber: varchar("phone_number", { length: 20 }),  // 전화번호 추가
  dueDate: timestamp("due_date"),  // 출산예정일 추가
  // 생년월일 추가
  birthdate: timestamp("birthdate"),
  // Firebase 연동 필드 추가
  firebaseUid: varchar("firebase_uid", { length: 128 }).unique(),  // Firebase 고유 ID이스에 이 컬럼이 없음)
  // 프로필 완성 여부 필드 추가
  needProfileComplete: boolean("need_profile_complete").default(true),
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 사용자 알림 설정 테이블
export const userNotificationSettings = pgTable("user_notification_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  emailNotifications: boolean("email_notifications").default(true),
  pushNotifications: boolean("push_notifications").default(true),
  pregnancyReminders: boolean("pregnancy_reminders").default(true),
  weeklyUpdates: boolean("weekly_updates").default(true),
  promotionalEmails: boolean("promotional_emails").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 사용자 개인 설정 테이블
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  theme: varchar("theme", { length: 20 }).default("light"), // light, dark, system
  language: varchar("language", { length: 10 }).default("ko"), // ko, en
  timezone: varchar("timezone", { length: 50 }).default("Asia/Seoul"),
  dateFormat: varchar("date_format", { length: 20 }).default("YYYY-MM-DD"),
  autoSave: boolean("auto_save").default(true),
  showTutorials: boolean("show_tutorials").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 병원 (Hospital) 테이블
export const hospitals = pgTable("hospitals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),  // 병원 고유 슬러그 (URL용 식별자)
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  domain: text("domain"), // 커스텀 도메인
  logoUrl: text("logo_url"), // 병원 로고 URL
  themeColor: text("theme_color"), // 테마 색상
  contractStartDate: timestamp("contract_start_date"), // 계약 시작일
  contractEndDate: timestamp("contract_end_date"), // 계약 종료일
  packageType: text("package_type").default("basic"), // basic, premium, enterprise
  isActive: boolean("is_active").notNull().default(true), // 계약 활성화 상태
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 역할 (Role) 테이블
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // user, admin, hospital_admin, superadmin
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 병원-회원 관계 테이블
export const hospitalMembers = pgTable("hospital_members", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  hospitalId: integer("hospital_id").references(() => hospitals.id),
  role: text("role").$type<"patient" | "staff">().default("patient"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 병원 인증 코드 테이블 (QR 인증 시스템용)
export const hospitalCodes = pgTable("hospital_codes", {
  id: serial("id").primaryKey(),
  hospitalId: integer("hospital_id").notNull().references(() => hospitals.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 20 }).notNull().unique(),
  codeType: varchar("code_type", { length: 20 }).notNull().$type<"master" | "limited" | "qr_unlimited" | "qr_limited">(),

  // 인원 제어
  maxUsage: integer("max_usage"), // NULL이면 무제한
  currentUsage: integer("current_usage").notNull().default(0),

  // QR 전용 설정
  isQREnabled: boolean("is_qr_enabled").notNull().default(false),
  qrDescription: varchar("qr_description", { length: 100 }),

  // 상태 관리
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 사용자-역할 매핑 테이블 (다대다 관계)
export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 리프레시 토큰 테이블
export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 비밀번호 재설정 토큰 테이블
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 이메일 인증 토큰 테이블
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Music table - TopMediai 3단계 워크플로우 지원
export const music = pgTable("music", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),

  prompt: text("prompt").notNull(),                  // 사용자 프롬프트
  style: text("style"),                              // 음악 스타일 (NULL 허용)
  translatedPrompt: text("translated_prompt"),       // 영어로 번역된 프롬프트
  tags: jsonb("tags").default("[]"),                 // 스타일 태그 목록
  url: text("url"),                                  // 최종 오디오 파일 URL (완료 시에만 설정)
  lyrics: text("lyrics"),                            // 생성된 가사 (1단계 결과)
  instrumental: boolean("instrumental").default(false), // 반주 전용 여부
  duration: integer("duration").notNull().default(60), // 음악 길이(초)
  userId: integer("user_id"),                        // 사용자 ID
  provider: text("provider").default("topmedia"),    // 음악 생성 서비스 제공자
  creditUsed: integer("credit_used").default(1),     // 사용된 크레딧

  // 이중 엔진 시스템 필드
  engine: varchar("engine", { length: 20 }).default("topmedia"), // 사용된 엔진: topmedia, suno
  engineTaskId: varchar("engine_task_id", { length: 100 }),      // 엔진별 작업 ID
  fallbackUsed: boolean("fallback_used").default(false),         // 폴백 엔진 사용 여부
  gcsPath: varchar("gcs_path", { length: 500 }),                 // GCS 저장 경로
  contentType: varchar("content_type", { length: 50 }).default("audio/mpeg"), // MIME 타입
  durationSec: integer("duration_sec"),                          // 실제 음악 길이(초)

  // TopMediai 3단계 워크플로우 필드
  status: text("status").default("pending"),          // pending → processing → done/error
  songId: text("song_id"),                           // TopMediai API에서 반환된 song_id (2단계)
  generateLyrics: boolean("generate_lyrics").default(false), // 가사 자동 생성 여부
  gender: text("gender"),                            // 가수 성별 (female/male/child/auto)

  hospitalId: integer("hospital_id").references(() => hospitals.id), // 병원 ID
  metadata: jsonb("metadata").default("{}"),         // 추가 메타데이터
  isFavorite: boolean("is_favorite").default(false), // 즐겨찾기 여부
  isPublic: boolean("is_public").default(false),     // 공개 여부
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});



// Images table
export const images = pgTable("images", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  style: text("style").notNull(),
  originalUrl: text("original_url").notNull(),
  transformedUrl: text("transformed_url").notNull(),
  thumbnailUrl: text("thumbnail_url"), // 썸네일 이미지 URL 추가
  metadata: text("metadata").default("{}"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // 사용자 ID 필드 (varchar로 변경: email 또는 firebase uid 저장 용도)
  userId: varchar("user_id", { length: 128 }),
  // 카테고리 ID 필드 추가 (스티커, 만삭사진, 가족사진 등 구분용)
  categoryId: varchar("category_id", { length: 50 }),
  // 컨셉 ID 필드 추가
  conceptId: varchar("concept_id", { length: 50 }),
  // 스타일 ID 필드 추가
  styleId: varchar("style_id", { length: 50 }),
  // 이미지 크기 및 DPI 정보 (갤러리→에디터 복사 시 다운로드 없이 조회 가능)
  width: integer("width"),
  height: integer("height"),
  dpi: integer("dpi"),
  // 원본 파일 검증 상태 (null: 미검증, true: 정상, false: 원본 없음)
  originalVerified: boolean("original_verified"),
});

// ========================================
// 🎯 AI Snapshot Generator Tables
// ========================================

// Snapshot Prompts table - Database-driven prompt management
export const snapshotPrompts = pgTable('snapshot_prompts', {
  id: serial('id').primaryKey(),
  category: text('category').notNull(), // 'individual', 'couple', 'family'
  type: text('type').notNull(), // 'daily', 'travel', 'film' (no 'mix' - that's user option)
  gender: text('gender'), // 'male', 'female', null (for couple/family)
  region: text('region'), // 'domestic', 'international', null
  season: text('season'), // 'spring', 'summer', 'fall', 'winter', null
  prompt: text('prompt').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  usageCount: integer('usage_count').default(0).notNull(),
  order: integer('order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  categoryTypeIdx: index('snapshot_prompts_category_type_idx').on(table.category, table.type),
  isActiveIdx: index('snapshot_prompts_is_active_idx').on(table.isActive),
  usageCountIdx: index('snapshot_prompts_usage_count_idx').on(table.usageCount)
}));

// Personas table for character management
export const personas = pgTable("personas", {
  id: serial("id").primaryKey(),
  personaId: text("persona_id").notNull().unique(), // String identifier like "maternal-guide"
  name: text("name").notNull(),
  avatarEmoji: text("avatar_emoji").notNull(),
  description: text("description").notNull(),
  welcomeMessage: text("welcome_message").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  primaryColor: text("primary_color").notNull(),
  secondaryColor: text("secondary_color").notNull(),

  // Additional fields from the expanded structure
  personality: text("personality"),
  tone: text("tone"),
  usageContext: text("usage_context"),
  emotionalKeywords: jsonb("emotional_keywords"), // Array of strings
  timeOfDay: text("time_of_day").default("all"),

  // Admin fields
  isActive: boolean("is_active").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  order: integer("order").default(0),

  // Usage statistics
  useCount: integer("use_count").notNull().default(0),

  // Categories as JSON array
  categories: jsonb("categories"), // Array of category IDs

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Persona categories table
export const personaCategories = pgTable("persona_categories", {
  id: serial("id").primaryKey(),
  categoryId: text("category_id").notNull().unique(), // String identifier like "pregnancy"
  name: text("name").notNull(),
  description: text("description").notNull(),
  emoji: text("emoji").notNull(),
  order: integer("order").default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Saved chats table
export const savedChats = pgTable("saved_chats", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  personaId: text("persona_id").notNull(),
  personaName: text("persona_name").notNull(),
  personaEmoji: text("persona_emoji").notNull(),
  messages: jsonb("messages").notNull(), // Store chat messages as JSON
  summary: text("summary").notNull(),
  userMemo: text("user_memo"),
  mood: text("mood"), // Emoji representing the mood
  userId: integer("user_id"), // 사용자 ID 추가
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Image Generation Concept Categories
export const conceptCategories = pgTable("concept_categories", {
  id: serial("id").primaryKey(),
  categoryId: text("category_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  systemPrompt: text("system_prompt"),  // GPT-4o에게 이미지 분석을 위한 지침
  order: integer("order").default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Image Generation Concepts
export const concepts = pgTable("concepts", {
  id: serial("id").primaryKey(),
  conceptId: text("concept_id").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  promptTemplate: text("prompt_template").notNull(),
  systemPrompt: text("system_prompt"),  // 이미지 분석 및 변환을 위한 시스템 프롬프트 추가
  thumbnailUrl: text("thumbnail_url"),
  referenceImageUrl: text("reference_image_url"), // PhotoMaker reference image URL
  // OpenAI 이미지 변환 관련 필드만 유지
  tagSuggestions: jsonb("tag_suggestions"), // Array of strings
  variables: jsonb("variables"), // Array of variable objects
  categoryId: text("category_id").references(() => conceptCategories.categoryId),
  // 이미지 생성 방식 선택 필드 추가
  generationType: varchar("generation_type", { length: 20 }).default("image_upload"), // "image_upload" | "text_only"
  // 사용 가능한 AI 모델 선택 필드 추가 (다중 선택)
  availableModels: jsonb("available_models").default(JSON.stringify(["openai", "gemini"])), // ["openai", "gemini"]
  // 모델별 지원 비율 설정 필드 추가
  availableAspectRatios: jsonb("available_aspect_ratios").default(JSON.stringify({ "openai": ["1:1", "2:3", "3:2"], "gemini": ["1:1", "9:16", "16:9"] })), // 모델별 비율 옵션
  // Gemini 3.0 Pro 전용 설정 필드
  gemini3AspectRatio: text("gemini3_aspect_ratio").default("16:9"), // Gemini 3.0 비율 옵션
  gemini3ImageSize: text("gemini3_image_size").default("1K"), // Gemini 3.0 해상도: 1K, 2K, 4K
  // 병원별 공개 설정 필드 추가
  visibilityType: text("visibility_type").default("public"), // "public" | "hospital"
  hospitalId: integer("hospital_id").references(() => hospitals.id), // 병원 전용일 때 대상 병원
  // 배경제거 설정 (컨셉별)
  bgRemovalEnabled: boolean("bg_removal_enabled").notNull().default(false), // 배경제거 사용 여부
  bgRemovalType: text("bg_removal_type").default("foreground"), // "foreground" (인물남김) | "background" (배경남김)
  // 다중 이미지 업로드 설정 (초음파 앨범, 콜라주 등)
  minImageCount: integer("min_image_count").default(1), // 최소 이미지 개수
  maxImageCount: integer("max_image_count").default(1), // 최대 이미지 개수 (1이면 기존 방식)
  enableImageText: boolean("enable_image_text").notNull().default(false), // 이미지별 텍스트 입력 활성화
  isActive: boolean("is_active").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// A/B Testing tables
export const abTests = pgTable("ab_tests", {
  id: serial("id").primaryKey(),
  testId: text("test_id").notNull().unique(),
  conceptId: text("concept_id").references(() => concepts.conceptId),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const abTestVariants = pgTable("ab_test_variants", {
  id: serial("id").primaryKey(),
  testId: text("test_id").references(() => abTests.testId).notNull(),
  variantId: text("variant_id").notNull(),
  name: text("name").notNull(), // e.g., "Variant A", "Variant B"
  promptTemplate: text("prompt_template").notNull(),
  variables: jsonb("variables"), // Array of variable objects (same structure as in concepts)
  impressions: integer("impressions").default(0),
  conversions: integer("conversions").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const abTestResults = pgTable("ab_test_results", {
  id: serial("id").primaryKey(),
  testId: text("test_id").references(() => abTests.testId).notNull(),
  selectedVariantId: text("selected_variant_id").notNull(),
  userId: integer("user_id").references(() => users.id),
  context: jsonb("context"), // Additional info (device, browser, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 마일스톤 카테고리 테이블
export const milestoneCategories = pgTable("milestone_categories", {
  id: serial("id").primaryKey(),
  categoryId: text("category_id").notNull().unique(), // 카테고리 식별자 (예: "baby_development")
  name: text("name").notNull(), // 카테고리 표시 이름 (예: "태아 발달")
  description: text("description"), // 카테고리 설명
  emoji: text("emoji").default("📌"), // 카테고리 대표 이모지
  order: integer("order").default(0), // 표시 순서
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Pregnancy milestone system tables
export const milestones = pgTable("milestones", {
  id: serial("id").primaryKey(),
  milestoneId: text("milestone_id").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  weekStart: integer("week_start").notNull(), // Pregnancy week when milestone starts
  weekEnd: integer("week_end").notNull(), // Pregnancy week when milestone ends
  badgeEmoji: text("badge_emoji").notNull(), // Emoji representing the badge
  badgeImageUrl: text("badge_image_url"), // Optional image URL for the badge
  encouragementMessage: text("encouragement_message").notNull(), // Message to show when milestone is reached
  categoryId: text("category_id").references(() => milestoneCategories.categoryId).notNull(), // 카테고리 참조
  order: integer("order").default(0),
  isActive: boolean("is_active").notNull().default(true),
  // 참여형 마일스톤 확장 필드
  type: varchar("type", { length: 20 }).notNull().default("info"), // 'info' | 'campaign'
  hospitalId: integer("hospital_id").references(() => hospitals.id), // 병원별 마일스톤
  headerImageUrl: text("header_image_url"), // 참여형 마일스톤 헤더 이미지
  // 캠페인 일정 관리
  campaignStartDate: timestamp("campaign_start_date"), // 참여 시작일
  campaignEndDate: timestamp("campaign_end_date"), // 참여 종료일
  selectionStartDate: timestamp("selection_start_date"), // 선정 시작일
  selectionEndDate: timestamp("selection_end_date"), // 선정 종료일
  // 참여 관리 필드 (테스트 호환성)
  participationStartDate: timestamp("participation_start_date"), // 참여 시작일 (테스트용)
  participationEndDate: timestamp("participation_end_date"), // 참여 종료일 (테스트용)
  maxParticipants: integer("max_participants"), // 최대 참여 인원
  currentParticipants: integer("current_participants").default(0), // 현재 참여 인원
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userMilestones = pgTable("user_milestones", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  milestoneId: text("milestone_id").references(() => milestones.milestoneId).notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  notes: text("notes"), // Optional user notes about this milestone
  // photoUrl: text("photo_url"), // (주의: 실제 데이터베이스에 이 컬럼이 없음)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 참여형 마일스톤 신청 관리 테이블
export const milestoneApplications = pgTable("milestone_applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  milestoneId: text("milestone_id").notNull().references(() => milestones.milestoneId, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'
  applicationData: jsonb("application_data").default("{}"), // 사용자 제출 데이터 (파일, 링크 등)
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  processedBy: integer("processed_by").references(() => users.id),
  notes: text("notes"), // 관리자 메모
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pregnancyProfiles = pgTable("pregnancy_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  dueDate: timestamp("due_date").notNull(),
  currentWeek: integer("current_week").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  babyNickname: text("baby_nickname"),
  babyGender: text("baby_gender"), // "boy", "girl", "unknown", "prefer_not_to_say"
  isFirstPregnancy: boolean("is_first_pregnancy"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Phase 6: 파일 업로드 시스템 - 참여형 마일스톤 첨부파일 관리
export const milestoneApplicationFiles = pgTable("milestone_application_files", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull().references(() => milestoneApplications.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(), // 원본 파일명
  fileType: varchar("file_type", { length: 50 }).notNull(), // MIME 타입 (image/jpeg, application/pdf 등)
  fileSize: integer("file_size").notNull(), // 파일 크기 (bytes)
  filePath: text("file_path").notNull(), // 서버 저장 경로 또는 GCS URL
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  uploadedBy: integer("uploaded_by").notNull().references(() => users.id),
  isActive: boolean("is_active").notNull().default(true), // 소프트 삭제용
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 🗑️ 복잡한 AI 스타일카드 시스템 제거됨 - 간단한 배너로 교체

// Define relations for milestone tables
export const milestoneCategoriesRelations = relations(milestoneCategories, ({ many }) => ({
  milestones: many(milestones)
}));

export const milestonesRelations = relations(milestones, ({ many, one }) => ({
  userMilestones: many(userMilestones),
  applications: many(milestoneApplications),
  category: one(milestoneCategories, {
    fields: [milestones.categoryId],
    references: [milestoneCategories.categoryId]
  }),
  hospital: one(hospitals, {
    fields: [milestones.hospitalId],
    references: [hospitals.id]
  })
}));

export const userMilestonesRelations = relations(userMilestones, ({ one }) => ({
  milestone: one(milestones, {
    fields: [userMilestones.milestoneId],
    references: [milestones.milestoneId]
  }),
  user: one(users, {
    fields: [userMilestones.userId],
    references: [users.id]
  })
}));

export const milestoneApplicationsRelations = relations(milestoneApplications, ({ one, many }) => ({
  milestone: one(milestones, {
    fields: [milestoneApplications.milestoneId],
    references: [milestones.milestoneId]
  }),
  user: one(users, {
    fields: [milestoneApplications.userId],
    references: [users.id]
  }),
  processedByUser: one(users, {
    fields: [milestoneApplications.processedBy],
    references: [users.id]
  }),
  // Phase 6: 첨부 파일 관계
  files: many(milestoneApplicationFiles)
}));

export const pregnancyProfilesRelations = relations(pregnancyProfiles, ({ one }) => ({
  user: one(users, {
    fields: [pregnancyProfiles.userId],
    references: [users.id]
  })
}));

// Phase 6: 파일 업로드 관계 정의
export const milestoneApplicationFilesRelations = relations(milestoneApplicationFiles, ({ one }) => ({
  application: one(milestoneApplications, {
    fields: [milestoneApplicationFiles.applicationId],
    references: [milestoneApplications.id]
  }),
  uploadedByUser: one(users, {
    fields: [milestoneApplicationFiles.uploadedBy],
    references: [users.id]
  })
}));

// Hospital and Hospital Codes Relations
export const hospitalsRelations = relations(hospitals, ({ many }) => ({
  hospitalCodes: many(hospitalCodes)
}));

export const hospitalCodesRelations = relations(hospitalCodes, ({ one }) => ({
  hospital: one(hospitals, {
    fields: [hospitalCodes.hospitalId],
    references: [hospitals.id]
  })
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users, {
  username: (schema) => schema.min(3, "사용자명은 최소 3자 이상이어야 합니다."),
  password: (schema) => schema.min(6, "비밀번호는 최소 6자 이상이어야 합니다."), // 비밀번호 최소 길이 완화
  email: (schema) => schema.email("유효한 이메일 주소를 입력해주세요.").optional().nullable()
}).extend({
  // name 필드를 추가로 받아서 fullName에 매핑하기 위한 확장
  name: z.string().optional().nullable(),
  // phoneNumber 필드 추가
  phoneNumber: z.string().optional().nullable(),
  // birthdate 필드 추가
  birthdate: z.string().optional().nullable(),
  // hospitalId를 문자열로 받아서 정수로 변환하기 위한 처리
  hospitalId: z.string().optional().nullable(),
});

export const insertHospitalSchema = createInsertSchema(hospitals);
export const insertRoleSchema = createInsertSchema(roles);

// Hospital 타입 정의 추가
export type InsertHospital = z.infer<typeof insertHospitalSchema>;
export type Hospital = typeof hospitals.$inferSelect;
export const insertUserRoleSchema = createInsertSchema(userRoles);
export const insertRefreshTokenSchema = createInsertSchema(refreshTokens);

export const insertMusicSchema = createInsertSchema(music, {
  title: (schema) => schema.min(2, '제목은 2글자 이상이어야 합니다'),
  prompt: (schema) => schema.min(3, '프롬프트는 3글자 이상이어야 합니다'),
  url: (schema) => schema.url('유효한 URL이어야 합니다')
});
export const insertImageSchema = createInsertSchema(images);

// Snapshot Prompts validation schemas
export const snapshotPromptsInsertSchema = createInsertSchema(snapshotPrompts, {
  category: (schema) => schema.refine(
    (val) => ['individual', 'couple', 'family'].includes(val),
    { message: "Category must be 'individual', 'couple', or 'family'" }
  ),
  type: (schema) => schema.refine(
    (val) => ['daily', 'travel', 'film'].includes(val),
    { message: "Type must be 'daily', 'travel', or 'film' (no 'mix' - that's user option)" }
  ),
  prompt: (schema) => schema.min(10, "Prompt must be at least 10 characters")
});

export const snapshotPromptsSelectSchema = createSelectSchema(snapshotPrompts);
export const snapshotPromptsUpdateSchema = snapshotPromptsInsertSchema.partial();
export type SnapshotPrompt = z.infer<typeof snapshotPromptsSelectSchema>;
export type SnapshotPromptInsert = z.infer<typeof snapshotPromptsInsertSchema>;
export type SnapshotPromptUpdate = z.infer<typeof snapshotPromptsUpdateSchema>;

// 삭제된 테이블들: insertChatMessageSchema, insertFavoriteSchema 제거됨
export const insertSavedChatSchema = createInsertSchema(savedChats);
export const insertPersonaSchema = createInsertSchema(personas);
export const insertPersonaCategorySchema = createInsertSchema(personaCategories);
export const insertConceptSchema = createInsertSchema(concepts, {
  conceptId: (schema) => schema.min(1, "컨셉 ID는 필수입니다"),
  title: (schema) => schema.min(1, "제목은 필수입니다"),
  promptTemplate: (schema) => schema.min(1, "프롬프트 템플릿은 필수입니다"),
  availableModels: () => z.array(z.enum(["openai", "gemini", "gemini_3"])).min(1, "최소 1개 이상의 AI 모델을 선택해야 합니다").optional(),
  availableAspectRatios: () => z.record(z.string(), z.array(z.string())).optional(),
});
export const insertConceptCategorySchema = createInsertSchema(conceptCategories);
export const insertAbTestSchema = createInsertSchema(abTests);
export const insertAbTestVariantSchema = createInsertSchema(abTestVariants);
export const insertAbTestResultSchema = createInsertSchema(abTestResults);
export const insertMilestoneCategorySchema = createInsertSchema(milestoneCategories, {
  categoryId: (schema) => schema.min(2, '카테고리 ID는 2글자 이상이어야 합니다'),
  name: (schema) => schema.min(2, '카테고리 이름은 2글자 이상이어야 합니다'),
});
export const insertMilestoneSchema = createInsertSchema(milestones, {
  type: (schema) => schema.refine(val => ['info', 'campaign'].includes(val), {
    message: "타입은 'code> 또는 'campaign'이어야 합니다"
  }),
  title: (schema) => schema.min(2, "제목은 2글자 이상이어야 합니다"),
  description: (schema) => schema.min(10, "설명은 10글자 이상이어야 합니다")
});

export const insertMilestoneApplicationSchema = createInsertSchema(milestoneApplications, {
  status: (schema) => schema.refine(val => ['pending', 'approved', 'rejected', 'cancelled', 'expired'].includes(val), {
    message: "상태는 'pending', 'approved', 'rejected', 'cancelled', 'expired' 중 하나여야 합니다"
  })
});

// 타입 정의
export type MilestoneCategory = typeof milestoneCategories.$inferSelect;
export type MilestoneCategoryInsert = typeof milestoneCategories.$inferInsert;
export type Milestone = typeof milestones.$inferSelect;
export type MilestoneInsert = typeof milestones.$inferInsert;
export type MilestoneApplication = typeof milestoneApplications.$inferSelect;
export type MilestoneApplicationInsert = typeof milestoneApplications.$inferInsert;
export const insertUserMilestoneSchema = createInsertSchema(userMilestones);
export const insertPregnancyProfileSchema = createInsertSchema(pregnancyProfiles);

// ===============================================
// Dream Book 이미지 일관성 고도화 테이블들
// ===============================================

// 1-1) style_templates 테이블 - 스타일 템플릿 관리
export const styleTemplates = pgTable("style_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // 스타일 이름 (예: "디즈니풍", "지브리풍")
  prompt: text("prompt").notNull(), // 스타일 프롬프트
  thumbnailUrl: text("thumbnail_url"), // 썸네일 이미지 URL
  isDefault: boolean("is_default").notNull().default(false), // 기본 스타일 여부
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 1-2) global_prompt_rules 테이블 - 전역 프롬프트 규칙 관리
export const globalPromptRules = pgTable("global_prompt_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // 규칙 이름 (예: "기본 비율 설정")
  jsonRules: jsonb("json_rules").notNull(), // JSON 형태의 규칙 (ratio, subject, extra 등)
  isActive: boolean("is_active").notNull().default(false), // 활성화 여부 (항상 1개만 활성화)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Zod 스키마 생성
export const insertStyleTemplateSchema = createInsertSchema(styleTemplates, {
  name: (schema) => schema.min(2, "스타일 이름은 2글자 이상이어야 합니다"),
  prompt: (schema) => schema.min(10, "프롬프트는 10글자 이상이어야 합니다")
});

export const insertGlobalPromptRuleSchema = createInsertSchema(globalPromptRules, {
  name: (schema) => schema.min(2, "규칙 이름은 2글자 이상이어야 합니다"),
  jsonRules: (schema) => schema.refine(
    (val) => {
      try {
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        return typeof parsed === 'object' && parsed !== null;
      } catch {
        return false;
      }
    },
    { message: "유효한 JSON 형태여야 합니다" }
  )
});

// 타입 정의
export type StyleTemplate = typeof styleTemplates.$inferSelect;
export type StyleTemplateInsert = typeof styleTemplates.$inferInsert;
export type GlobalPromptRule = typeof globalPromptRules.$inferSelect;
export type GlobalPromptRuleInsert = typeof globalPromptRules.$inferInsert;

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// 인증 관련 타입
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;

export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;

export type InsertRefreshToken = z.infer<typeof insertRefreshTokenSchema>;
export type RefreshToken = typeof refreshTokens.$inferSelect;

// Milestone types
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;

export type InsertUserMilestone = z.infer<typeof insertUserMilestoneSchema>;
export type UserMilestone = typeof userMilestones.$inferSelect;

export type InsertPregnancyProfile = z.infer<typeof insertPregnancyProfileSchema>;
export type PregnancyProfile = typeof pregnancyProfiles.$inferSelect;

export type InsertMusic = z.infer<typeof insertMusicSchema>;
export type Music = typeof music.$inferSelect;

export type InsertImage = z.infer<typeof insertImageSchema>;
export type Image = typeof images.$inferSelect;

// 삭제된 테이블들의 타입 정의 제거됨: ChatMessage, Favorite

export type InsertSavedChat = z.infer<typeof insertSavedChatSchema>;
export type SavedChat = typeof savedChats.$inferSelect;

export type InsertPersona = z.infer<typeof insertPersonaSchema>;
export type Persona = typeof personas.$inferSelect;

export type InsertPersonaCategory = z.infer<typeof insertPersonaCategorySchema>;
export type PersonaCategory = typeof personaCategories.$inferSelect;

export type InsertConcept = z.infer<typeof insertConceptSchema>;
export type Concept = typeof concepts.$inferSelect;

export type InsertConceptCategory = z.infer<typeof insertConceptCategorySchema>;
export type ConceptCategory = typeof conceptCategories.$inferSelect;

export type InsertAbTest = z.infer<typeof insertAbTestSchema>;
export type AbTest = typeof abTests.$inferSelect;

export type InsertAbTestVariant = z.infer<typeof insertAbTestVariantSchema>;
export type AbTestVariant = typeof abTestVariants.$inferSelect;

export type InsertAbTestResult = z.infer<typeof insertAbTestResultSchema>;
export type AbTestResult = typeof abTestResults.$inferSelect;

// 배너 데이터 스키마
export const banners = pgTable("banners", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  imageSrc: text("image_src").notNull(),
  href: text("href").notNull(),
  isNew: boolean("is_new").default(false),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  slideInterval: integer("slide_interval").default(5000), // 슬라이드 시간 (밀리초)
  transitionEffect: text("transition_effect").default("fade"), // 전환 효과: fade, slide, zoom, cube, flip
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBannerSchema = createInsertSchema(banners);
export type InsertBanner = z.infer<typeof insertBannerSchema>;
export type Banner = typeof banners.$inferSelect;

// 🗑️ 기존 스타일 카드 시스템 제거됨 - 새로운 컨셉 관리 시스템 사용

// 메인 메뉴 테이블 (하단 네비게이션 메뉴 관리)
export const mainMenus = pgTable("main_menus", {
  id: serial("id").primaryKey(),
  menuId: text("menu_id").notNull().unique(), // 'my-missions', 'culture-center', 'ai-create', 'gallery', 'my-page'
  title: text("title").notNull(),             // '나의미션', '문화센터', 'AI 생성', '갤러리', 'MY'
  icon: text("icon").notNull(),               // Lucide 아이콘 이름: 'Trophy', 'Target', 'Sparkles', 'Images', 'User'
  path: text("path").notNull(),               // 기본 경로: '/mymissions', '/missions', '/', '/gallery', '/profile'

  // 홈 설정: 전용 홈 vs 하위메뉴 중 선택
  homeType: text("home_type").notNull().default("dedicated"), // 'dedicated' | 'submenu'
  homeSubmenuPath: text("home_submenu_path"),  // homeType='submenu'일 때 이동할 경로

  isActive: boolean("is_active").notNull().default(true),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 서비스 카테고리 테이블 (사이드바 메뉴 관리)
export const serviceCategories = pgTable("service_categories", {
  id: serial("id").primaryKey(),
  categoryId: text("category_id").notNull().unique(), // 'image', 'music', 'chat' 등 카테고리 식별자
  title: text("title").notNull(), // 표시될 카테고리 제목
  isPublic: boolean("is_public").notNull().default(true), // 공개/비공개 설정
  icon: text("icon").notNull(), // Lucide 아이콘 이름
  order: integer("order").notNull().default(0), // 표시 순서
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// 서비스 항목 테이블 (하위 메뉴)
export const serviceItems = pgTable("service_items", {
  id: serial("id").primaryKey(),
  itemId: text("item_id").notNull().unique(), // 고유 식별자 (maternity-photo 등)
  title: text("title").notNull(), // 항목 이름 표시용 (만삭사진 만들기 등)
  description: text("description"), // 항목 설명
  path: text("path"), // 라우팅 경로 (/maternity-photo 등) - 자동 생성됨
  icon: text("icon").notNull(), // 아이콘 (Lucide 아이콘 이름)
  categoryId: integer("category_id").notNull().references(() => serviceCategories.id, { onDelete: "cascade" }), // 부모 카테고리 ID
  isPublic: boolean("is_public").notNull().default(true), // 공개 여부
  order: integer("order").default(0), // 표시 순서
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  mainMenuId: integer("main_menu_id").references(() => mainMenus.id), // 소속 메인 메뉴 (선택적)
});

// 관계 설정
export const serviceCategoriesRelations = relations(serviceCategories, ({ many }) => ({
  items: many(serviceItems)
}));

export const serviceItemsRelations = relations(serviceItems, ({ one }) => ({
  category: one(serviceCategories, {
    fields: [serviceItems.categoryId],
    references: [serviceCategories.id]
  }),
  mainMenu: one(mainMenus, {
    fields: [serviceItems.mainMenuId],
    references: [mainMenus.id]
  })
}));

export const mainMenusRelations = relations(mainMenus, ({ many }) => ({
  serviceItems: many(serviceItems)
}));

export const insertServiceCategorySchema = createInsertSchema(serviceCategories);
export type InsertServiceCategory = z.infer<typeof insertServiceCategorySchema>;
export type ServiceCategory = typeof serviceCategories.$inferSelect;

export const insertServiceItemSchema = createInsertSchema(serviceItems);
export type InsertServiceItem = z.infer<typeof insertServiceItemSchema>;
export type ServiceItem = typeof serviceItems.$inferSelect;

export const insertMainMenuSchema = createInsertSchema(mainMenus);
export type InsertMainMenu = z.infer<typeof insertMainMenuSchema>;
export type MainMenu = typeof mainMenus.$inferSelect;

// 병원 코드 스키마 생성 - 기본 스키마
const baseInsertHospitalCodeSchema = createInsertSchema(hospitalCodes);

// 병원 코드 스키마 - 커스텀 검증 추가
export const insertHospitalCodeSchema = baseInsertHospitalCodeSchema.extend({
  code: z.string().refine(
    (val) => val === "" || val.length >= 6,
    { message: "코드는 빈 문자열(자동생성) 또는 최소 6자 이상이어야 합니다" }
  ),
  codeType: z.enum(["master", "limited", "qr_unlimited", "qr_limited"], {
    errorMap: () => ({ message: "유효한 코드 타입이어야 합니다" })
  }),
  qrDescription: z.string().min(2, "QR 설명은 최소 2자 이상이어야 합니다").optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
});

export type HospitalCode = typeof hospitalCodes.$inferSelect;
export type HospitalCodeInsert = z.infer<typeof insertHospitalCodeSchema>;




// 이미지 스타일 정의 테이블 추가
export const imageStyles = pgTable("image_styles", {
  id: serial("id").primaryKey(),
  styleId: text("style_id").unique(), // 스타일 문자열 ID (예: 'ghibli', 'disney' 등)
  name: text("name").notNull(),
  description: text("description").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  characterPrompt: text("character_prompt"), // 캐릭터 생성용 특화 프롬프트
  thumbnailUrl: text("thumbnail_url"), // 스타일 썸네일 이미지 URL
  characterSampleUrl: text("character_sample_url"), // 캐릭터 샘플 이미지 URL
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true),
  creatorId: integer("creator_id").references(() => users.id), // 스타일 생성자 (관리자)
  order: integer("order").default(0), // 정렬 순서
});

// 이미지 스타일 Zod 스키마 생성 (멀티라인 텍스트 허용으로 개선)
export const insertImageStyleSchema = createInsertSchema(imageStyles, {
  styleId: (schema) => schema
    .min(2, "스타일 ID는 최소 2자 이상이어야 합니다")
    .regex(/^[a-z0-9_-]+$/, "스타일 ID는 영문 소문자, 숫자, 하이픈, 언더스코어만 사용 가능합니다"),
  name: (schema) => schema.min(2, "이름은 최소 2자 이상이어야 합니다"),
  description: (schema) => schema.min(5, "설명은 최소 5자 이상이어야 합니다"),
  systemPrompt: (schema) => schema.min(10, "시스템 프롬프트는 최소 10자 이상이어야 합니다"),
});

export type ImageStyle = z.infer<typeof insertImageStyleSchema>;

// 이미지 스타일 관계 정의
export const imageStylesRelations = relations(imageStyles, ({ one }) => ({
  creator: one(users, {
    fields: [imageStyles.creatorId],
    references: [users.id]
  })
}));

// Music Styles table - 음악 스타일 관리
export const musicStyles = pgTable("music_styles", {
  id: serial("id").primaryKey(),
  styleId: text("style_id").unique().notNull(), // 스타일 문자열 ID (예: 'lullaby', 'classical' 등)
  name: text("name").notNull(),
  description: text("description"),
  prompt: text("prompt"), // 음악 생성을 위한 프롬프트
  tags: text("tags").array().default([]), // 스타일 태그
  isActive: boolean("is_active").default(true),
  order: integer("order").default(0), // 정렬 순서
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 음악 스타일 Zod 스키마 생성
export const insertMusicStyleSchema = createInsertSchema(musicStyles, {
  styleId: (schema) => schema
    .min(2, "스타일 ID는 최소 2자 이상이어야 합니다")
    .regex(/^[a-z0-9_-]+$/, "스타일 ID는 영문 소문자, 숫자, 하이픈, 언더스코어만 사용 가능합니다"),
  name: (schema) => schema.min(2, "이름은 최소 2자 이상이어야 합니다"),
  description: (schema) => schema.min(5, "설명은 최소 5자 이상이어야 합니다"),
  prompt: (schema) => schema.min(5, "프롬프트는 최소 5자 이상이어야 합니다"),
});

export type MusicStyle = typeof musicStyles.$inferSelect;
export type MusicStyleInsert = z.infer<typeof insertMusicStyleSchema>;

// 음악 스타일 관계 정의 (현재는 외부 키 없음)

// 🎨 콜라주 테이블 - 이미지 콜라주 생성 관리
export const collages = pgTable("collages", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").unique().notNull(), // 세션 고유 ID
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  imageIds: jsonb("image_ids").notNull(), // 사용된 이미지 ID 배열
  layout: text("layout").notNull(), // '2', '6', '12', '24'
  resolution: text("resolution").notNull(), // 'web', 'high', 'print'
  format: text("format").notNull().default("png"), // 'png', 'jpg', 'webp'
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  outputUrl: text("output_url"), // 생성된 콜라주 이미지 URL
  outputPath: text("output_path"), // 로컬 저장 경로
  metadata: jsonb("metadata"), // 추가 메타데이터 (크기, DPI 등)
  error: text("error"), // 에러 메시지 (실패 시)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"), // 완료 시간
});

// 콜라주 Zod 스키마
export const insertCollageSchema = createInsertSchema(collages, {
  sessionId: (schema) => schema.min(1, "세션 ID는 필수입니다"),
  layout: (schema) => schema.refine(value => ["2", "6", "12", "24"].includes(value), {
    message: "레이아웃은 2, 6, 12, 24 중 하나여야 합니다"
  }),
  resolution: (schema) => schema.refine(value => ["web", "high", "print"].includes(value), {
    message: "해상도는 web, high, print 중 하나여야 합니다"
  }),
  format: (schema) => schema.refine(value => ["png", "jpg", "webp"].includes(value), {
    message: "포맷은 png, jpg, webp 중 하나여야 합니다"
  })
});

export type Collage = typeof collages.$inferSelect;
export type CollageInsert = z.infer<typeof insertCollageSchema>;

// 콜라주 관계 정의
export const collagesRelations = relations(collages, ({ one }) => ({
  user: one(users, {
    fields: [collages.userId],
    references: [users.id]
  })
}));

// 🎯 작은 배너 Zod 스키마
export const smallBannerInsertSchema = createInsertSchema(smallBanners, {
  title: (schema) => schema.min(1, "제목은 필수입니다"),
  imageUrl: (schema) => schema.min(1, "이미지 URL은 필수입니다"),
});

export type SmallBanner = typeof smallBanners.$inferSelect;
export type SmallBannerInsert = z.infer<typeof smallBannerInsertSchema>;

// 사용자 설정 스키마 및 타입 정의
export const userSettingsInsertSchema = createInsertSchema(userSettings, {
  theme: (schema) => schema.refine(value => ["light", "dark", "system"].includes(value), {
    message: "테마는 light, dark, system 중 하나여야 합니다"
  }),
  language: (schema) => schema.refine(value => ["ko", "en"].includes(value), {
    message: "언어는 ko, en 중 하나여야 합니다"
  })
});

export type UserSettings = typeof userSettings.$inferSelect;
export type UserSettingsInsert = z.infer<typeof userSettingsInsertSchema>;

// Phase 6: 파일 업로드 스키마 검증
export const insertMilestoneApplicationFileSchema = createInsertSchema(milestoneApplicationFiles, {
  fileName: (schema) => schema.min(1, "파일명은 필수입니다."),
  fileType: (schema) => schema.min(1, "파일 타입은 필수입니다."),
  fileSize: (schema) => schema.min(1, "파일 크기는 0보다 커야 합니다.").max(10 * 1024 * 1024, "파일 크기는 10MB를 초과할 수 없습니다."), // 10MB 제한
  filePath: (schema) => schema.min(1, "파일 경로는 필수입니다.")
});

export type MilestoneApplicationFile = typeof milestoneApplicationFiles.$inferSelect;
export type MilestoneApplicationFileInsert = z.infer<typeof insertMilestoneApplicationFileSchema>;

// ===== 알림 시스템 테이블 =====

// 알림 테이블
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(), // 알림 받을 사용자 ID
  type: text("type").notNull(), // "milestone_application", "application_approved", "application_rejected", "campaign_reminder" 등
  title: text("title").notNull(), // 알림 제목
  message: text("message").notNull(), // 알림 내용
  data: jsonb("data"), // 추가 데이터 (관련 ID, URL 등)
  isRead: boolean("is_read").notNull().default(false), // 읽음 여부
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"), // 읽은 시간
});

// 알림 설정 테이블 (사용자별 알림 환경설정)
export const notificationSettings = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),

  // 참여형 마일스톤 관련 알림 설정
  milestoneApplications: boolean("milestone_applications").default(true), // 신청 관련 알림
  applicationStatusChanges: boolean("application_status_changes").default(true), // 승인/거절 알림
  campaignReminders: boolean("campaign_reminders").default(true), // 캠페인 시작/마감 알림
  campaignUpdates: boolean("campaign_updates").default(true), // 캠페인 내용 변경 알림

  // 일반 알림 설정
  systemNotifications: boolean("system_notifications").default(true), // 시스템 공지사항
  emailNotifications: boolean("email_notifications").default(false), // 이메일 알림 (향후 확장용)
  pushNotifications: boolean("push_notifications").default(true), // 푸시 알림 (향후 확장용)

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 알림 관련 스키마 검증
export const notificationsInsertSchema = createInsertSchema(notifications, {
  title: (schema) => schema.min(1, "알림 제목은 필수입니다"),
  message: (schema) => schema.min(1, "알림 내용은 필수입니다"),
  type: (schema) => schema.min(1, "알림 타입은 필수입니다")
});

export const notificationsSelectSchema = createSelectSchema(notifications);
export type Notification = z.infer<typeof notificationsSelectSchema>;
export type NotificationInsert = z.infer<typeof notificationsInsertSchema>;

export const notificationSettingsInsertSchema = createInsertSchema(notificationSettings);
export const notificationSettingsSelectSchema = createSelectSchema(notificationSettings);
export type NotificationSettings = z.infer<typeof notificationSettingsSelectSchema>;
export type NotificationSettingsInsert = z.infer<typeof notificationSettingsInsertSchema>;

// 알림 관련 관계 정의
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id]
  })
}));

export const notificationSettingsRelations = relations(notificationSettings, ({ one }) => ({
  user: one(users, {
    fields: [notificationSettings.userId],
    references: [users.id]
  })
}));

// 기존 사용자 관계에 알림 추가 (기존 usersRelations 확장)
// 기존 usersRelations에 알림 관련 관계 추가는 별도 확장으로 처리됨

// ===== 미션 시스템 (Starbucks Frequency 모델) =====

// 미션 상태 enum
export const MISSION_STATUS = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  SUBMITTED: "submitted",
  APPROVED: "approved",
  REJECTED: "rejected",
  WAITLIST: "waitlist",  // 선착순 인원 초과 시 대기 상태
  CANCELLED: "cancelled"  // 사용자가 신청 취소한 상태
} as const;

export const MISSION_STATUS_ENUM = z.enum([
  MISSION_STATUS.NOT_STARTED,
  MISSION_STATUS.IN_PROGRESS,
  MISSION_STATUS.SUBMITTED,
  MISSION_STATUS.APPROVED,
  MISSION_STATUS.REJECTED,
  MISSION_STATUS.WAITLIST,
  MISSION_STATUS.CANCELLED
]);

export type MissionStatus = z.infer<typeof MISSION_STATUS_ENUM>;

// 공개 범위 enum
export const VISIBILITY_TYPE = {
  PUBLIC: "public",
  HOSPITAL: "hospital",
  DEV: "dev"
} as const;

export const VISIBILITY_TYPE_ENUM = z.enum([
  VISIBILITY_TYPE.PUBLIC,
  VISIBILITY_TYPE.HOSPITAL,
  VISIBILITY_TYPE.DEV
]);

export type VisibilityType = z.infer<typeof VISIBILITY_TYPE_ENUM>;

// 제출 타입 enum
export const SUBMISSION_TYPE = {
  FILE: "file",
  LINK: "link",
  TEXT: "text",
  IMAGE: "image",
  STUDIO_SUBMIT: "studio_submit",
  ATTENDANCE: "attendance"
} as const;

export const SUBMISSION_TYPE_ENUM = z.enum([
  SUBMISSION_TYPE.FILE,
  SUBMISSION_TYPE.LINK,
  SUBMISSION_TYPE.TEXT,
  SUBMISSION_TYPE.IMAGE,
  SUBMISSION_TYPE.STUDIO_SUBMIT,
  SUBMISSION_TYPE.ATTENDANCE
]);

export type SubmissionType = z.infer<typeof SUBMISSION_TYPE_ENUM>;

// 🎯 액션 타입 테이블 (신청, 제출, 출석, 리뷰 등 - 관리자가 추가/삭제 가능)
export const actionTypes = pgTable("action_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  iconUrl: text("icon_url"),
  order: integer("order").default(0).notNull(),
  isSystem: boolean("is_system").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// 미션 카테고리 테이블
export const missionCategories = pgTable("mission_categories", {
  id: serial("id").primaryKey(),
  categoryId: text("category_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  emoji: text("emoji"),
  order: integer("order").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// 📁 미션 폴더 테이블 (관리자용 정리 폴더)
export const missionFolders = pgTable("mission_folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").default("#6366f1"),
  order: integer("order").default(0).notNull(),
  isCollapsed: boolean("is_collapsed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// 주제 미션 테이블
export const themeMissions = pgTable("theme_missions", {
  id: serial("id").primaryKey(),
  missionId: text("mission_id").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  categoryId: text("category_id").references(() => missionCategories.categoryId),
  headerImageUrl: text("header_image_url"),

  // ⭐ 공개 범위 시스템 (핵심 기능)
  visibilityType: text("visibility_type").default(VISIBILITY_TYPE.PUBLIC).notNull(),
  hospitalId: integer("hospital_id").references(() => hospitals.id),

  // 🔗 하부미션 시스템 (부모 미션 ID - 자기 참조)
  // 부모 미션에서 승인된 사용자만 하부미션에 접근 가능
  parentMissionId: integer("parent_mission_id"),

  // 📁 폴더 ID (관리자 정리용)
  folderId: integer("folder_id").references(() => missionFolders.id),

  // 기간 설정 (모집 기간)
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),

  // 🎯 행사 정보 시스템 (V2 업그레이드)
  eventDate: timestamp("event_date"),
  eventEndTime: timestamp("event_end_time"),

  // 🎯 모집 인원 시스템
  capacity: integer("capacity"),
  isFirstCome: boolean("is_first_come").default(false),

  // 🎯 동적 안내사항 [{title, content}]
  noticeItems: jsonb("notice_items").$type<{ title: string; content: string }[]>().default([]),

  // 🎯 선물 정보 (세부미션이 아닌 주제미션에서 관리)
  giftImageUrl: text("gift_image_url"),
  giftDescription: text("gift_description"),

  // 🎯 행사 장소 이미지
  venueImageUrl: text("venue_image_url"),

  // 상태 및 정렬
  isActive: boolean("is_active").default(true).notNull(),
  order: integer("order").default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// 세부 미션 테이블
export const subMissions = pgTable("sub_missions", {
  id: serial("id").primaryKey(),
  themeMissionId: integer("theme_mission_id")
    .references(() => themeMissions.id, { onDelete: "cascade" })
    .notNull(),

  title: text("title").notNull(),
  description: text("description"),

  // 🎯 액션 타입 연결 (신청, 제출, 출석, 리뷰 등)
  actionTypeId: integer("action_type_id").references(() => actionTypes.id),

  // 🎯 순차 잠금 시스템 (이전 세부미션 승인 후 개방) - 레거시, sequentialLevel 사용 권장
  unlockAfterPrevious: boolean("unlock_after_previous").default(false).notNull(),

  // 🎯 순차 등급 시스템 (0=순차진행안함, 1,2,3...=등급, 이전 등급 모두 완료 시 다음 등급 열림)
  sequentialLevel: integer("sequential_level").default(0).notNull(),

  // 🎯 출석 인증 시스템
  attendanceType: varchar("attendance_type", { length: 20 }),
  attendancePassword: text("attendance_password"),

  // 🔄 다중 제출 타입 지원 (JSONB 배열)
  // 예: ["file", "image"] - 파일과 이미지 모두 제출 가능
  submissionTypes: jsonb("submission_types").$type<string[]>().default(["file"]).notNull(),

  // 🏷️ 제출 타입별 커스텀 라벨 (선택적)
  // 예: { "file": "인증샷 업로드", "text": "소감문 작성" }
  // 비어있으면 기본 라벨 사용 (파일 URL, 텍스트 내용 등)
  submissionLabels: jsonb("submission_labels").$type<Record<string, string>>().default({}),

  // 검수 필요 여부
  requireReview: boolean("require_review").default(false).notNull(),

  // 제작소 제출 DPI 설정 (150 또는 300, 기본값 300)
  studioDpi: integer("studio_dpi").default(300),

  // 제작소 제출 파일 형식 설정 (webp, jpeg, pdf 중 선택, 기본값 pdf)
  studioFileFormat: varchar("studio_file_format", { length: 10 }).default("pdf"),

  // 🎨 행사 에디터 템플릿 설정
  partyTemplateProjectId: integer("party_template_project_id"), // 연결된 행사 템플릿 프로젝트 ID
  partyMaxPages: integer("party_max_pages"), // 최대 페이지 수 (null이면 제한 없음)

  // 📅 세부미션 기간 설정 (설정 시 해당 기간에만 수행 가능)
  startDate: timestamp("start_date"), // 세부미션 시작일 (null이면 제한 없음)
  endDate: timestamp("end_date"), // 세부미션 종료일 (null이면 제한 없음)

  order: integer("order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// 사용자 미션 진행 상황 테이블
export const userMissionProgress = pgTable("user_mission_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  themeMissionId: integer("theme_mission_id")
    .references(() => themeMissions.id, { onDelete: "cascade" })
    .notNull(),

  // 5단계 상태: not_started, in_progress, submitted, approved, rejected
  status: varchar("status", { length: 20 }).default(MISSION_STATUS.NOT_STARTED).notNull(),

  // 진행률 (0-100)
  progressPercent: integer("progress_percent").default(0).notNull(),

  // 완료된 세부 미션 수
  completedSubMissions: integer("completed_sub_missions").default(0).notNull(),
  totalSubMissions: integer("total_sub_missions").default(0).notNull(),

  // 제출 및 검수 정보
  submittedAt: timestamp("submitted_at"),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewNotes: text("review_notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// 세부 미션 제출 기록 테이블
export const subMissionSubmissions = pgTable("sub_mission_submissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  subMissionId: integer("sub_mission_id")
    .references(() => subMissions.id, { onDelete: "cascade" })
    .notNull(),

  // 제출 데이터 (파일 URL, 링크, 텍스트 등)
  submissionData: jsonb("submission_data").default("{}").notNull(),

  // 상태: pending, approved, rejected (세부 미션별)
  status: varchar("status", { length: 20 }).default("pending").notNull(),

  // 잠금 상태 (approved 시 true)
  isLocked: boolean("is_locked").default(false).notNull(),

  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewNotes: text("review_notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// 미션 시스템 Relations
export const actionTypesRelations = relations(actionTypes, ({ many }) => ({
  subMissions: many(subMissions)
}));

export const missionCategoriesRelations = relations(missionCategories, ({ many }) => ({
  themeMissions: many(themeMissions)
}));

export const missionFoldersRelations = relations(missionFolders, ({ many }) => ({
  themeMissions: many(themeMissions)
}));

export const themeMissionsRelations = relations(themeMissions, ({ many, one }) => ({
  subMissions: many(subMissions),
  userProgress: many(userMissionProgress),
  category: one(missionCategories, {
    fields: [themeMissions.categoryId],
    references: [missionCategories.categoryId]
  }),
  hospital: one(hospitals, {
    fields: [themeMissions.hospitalId],
    references: [hospitals.id]
  }),
  folder: one(missionFolders, {
    fields: [themeMissions.folderId],
    references: [missionFolders.id]
  }),
  // 🔗 하부미션 관계 - 부모/자식 미션 연결
  parentMission: one(themeMissions, {
    fields: [themeMissions.parentMissionId],
    references: [themeMissions.id],
    relationName: "missionHierarchy"
  }),
  childMissions: many(themeMissions, { relationName: "missionHierarchy" })
}));

export const subMissionsRelations = relations(subMissions, ({ one, many }) => ({
  themeMission: one(themeMissions, {
    fields: [subMissions.themeMissionId],
    references: [themeMissions.id]
  }),
  actionType: one(actionTypes, {
    fields: [subMissions.actionTypeId],
    references: [actionTypes.id]
  }),
  submissions: many(subMissionSubmissions)
}));

export const userMissionProgressRelations = relations(userMissionProgress, ({ one }) => ({
  user: one(users, {
    fields: [userMissionProgress.userId],
    references: [users.id]
  }),
  themeMission: one(themeMissions, {
    fields: [userMissionProgress.themeMissionId],
    references: [themeMissions.id]
  }),
  reviewer: one(users, {
    fields: [userMissionProgress.reviewedBy],
    references: [users.id]
  })
}));

export const subMissionSubmissionsRelations = relations(subMissionSubmissions, ({ one }) => ({
  user: one(users, {
    fields: [subMissionSubmissions.userId],
    references: [users.id]
  }),
  subMission: one(subMissions, {
    fields: [subMissionSubmissions.subMissionId],
    references: [subMissions.id]
  }),
  reviewer: one(users, {
    fields: [subMissionSubmissions.reviewedBy],
    references: [users.id]
  })
}));

// ============================================
// 큰미션(Big Mission) 시스템 - 게이미피케이션 컬렉션
// ============================================

// 큰미션 테이블 (컬렉션)
export const bigMissions = pgTable("big_missions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  headerImageUrl: text("header_image_url"),
  iconUrl: text("icon_url"),  // 없을 시 공용아이콘 사용

  // 공개범위 (기존 themeMissions와 동일 패턴)
  visibilityType: varchar("visibility_type", { length: 20 })
    .default(VISIBILITY_TYPE.PUBLIC).notNull(),
  hospitalId: integer("hospital_id")
    .references(() => hospitals.id),

  // 기간 설정
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),

  // 보상 정보
  giftImageUrl: text("gift_image_url"),
  giftDescription: text("gift_description"),

  // 정렬 및 상태
  order: integer("order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// 큰미션 주제미션 슬롯 (카테고리 매핑)
export const bigMissionTopics = pgTable("big_mission_topics", {
  id: serial("id").primaryKey(),
  bigMissionId: integer("big_mission_id")
    .references(() => bigMissions.id, { onDelete: "cascade" }).notNull(),

  title: text("title").notNull(),
  description: text("description"),
  iconUrl: text("icon_url"),  // 없을 시 공용아이콘 사용

  // 카테고리 연결 — 이 카테고리의 주제미션 1개 이상 approved → 완료
  categoryId: varchar("category_id", { length: 50 })
    .references(() => missionCategories.categoryId).notNull(),

  order: integer("order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// 사용자 큰미션 진행추적
export const userBigMissionProgress = pgTable("user_big_mission_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" }).notNull(),
  bigMissionId: integer("big_mission_id")
    .references(() => bigMissions.id, { onDelete: "cascade" }).notNull(),

  completedTopics: integer("completed_topics").default(0).notNull(),
  totalTopics: integer("total_topics").default(0).notNull(),

  status: varchar("status", { length: 20 }).default("not_started").notNull(),
  completedAt: timestamp("completed_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// 큰미션 Relations
export const bigMissionsRelations = relations(bigMissions, ({ many, one }) => ({
  topics: many(bigMissionTopics),
  userProgress: many(userBigMissionProgress),
  hospital: one(hospitals, {
    fields: [bigMissions.hospitalId],
    references: [hospitals.id]
  })
}));

export const bigMissionTopicsRelations = relations(bigMissionTopics, ({ one }) => ({
  bigMission: one(bigMissions, {
    fields: [bigMissionTopics.bigMissionId],
    references: [bigMissions.id]
  }),
  category: one(missionCategories, {
    fields: [bigMissionTopics.categoryId],
    references: [missionCategories.categoryId]
  })
}));

export const userBigMissionProgressRelations = relations(userBigMissionProgress, ({ one }) => ({
  user: one(users, {
    fields: [userBigMissionProgress.userId],
    references: [users.id]
  }),
  bigMission: one(bigMissions, {
    fields: [userBigMissionProgress.bigMissionId],
    references: [bigMissions.id]
  })
}));

// 미션 시스템 Zod 스키마
// 액션 타입 Zod 스키마
export const actionTypesInsertSchema = createInsertSchema(actionTypes, {
  name: (schema) => schema.min(1, "액션 타입 이름은 필수입니다")
});

export const actionTypesSelectSchema = createSelectSchema(actionTypes);
export type ActionType = z.infer<typeof actionTypesSelectSchema>;
export type ActionTypeInsert = z.infer<typeof actionTypesInsertSchema>;

export const missionCategoriesInsertSchema = createInsertSchema(missionCategories, {
  categoryId: (schema) => schema.min(1, "카테고리 ID는 필수입니다"),
  name: (schema) => schema.min(1, "카테고리 이름은 필수입니다")
});

export const themeMissionsInsertSchema = createInsertSchema(themeMissions, {
  missionId: (schema) => schema.min(1, "미션 ID는 필수입니다"),
  title: (schema) => schema.min(1, "미션 제목은 필수입니다"),
  description: (schema) => schema.min(1, "미션 설명은 필수입니다"),
  visibilityType: VISIBILITY_TYPE_ENUM,
  startDate: z.union([z.string(), z.date(), z.null()]).transform(val => {
    if (!val || val === "") return null;
    return val instanceof Date ? val : new Date(val);
  }).nullable().optional(),
  endDate: z.union([z.string(), z.date(), z.null()]).transform(val => {
    if (!val || val === "") return null;
    return val instanceof Date ? val : new Date(val);
  }).nullable().optional(),
  eventDate: z.union([z.string(), z.date(), z.null()]).transform(val => {
    if (!val || val === "") return null;
    return val instanceof Date ? val : new Date(val);
  }).nullable().optional(),
  eventEndTime: z.union([z.string(), z.date(), z.null()]).transform(val => {
    if (!val || val === "") return null;
    return val instanceof Date ? val : new Date(val);
  }).nullable().optional(),
  noticeItems: z.array(z.object({
    title: z.string(),
    content: z.string()
  })).optional().default([])
}).refine(
  (data) => {
    // visibilityType이 'hospital'이면 hospitalId가 필수
    if (data.visibilityType === VISIBILITY_TYPE.HOSPITAL) {
      return data.hospitalId !== null && data.hospitalId !== undefined;
    }
    return true;
  },
  {
    message: "병원 전용 미션은 병원을 선택해야 합니다",
    path: ["hospitalId"]
  }
);

export const subMissionsInsertSchema = createInsertSchema(subMissions, {
  title: (schema) => schema.min(1, "세부 미션 제목은 필수입니다"),
  submissionTypes: z.array(SUBMISSION_TYPE_ENUM).min(1, "최소 1개의 제출 타입이 필요합니다"),
  startDate: z.union([z.string(), z.date(), z.null()]).transform(val => {
    if (!val || (typeof val === "string" && val.trim() === "")) return null;
    if (val instanceof Date) return val;
    const parsed = new Date(`${val.includes('T') ? val : val + 'T00:00:00+09:00'}`);
    return isNaN(parsed.getTime()) ? null : parsed;
  }).nullable().optional(),
  endDate: z.union([z.string(), z.date(), z.null()]).transform(val => {
    if (!val || (typeof val === "string" && val.trim() === "")) return null;
    if (val instanceof Date) return val;
    const parsed = new Date(`${val.includes('T') ? val : val + 'T23:59:59+09:00'}`);
    return isNaN(parsed.getTime()) ? null : parsed;
  }).nullable().optional()
});

export const userMissionProgressInsertSchema = createInsertSchema(userMissionProgress, {
  status: MISSION_STATUS_ENUM
});

export const subMissionSubmissionsInsertSchema = createInsertSchema(subMissionSubmissions);

// 미션 시스템 타입
export const missionCategoriesSelectSchema = createSelectSchema(missionCategories);
export type MissionCategory = z.infer<typeof missionCategoriesSelectSchema>;
export type MissionCategoryInsert = z.infer<typeof missionCategoriesInsertSchema>;

export const missionFoldersInsertSchema = createInsertSchema(missionFolders);
export const missionFoldersSelectSchema = createSelectSchema(missionFolders);
export type MissionFolder = z.infer<typeof missionFoldersSelectSchema>;
export type MissionFolderInsert = z.infer<typeof missionFoldersInsertSchema>;

export const themeMissionsSelectSchema = createSelectSchema(themeMissions);
export type ThemeMission = z.infer<typeof themeMissionsSelectSchema>;
export type ThemeMissionInsert = z.infer<typeof themeMissionsInsertSchema>;

export const subMissionsSelectSchema = createSelectSchema(subMissions);
export type SubMission = z.infer<typeof subMissionsSelectSchema>;
export type SubMissionInsert = z.infer<typeof subMissionsInsertSchema>;

export const userMissionProgressSelectSchema = createSelectSchema(userMissionProgress);
export type UserMissionProgress = z.infer<typeof userMissionProgressSelectSchema>;
export type UserMissionProgressInsert = z.infer<typeof userMissionProgressInsertSchema>;

export const subMissionSubmissionsSelectSchema = createSelectSchema(subMissionSubmissions);
export type SubMissionSubmission = z.infer<typeof subMissionSubmissionsSelectSchema>;
export type SubMissionSubmissionInsert = z.infer<typeof subMissionSubmissionsInsertSchema>;

// 🎯 AI 모델 enum 정의
export const AI_MODELS = {
  OPENAI: "openai",
  GEMINI: "gemini",
  GEMINI_3: "gemini_3"
} as const;

export const AI_MODEL_ENUM = z.enum([AI_MODELS.OPENAI, AI_MODELS.GEMINI, AI_MODELS.GEMINI_3]);
export type AiModel = z.infer<typeof AI_MODEL_ENUM>;

// 🎯 Gemini 3.0 Pro 전용 옵션 상수
export const GEMINI3_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] as const;
export type Gemini3AspectRatio = typeof GEMINI3_ASPECT_RATIOS[number];

export const GEMINI3_RESOLUTIONS = ["1K", "2K", "4K"] as const;
export type Gemini3Resolution = typeof GEMINI3_RESOLUTIONS[number];

// 🎯 시스템 설정 테이블 (관리자 모델 제어용 - Singleton 구조)
export const systemSettings = pgTable("ai_model_settings", {
  id: serial("id").primaryKey()
    .$defaultFn(() => 1), // Singleton: 항상 ID=1로 고정
  defaultAiModel: text("default_ai_model").notNull().default(AI_MODELS.OPENAI), // 기본 AI 모델
  supportedAiModels: jsonb("supported_ai_models").$type<AiModel[]>().notNull().default([AI_MODELS.OPENAI, AI_MODELS.GEMINI]), // 지원 모델 목록 (실제 배열)
  clientDefaultModel: text("client_default_model").notNull().default(AI_MODELS.OPENAI), // 클라이언트 기본 선택값
  milestoneEnabled: boolean("milestone_enabled").notNull().default(true), // 마일스톤 메뉴 활성화 여부
  // 배경제거 전역 설정
  bgRemovalQuality: text("bg_removal_quality").notNull().default("1.0"), // 품질: "0.5" | "0.8" | "1.0"
  bgRemovalModel: text("bg_removal_model").notNull().default("medium"), // 모델: "small" | "medium"
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Singleton 제약조건: ID는 항상 1만 허용
  singletonCheck: sql`CHECK (${table.id} = 1)`
}));

// 배경제거 설정 enum
export const BG_REMOVAL_QUALITY = ["0.5", "0.8", "1.0"] as const;
export const BG_REMOVAL_MODEL = ["small", "medium"] as const;
export const BG_REMOVAL_TYPE = ["foreground", "background"] as const;

// 시스템 설정 Update 스키마 (Singleton이므로 INSERT는 내부적으로만 사용)
export const systemSettingsUpdateSchema = z.object({
  defaultAiModel: AI_MODEL_ENUM,
  supportedAiModels: z.array(AI_MODEL_ENUM).min(1, "최소 1개 이상의 AI 모델이 필요합니다"),
  clientDefaultModel: AI_MODEL_ENUM,
  milestoneEnabled: z.boolean().optional(),
  bgRemovalQuality: z.enum(BG_REMOVAL_QUALITY).optional(),
  bgRemovalModel: z.enum(BG_REMOVAL_MODEL).optional()
}).refine(data => {
  // 교집합 검증: defaultAiModel이 supportedAiModels에 포함되어야 함
  return data.supportedAiModels.includes(data.defaultAiModel);
}, {
  message: "기본 AI 모델이 지원 모델 목록에 포함되어야 합니다",
  path: ["defaultAiModel"]
}).refine(data => {
  // 교집합 검증: clientDefaultModel이 supportedAiModels에 포함되어야 함
  return data.supportedAiModels.includes(data.clientDefaultModel);
}, {
  message: "클라이언트 기본 모델이 지원 모델 목록에 포함되어야 합니다",
  path: ["clientDefaultModel"]
});

// 시스템 설정 스키마 (내부용 - Singleton이므로 일반 INSERT 비허용)
export const systemSettingsInsertSchema = createInsertSchema(systemSettings, {
  id: z.literal(1), // Singleton: ID는 항상 1
  defaultAiModel: AI_MODEL_ENUM,
  supportedAiModels: z.array(AI_MODEL_ENUM).min(1, "최소 1개 이상의 AI 모델이 필요합니다"),
  clientDefaultModel: AI_MODEL_ENUM
}).refine(data => {
  return data.supportedAiModels.includes(data.defaultAiModel);
}, {
  message: "기본 AI 모델이 지원 모델 목록에 포함되어야 합니다",
  path: ["defaultAiModel"]
}).refine(data => {
  return data.supportedAiModels.includes(data.clientDefaultModel);
}, {
  message: "클라이언트 기본 모델이 지원 모델 목록에 포함되어야 합니다",
  path: ["clientDefaultModel"]
});

export const systemSettingsSelectSchema = createSelectSchema(systemSettings);
export type SystemSettings = z.infer<typeof systemSettingsSelectSchema>;
export type SystemSettingsInsert = z.infer<typeof systemSettingsInsertSchema>;
export type SystemSettingsUpdate = z.infer<typeof systemSettingsUpdateSchema>;

// ============================================
// 🎯 포토북 에디터 시스템 테이블
// ============================================

// 포토북 프로젝트 상태 enum
export const PHOTOBOOK_STATUS = {
  DRAFT: "draft",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  ARCHIVED: "archived"
} as const;

export const PHOTOBOOK_STATUS_ENUM = z.enum([
  PHOTOBOOK_STATUS.DRAFT,
  PHOTOBOOK_STATUS.IN_PROGRESS,
  PHOTOBOOK_STATUS.COMPLETED,
  PHOTOBOOK_STATUS.ARCHIVED
]);

// 포토북 프로젝트 테이블 (사용자 프로젝트)
export const photobookProjects = pgTable("photobook_projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  hospitalId: integer("hospital_id").references(() => hospitals.id),
  title: text("title").notNull().default("새 포토북"),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),

  // 프로젝트 설정
  pageCount: integer("page_count").notNull().default(1),
  currentPage: integer("current_page").notNull().default(0),
  canvasWidth: integer("canvas_width").notNull().default(800),
  canvasHeight: integer("canvas_height").notNull().default(600),

  // 페이지 데이터 (JSON - 모든 페이지의 객체 정보 포함)
  pagesData: jsonb("pages_data").$type<{
    pages: Array<{
      id: string;
      objects: Array<{
        id: string;
        type: "image" | "text" | "shape" | "icon";
        x: number;
        y: number;
        width: number;
        height: number;
        rotation: number;
        zIndex: number;
        locked: boolean;
        opacity: number;
        // 타입별 추가 속성
        src?: string; // image, icon
        text?: string; // text
        fontFamily?: string;
        fontSize?: number;
        fontWeight?: string;
        fontStyle?: string;
        textAlign?: string;
        color?: string;
        backgroundColor?: string;
        borderRadius?: number;
        borderWidth?: number;
        borderColor?: string;
        shapeType?: "rectangle" | "circle" | "triangle";
        originalWidth?: number;
        originalHeight?: number;
      }>;
      backgroundColor: string;
      backgroundImage?: string;
    }>;
  }>().notNull().default({ pages: [{ id: "page-1", objects: [], backgroundColor: "#ffffff" }] }),

  // 상태 관리
  status: text("status").$type<"draft" | "in_progress" | "completed" | "archived">().notNull().default("draft"),
  templateId: integer("template_id"), // 사용된 템플릿

  // 타임스탬프
  lastSavedAt: timestamp("last_saved_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("photobook_projects_user_id_idx").on(table.userId),
  hospitalIdIdx: index("photobook_projects_hospital_id_idx").on(table.hospitalId),
  statusIdx: index("photobook_projects_status_idx").on(table.status)
}));

// 포토북 버전 테이블 (버전 이력 관리)
export const photobookVersions = pgTable("photobook_versions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => photobookProjects.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull().default(1),

  // 버전 스냅샷 (전체 pagesData 복사)
  pagesDataSnapshot: jsonb("pages_data_snapshot").$type<{
    pages: Array<{
      id: string;
      objects: Array<Record<string, unknown>>;
      backgroundColor: string;
      backgroundImage?: string;
    }>;
  }>().notNull(),

  // 메타 정보
  description: text("description"), // 버전 설명 (예: "자동 저장", "수동 저장")
  isAutoSave: boolean("is_auto_save").notNull().default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("photobook_versions_project_id_idx").on(table.projectId),
  versionNumberIdx: index("photobook_versions_version_number_idx").on(table.versionNumber)
}));

// 포토북 템플릿 테이블 (관리자가 생성하는 템플릿)
export const photobookTemplates = pgTable("photobook_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),

  // 템플릿 설정
  pageCount: integer("page_count").notNull().default(1),
  canvasWidth: integer("canvas_width").notNull().default(800),
  canvasHeight: integer("canvas_height").notNull().default(600),

  // 템플릿 페이지 데이터 (프로젝트와 동일한 구조)
  pagesData: jsonb("pages_data").$type<{
    pages: Array<{
      id: string;
      objects: Array<Record<string, unknown>>;
      backgroundColor: string;
      backgroundImage?: string;
    }>;
  }>().notNull().default({ pages: [{ id: "page-1", objects: [], backgroundColor: "#ffffff" }] }),

  // 분류
  category: text("category").default("general"), // general, maternity, baby, family, etc.
  tags: jsonb("tags").$type<string[]>().default([]),

  // 공개 설정
  isPublic: boolean("is_public").notNull().default(true),
  hospitalId: integer("hospital_id").references(() => hospitals.id), // 특정 병원 전용

  // 정렬 및 상태
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  isActiveIdx: index("photobook_templates_is_active_idx").on(table.isActive),
  categoryIdx: index("photobook_templates_category_idx").on(table.category),
  hospitalIdIdx: index("photobook_templates_hospital_id_idx").on(table.hospitalId)
}));

// 포토북 꾸미기 재료 카테고리 테이블 (관리자가 동적으로 관리)
export const photobookMaterialCategories = pgTable("photobook_material_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().$type<"background" | "icon">(), // background 또는 icon
  icon: text("icon"), // 카테고리 아이콘 (예: lucide 아이콘명)
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  typeIdx: index("photobook_material_categories_type_idx").on(table.type),
  isActiveIdx: index("photobook_material_categories_is_active_idx").on(table.isActive)
}));

// 포토북 배경 테이블 (관리자가 업로드하는 배경 이미지)
export const photobookBackgrounds = pgTable("photobook_backgrounds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),

  // 분류 - 동적 카테고리 FK
  categoryId: integer("category_id").references(() => photobookMaterialCategories.id),
  category: text("category").default("general"), // 레거시 호환용
  keywords: text("keywords"), // 검색 키워드 (쉼표 구분)

  // 공개 설정
  isPublic: boolean("is_public").notNull().default(true),
  hospitalId: integer("hospital_id").references(() => hospitals.id),

  // 정렬 및 상태
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  isActiveIdx: index("photobook_backgrounds_is_active_idx").on(table.isActive),
  categoryIdx: index("photobook_backgrounds_category_idx").on(table.category),
  categoryIdIdx: index("photobook_backgrounds_category_id_idx").on(table.categoryId),
  hospitalIdIdx: index("photobook_backgrounds_hospital_id_idx").on(table.hospitalId)
}));

// 포토북 아이콘 테이블 (관리자가 업로드하는 스티커/아이콘)
export const photobookIcons = pgTable("photobook_icons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),

  // 분류 - 동적 카테고리 FK
  categoryId: integer("category_id").references(() => photobookMaterialCategories.id),
  category: text("category").default("general"), // 레거시 호환용
  keywords: text("keywords"), // 검색 키워드 (쉼표 구분)

  // 공개 설정
  isPublic: boolean("is_public").notNull().default(true),
  hospitalId: integer("hospital_id").references(() => hospitals.id),

  // 정렬 및 상태
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  isActiveIdx: index("photobook_icons_is_active_idx").on(table.isActive),
  categoryIdx: index("photobook_icons_category_idx").on(table.category),
  categoryIdIdx: index("photobook_icons_category_id_idx").on(table.categoryId),
  hospitalIdIdx: index("photobook_icons_hospital_id_idx").on(table.hospitalId)
}));

// ============================================
// 포토북 Relations 정의
// ============================================

export const photobookProjectsRelations = relations(photobookProjects, ({ one, many }) => ({
  user: one(users, { fields: [photobookProjects.userId], references: [users.id] }),
  hospital: one(hospitals, { fields: [photobookProjects.hospitalId], references: [hospitals.id] }),
  template: one(photobookTemplates, { fields: [photobookProjects.templateId], references: [photobookTemplates.id] }),
  versions: many(photobookVersions)
}));

export const photobookVersionsRelations = relations(photobookVersions, ({ one }) => ({
  project: one(photobookProjects, { fields: [photobookVersions.projectId], references: [photobookProjects.id] })
}));

export const photobookTemplatesRelations = relations(photobookTemplates, ({ one, many }) => ({
  hospital: one(hospitals, { fields: [photobookTemplates.hospitalId], references: [hospitals.id] }),
  projects: many(photobookProjects)
}));

export const photobookMaterialCategoriesRelations = relations(photobookMaterialCategories, ({ many }) => ({
  backgrounds: many(photobookBackgrounds),
  icons: many(photobookIcons)
}));

export const photobookBackgroundsRelations = relations(photobookBackgrounds, ({ one }) => ({
  hospital: one(hospitals, { fields: [photobookBackgrounds.hospitalId], references: [hospitals.id] }),
  materialCategory: one(photobookMaterialCategories, { fields: [photobookBackgrounds.categoryId], references: [photobookMaterialCategories.id] })
}));

export const photobookIconsRelations = relations(photobookIcons, ({ one }) => ({
  hospital: one(hospitals, { fields: [photobookIcons.hospitalId], references: [hospitals.id] }),
  materialCategory: one(photobookMaterialCategories, { fields: [photobookIcons.categoryId], references: [photobookMaterialCategories.id] })
}));

// ============================================
// 포토북 Zod 스키마 및 타입 정의
// ============================================

export const photobookProjectsInsertSchema = createInsertSchema(photobookProjects, {
  title: (schema) => schema.min(1, "제목을 입력해주세요"),
  status: PHOTOBOOK_STATUS_ENUM
});
export const photobookProjectsSelectSchema = createSelectSchema(photobookProjects);
export type PhotobookProject = z.infer<typeof photobookProjectsSelectSchema>;
export type PhotobookProjectInsert = z.infer<typeof photobookProjectsInsertSchema>;

export const photobookVersionsInsertSchema = createInsertSchema(photobookVersions);
export const photobookVersionsSelectSchema = createSelectSchema(photobookVersions);
export type PhotobookVersion = z.infer<typeof photobookVersionsSelectSchema>;
export type PhotobookVersionInsert = z.infer<typeof photobookVersionsInsertSchema>;

export const photobookTemplatesInsertSchema = createInsertSchema(photobookTemplates, {
  name: (schema) => schema.min(1, "템플릿 이름을 입력해주세요")
});
export const photobookTemplatesSelectSchema = createSelectSchema(photobookTemplates);
export type PhotobookTemplate = z.infer<typeof photobookTemplatesSelectSchema>;
export type PhotobookTemplateInsert = z.infer<typeof photobookTemplatesInsertSchema>;

export const photobookMaterialCategoriesInsertSchema = createInsertSchema(photobookMaterialCategories, {
  name: (schema) => schema.min(1, "카테고리 이름을 입력해주세요"),
  type: z.enum(["background", "icon"])
});
export const photobookMaterialCategoriesSelectSchema = createSelectSchema(photobookMaterialCategories);
export type PhotobookMaterialCategory = z.infer<typeof photobookMaterialCategoriesSelectSchema>;
export type PhotobookMaterialCategoryInsert = z.infer<typeof photobookMaterialCategoriesInsertSchema>;

export const photobookBackgroundsInsertSchema = createInsertSchema(photobookBackgrounds, {
  name: (schema) => schema.min(1, "배경 이름을 입력해주세요"),
  imageUrl: (schema) => schema.min(1, "이미지 URL을 입력해주세요")
});
export const photobookBackgroundsSelectSchema = createSelectSchema(photobookBackgrounds);
export type PhotobookBackground = z.infer<typeof photobookBackgroundsSelectSchema>;
export type PhotobookBackgroundInsert = z.infer<typeof photobookBackgroundsInsertSchema>;

export const photobookIconsInsertSchema = createInsertSchema(photobookIcons, {
  name: (schema) => schema.min(1, "아이콘 이름을 입력해주세요"),
  imageUrl: (schema) => schema.min(1, "이미지 URL을 입력해주세요")
});
export const photobookIconsSelectSchema = createSelectSchema(photobookIcons);
export type PhotobookIcon = z.infer<typeof photobookIconsSelectSchema>;
export type PhotobookIconInsert = z.infer<typeof photobookIconsInsertSchema>;

// ============================================
// 메인 홈 UI - 인기스타일 & 메인갤러리 테이블
// ============================================

// 인기스타일 배너 테이블
export const popularStyles = pgTable("popular_styles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  isActiveIdx: index("popular_styles_is_active_idx").on(table.isActive),
  sortOrderIdx: index("popular_styles_sort_order_idx").on(table.sortOrder)
}));

// 메인갤러리 아이템 테이블
export const mainGalleryItems = pgTable("main_gallery_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url"),
  badge: text("badge"), // "NEW", "HOT", "추천" 등
  aspectRatio: text("aspect_ratio").notNull().default("square"), // 'square' | 'portrait' | 'landscape'
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  isActiveIdx: index("main_gallery_items_is_active_idx").on(table.isActive),
  sortOrderIdx: index("main_gallery_items_sort_order_idx").on(table.sortOrder)
}));

// Zod 스키마 및 타입 정의
export const popularStylesInsertSchema = createInsertSchema(popularStyles, {
  title: (schema) => schema.min(1, "제목을 입력해주세요"),
  imageUrl: (schema) => schema.min(1, "이미지 URL을 입력해주세요")
});
export const popularStylesSelectSchema = createSelectSchema(popularStyles);
export type PopularStyle = z.infer<typeof popularStylesSelectSchema>;
export type PopularStyleInsert = z.infer<typeof popularStylesInsertSchema>;

export const mainGalleryItemsInsertSchema = createInsertSchema(mainGalleryItems, {
  title: (schema) => schema.min(1, "제목을 입력해주세요"),
  imageUrl: (schema) => schema.min(1, "이미지 URL을 입력해주세요"),
  aspectRatio: z.enum(["square", "portrait", "landscape"])
});
export const mainGalleryItemsSelectSchema = createSelectSchema(mainGalleryItems);
export type MainGalleryItem = z.infer<typeof mainGalleryItemsSelectSchema>;
export type MainGalleryItemInsert = z.infer<typeof mainGalleryItemsInsertSchema>;

// ============================================
// 제품 카테고리 시스템 (포토북, 엽서, 포토카드 등)
// ============================================

// 제품 카테고리 테이블
export const productCategories = pgTable("product_categories", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 50 }).notNull().unique(), // photobook, postcard, photocard, calendar
  name: text("name").notNull(), // 포토북, 엽서, 포토카드, 달력
  description: text("description"),
  iconName: varchar("icon_name", { length: 50 }), // lucide 아이콘 이름
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  // 내보내기 설정 (동적 시스템)
  exportFormats: jsonb("export_formats").default(["webp", "jpeg", "pdf"]), // 지원 포맷
  defaultDpi: integer("default_dpi").default(300), // 기본 DPI
  supportedOrientations: jsonb("supported_orientations").default(["landscape", "portrait"]), // 지원 방향
  supportsBleed: boolean("supports_bleed").default(true), // 도련 지원 여부
  exportQualityOptions: jsonb("export_quality_options").default([{ "value": "high", "dpi": 150, "label": "고화질 (150 DPI)" }, { "value": "print", "dpi": 300, "label": "인쇄용 (300 DPI)" }]),
  // 업스케일 설정 (동적 시스템)
  upscaleEnabled: boolean("upscale_enabled").notNull().default(true), // 업스케일 기능 활성화
  upscaleMaxFactor: varchar("upscale_max_factor", { length: 10 }).notNull().default("x4"), // 최대 업스케일 배율 (x2, x3, x4)
  upscaleTargetDpi: integer("upscale_target_dpi").notNull().default(300), // 업스케일 목표 DPI
  upscaleMode: varchar("upscale_mode", { length: 20 }).notNull().default("auto"), // auto: 물리적 크기 기반 자동, fixed: 고정 배율
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  slugIdx: index("product_categories_slug_idx").on(table.slug),
  isActiveIdx: index("product_categories_is_active_idx").on(table.isActive)
}));

// 제품 규격/변형 테이블 (사이즈별)
export const productVariants = pgTable("product_variants", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => productCategories.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // A5, 명함 사이즈, 148x105 등
  widthMm: integer("width_mm").notNull(), // 가로 (mm)
  heightMm: integer("height_mm").notNull(), // 세로 (mm)
  bleedMm: integer("bleed_mm").notNull().default(3), // 도련 (mm)
  dpi: integer("dpi").notNull().default(300), // 해상도
  isBest: boolean("is_best").notNull().default(false), // BEST 표시
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  categoryIdIdx: index("product_variants_category_id_idx").on(table.categoryId),
  isActiveIdx: index("product_variants_is_active_idx").on(table.isActive)
}));

// 제품 프로젝트 테이블 (사용자가 만든 프로젝트)
export const productProjects = pgTable("product_projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").notNull().references(() => productCategories.id),
  variantId: integer("variant_id").references(() => productVariants.id),
  title: text("title").notNull().default("새 프로젝트"),
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, completed, ordered
  designsData: jsonb("designs_data"), // 디자인 데이터 (엽서의 경우 여러 디자인 + 수량)
  thumbnailUrl: text("thumbnail_url"),
  isTemplate: boolean("is_template").notNull().default(false), // 관리자용 템플릿 여부
  subMissionId: integer("sub_mission_id").references(() => subMissions.id, { onDelete: "set null" }), // 연결된 세부미션 ID (미션 컨텍스트 저장 시)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("product_projects_user_id_idx").on(table.userId),
  categoryIdIdx: index("product_projects_category_id_idx").on(table.categoryId),
  statusIdx: index("product_projects_status_idx").on(table.status),
  subMissionIdx: index("product_projects_sub_mission_id_idx").on(table.subMissionId)
}));

// Relations 정의
export const productCategoriesRelations = relations(productCategories, ({ many }) => ({
  variants: many(productVariants),
  projects: many(productProjects)
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  category: one(productCategories, { fields: [productVariants.categoryId], references: [productCategories.id] }),
  projects: many(productProjects)
}));

export const productProjectsRelations = relations(productProjects, ({ one }) => ({
  user: one(users, { fields: [productProjects.userId], references: [users.id] }),
  category: one(productCategories, { fields: [productProjects.categoryId], references: [productCategories.id] }),
  variant: one(productVariants, { fields: [productProjects.variantId], references: [productVariants.id] }),
  subMission: one(subMissions, { fields: [productProjects.subMissionId], references: [subMissions.id] })
}));

// Zod 스키마 및 타입 정의
export const productCategoriesInsertSchema = createInsertSchema(productCategories, {
  slug: (schema) => schema.min(1, "슬러그를 입력해주세요"),
  name: (schema) => schema.min(1, "이름을 입력해주세요")
});
export const productCategoriesSelectSchema = createSelectSchema(productCategories);
export type ProductCategory = z.infer<typeof productCategoriesSelectSchema>;
export type ProductCategoryInsert = z.infer<typeof productCategoriesInsertSchema>;

export const productVariantsInsertSchema = createInsertSchema(productVariants, {
  name: (schema) => schema.min(1, "이름을 입력해주세요"),
  widthMm: (schema) => schema.min(1, "가로 크기를 입력해주세요"),
  heightMm: (schema) => schema.min(1, "세로 크기를 입력해주세요")
});
export const productVariantsSelectSchema = createSelectSchema(productVariants);
export type ProductVariant = z.infer<typeof productVariantsSelectSchema>;
export type ProductVariantInsert = z.infer<typeof productVariantsInsertSchema>;

export const productProjectsInsertSchema = createInsertSchema(productProjects, {
  title: (schema) => schema.min(1, "제목을 입력해주세요")
});
export const productProjectsSelectSchema = createSelectSchema(productProjects);
export type ProductProject = z.infer<typeof productProjectsSelectSchema>;
export type ProductProjectInsert = z.infer<typeof productProjectsInsertSchema>;

// ===== 디바이스 및 푸시 알림 확장 (FCM) =====
export const userDevices = pgTable("user_devices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceToken: text("device_token").notNull().unique(), // FCM 고유 토큰
  deviceType: varchar("device_type", { length: 20 }).notNull().default("unknown"), // 'android', 'ios', 'web', 'unknown'
  isActive: boolean("is_active").notNull().default(true), // 권한 변경/앱 삭제 등으로 사용불가 판정 시 false 처리
  lastUsedAt: timestamp("last_used_at").defaultNow().notNull(), // 토큰 최종 갱신/사용 시각
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userDevicesRelations = relations(userDevices, ({ one }) => ({
  user: one(users, {
    fields: [userDevices.userId],
    references: [users.id]
  })
}));

export const insertUserDeviceSchema = createInsertSchema(userDevices);
export type UserDevice = typeof userDevices.$inferSelect;
export type InsertUserDevice = z.infer<typeof insertUserDeviceSchema>;

// Export operators for query building
export { eq, desc, and, asc, sql, gte, lte, gt, lt, ne, like, notLike, isNull, isNotNull, inArray } from "drizzle-orm";