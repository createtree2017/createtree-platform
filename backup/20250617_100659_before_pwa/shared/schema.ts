import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
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
});



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
  systemPrompt: text("system_prompt"), // GPT-4o에게 이미지 분석을 위한 지침
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
  // OpenAI 이미지 변환 관련 필드만 유지
  tagSuggestions: jsonb("tag_suggestions"), // Array of strings
  variables: jsonb("variables"), // Array of variable objects
  categoryId: text("category_id").references(() => conceptCategories.categoryId),
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

// 사용자 관련 테이블 관계 정의
export const usersRelations = relations(users, ({ many, one }) => ({
  roles: many(userRoles),
  refreshTokens: many(refreshTokens),
  userMilestones: many(userMilestones),
  pregnancyProfiles: many(pregnancyProfiles),
  hospital: one(hospitals, { fields: [users.hospitalId], references: [hospitals.id] })
}));

// 병원 관계 정의
export const hospitalsRelations = relations(hospitals, ({ many }) => ({
  users: many(users),
  members: many(hospitalMembers)
}));

// Hospital members relations
export const hospitalMembersRelations = relations(hospitalMembers, ({ one }) => ({
  hospital: one(hospitals, {
    fields: [hospitalMembers.hospitalId],
    references: [hospitals.id]
  }),
  user: one(users, {
    fields: [hospitalMembers.userId],
    references: [users.id]
  })
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(userRoles)
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] })
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] })
}));

// Define relations
export const musicRelations = relations(music, ({ one }) => ({

}));

export const imagesRelations = relations(images, ({ one }) => ({
  user: one(users, {
    fields: [images.userId],
    references: [users.id],
  }),
}));

// A/B Testing relations
export const abTestsRelations = relations(abTests, ({ one, many }) => ({
  concept: one(concepts, {
    fields: [abTests.conceptId],
    references: [concepts.conceptId]
  }),
  variants: many(abTestVariants),
  results: many(abTestResults)
}));

export const abTestVariantsRelations = relations(abTestVariants, ({ one, many }) => ({
  test: one(abTests, {
    fields: [abTestVariants.testId],
    references: [abTests.testId]
  }),
  results: many(abTestResults, {
    relationName: "variant_results"
  })
}));

export const abTestResultsRelations = relations(abTestResults, ({ one }) => ({
  test: one(abTests, {
    fields: [abTestResults.testId],
    references: [abTests.testId]
  }),
  variant: one(abTestVariants, {
    fields: [abTestResults.testId, abTestResults.selectedVariantId],
    references: [abTestVariants.testId, abTestVariants.variantId],
    relationName: "variant_results"
  }),
  user: one(users, {
    fields: [abTestResults.userId],
    references: [users.id]
  })
}));

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

// 🗑️ 복잡한 AI 스타일카드 시스템 제거됨 - 간단한 배너로 교체

// Define relations for milestone tables
export const milestoneCategoriesRelations = relations(milestoneCategories, ({ many }) => ({
  milestones: many(milestones)
}));

export const milestonesRelations = relations(milestones, ({ many, one }) => ({
  userMilestones: many(userMilestones),
  category: one(milestoneCategories, {
    fields: [milestones.categoryId],
    references: [milestoneCategories.categoryId]
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

export const pregnancyProfilesRelations = relations(pregnancyProfiles, ({ one }) => ({
  user: one(users, {
    fields: [pregnancyProfiles.userId],
    references: [users.id]
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
});

export const insertHospitalSchema = createInsertSchema(hospitals);
export const insertRoleSchema = createInsertSchema(roles);
export const insertUserRoleSchema = createInsertSchema(userRoles);
export const insertRefreshTokenSchema = createInsertSchema(refreshTokens);

export const insertMusicSchema = createInsertSchema(music, {
  title: (schema) => schema.min(2, '제목은 2글자 이상이어야 합니다'),
  prompt: (schema) => schema.min(3, '프롬프트는 3글자 이상이어야 합니다'),
  url: (schema) => schema.url('유효한 URL이어야 합니다')
});
export const insertImageSchema = createInsertSchema(images);
// 삭제된 테이블들: insertChatMessageSchema, insertFavoriteSchema 제거됨
export const insertSavedChatSchema = createInsertSchema(savedChats);
export const insertPersonaSchema = createInsertSchema(personas);
export const insertPersonaCategorySchema = createInsertSchema(personaCategories);
export const insertConceptSchema = createInsertSchema(concepts);
export const insertConceptCategorySchema = createInsertSchema(conceptCategories);
export const insertAbTestSchema = createInsertSchema(abTests);
export const insertAbTestVariantSchema = createInsertSchema(abTestVariants);
export const insertAbTestResultSchema = createInsertSchema(abTestResults);
export const insertMilestoneCategorySchema = createInsertSchema(milestoneCategories, {
  categoryId: (schema) => schema.min(2, '카테고리 ID는 2글자 이상이어야 합니다'),
  name: (schema) => schema.min(2, '카테고리 이름은 2글자 이상이어야 합니다'),
});
export const insertMilestoneSchema = createInsertSchema(milestones);

// 타입 정의
export type MilestoneCategory = typeof milestoneCategories.$inferSelect;
export type MilestoneCategoryInsert = typeof milestoneCategories.$inferInsert;
export type Milestone = typeof milestones.$inferSelect;
export type MilestoneInsert = typeof milestones.$inferInsert;
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBannerSchema = createInsertSchema(banners);
export type InsertBanner = z.infer<typeof insertBannerSchema>;
export type Banner = typeof banners.$inferSelect;

// 🗑️ 기존 스타일 카드 시스템 제거됨 - 새로운 컨셉 관리 시스템 사용

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
});

// 관계 설정
export const serviceCategoriesRelations = relations(serviceCategories, ({ many }) => ({
  items: many(serviceItems)
}));

export const serviceItemsRelations = relations(serviceItems, ({ one }) => ({
  category: one(serviceCategories, {
    fields: [serviceItems.categoryId],
    references: [serviceCategories.id]
  })
}));

export const insertServiceCategorySchema = createInsertSchema(serviceCategories);
export type InsertServiceCategory = z.infer<typeof insertServiceCategorySchema>;
export type ServiceCategory = typeof serviceCategories.$inferSelect;

export const insertServiceItemSchema = createInsertSchema(serviceItems);
export type InsertServiceItem = z.infer<typeof insertServiceItemSchema>;
export type ServiceItem = typeof serviceItems.$inferSelect;




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
  prompt: (schema) => schema.min(10, "프롬프트는 최소 10자 이상이어야 합니다"),
});

export type MusicStyle = typeof musicStyles.$inferSelect;
export type MusicStyleInsert = z.infer<typeof insertMusicStyleSchema>;

// 음악 스타일 관계 정의 (현재는 외부 키 없음)

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



// Export operators for query building
export { eq, desc, and, asc, sql, gte, lte, gt, lt, ne, like, notLike, isNull, isNotNull, inArray } from "drizzle-orm";
