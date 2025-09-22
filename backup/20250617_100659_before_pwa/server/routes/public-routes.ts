import type { Express } from "express";
import express from "express";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../middleware/auth";
import { generateThumbnail, getThumbnailUrl } from "../utils/thumbnail";
import { generateChatResponse } from "../services/openai-simple";
import { generateMusic } from "../services/replicate";
import { generateContent } from "../services/gemini";
import { 
  generateAiMusic, 
  getAvailableMusicStyles, 
  getAvailableDurations 
} from "../services/topmedia-service";
import { 
  music, 
  images, 
  hospitals,
  smallBanners,
  serviceCategories,
  serviceItems,
  // favorites, savedChats 테이블 삭제됨
  users,
  userNotificationSettings,
} from "../../shared/schema";
import { db } from "../../db/index";
import { or, ne, eq, and, asc, desc } from "drizzle-orm";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg", 
      "image/jpg", 
      "image/png", 
      "image/gif", 
      "image/webp", 
      "image/heic",
      "image/heif"
    ];
    
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error(`허용되지 않는 파일 형식입니다. 허용 형식: ${allowedTypes.join(', ')}`));
    }
    
    cb(null, true);
  },
});

// Schema definitions
const musicGenerationSchema = z.object({
  babyName: z.string().min(1, "Baby name is required"),
  style: z.string().min(1, "Music style is required"),
  duration: z.number().int().min(30).max(180),
});

const aiMusicGenerationSchema = z.object({
  lyrics: z.string().min(1, "Lyrics or phrase is required"),
  style: z.string().min(1, "Music style is required"),
  duration: z.string().min(2, "Duration is required"),
});

const chatMessageSchema = z.object({
  message: z.string().min(1, "Message is required"),
  personaSystemPrompt: z.string().optional(),
});

const favoriteToggleSchema = z.object({
  itemId: z.number().int().positive(),
  type: z.enum(["music", "image"]),
});

const mediaShareSchema = z.object({
  id: z.number().int(),
  type: z.enum(["music", "image"]),
});

const saveChatSchema = z.object({
  title: z.string().min(1, "Title is required"),
  personaId: z.string().min(1, "Persona ID is required"),
  personaName: z.string().min(1, "Persona name is required"),
  personaEmoji: z.string().min(1, "Persona emoji is required"),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
      createdAt: z.string(),
    })
  ).min(1, "At least one message is required"),
  summary: z.string().min(1, "Summary is required"),
  userMemo: z.string().optional(),
  mood: z.string().optional(),
});

const imageGenerationSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
});

// Utility functions
function getUserId(req: express.Request): string {
  const userId = (req as any).user?.id || (req as any).user?.userId;
  return String(userId);
}

function validateUserId(req: express.Request, res: express.Response): string | null {
  const userId = getUserId(req);
  if (!userId || userId === 'undefined') {
    console.error("❌ 사용자 ID가 없습니다:", (req as any).user);
    res.status(400).json({
      success: false,
      message: "사용자 인증 정보가 올바르지 않습니다."
    });
    return null;
  }
  return userId;
}

export function registerPublicRoutes(app: Express): void {
  
  // Public Information Routes
  app.get("/api/small-banners", async (req, res) => {
    try {
      const smallBannersList = await db.select().from(smallBanners).orderBy(smallBanners.order, smallBanners.createdAt);
      
      const mappedBanners = smallBannersList.map(banner => ({
        ...banner,
        imageSrc: banner.imageUrl,
        href: banner.linkUrl
      }));
      
      res.json(mappedBanners);
    } catch (error) {
      console.error("Error fetching small banners:", error);
      res.status(500).json({ error: "Failed to fetch small banners" });
    }
  });

  app.get("/api/menu", async (req, res) => {
    try {
      // 공개된 카테고리들을 가져옴
      const categories = await db.select()
        .from(serviceCategories)
        .where(eq(serviceCategories.isPublic, true))
        .orderBy(asc(serviceCategories.order));

      // 각 카테고리에 대해 하위 항목들을 가져옴
      const menuStructure = [];
      for (const category of categories) {
        const items = await db.select()
          .from(serviceItems)
          .where(and(
            eq(serviceItems.categoryId, category.id),
            eq(serviceItems.isPublic, true)
          ))
          .orderBy(asc(serviceItems.order));

        menuStructure.push({
          id: category.id,
          title: category.title,
          icon: category.icon,
          items: items.map(item => ({
            id: item.id,
            title: item.title,
            path: item.path || `/${item.itemId}`, // path가 없으면 itemId로 생성
            iconName: item.icon
          }))
        });
      }
      
      res.json(menuStructure);
    } catch (error) {
      console.error("Error fetching menu:", error);
      res.status(500).json({ error: "Failed to fetch menu" });
    }
  });

  app.get("/api/hospitals", async (req, res) => {
    try {
      const hospitalsList = await db.select().from(hospitals).orderBy(hospitals.createdAt);
      res.json(hospitalsList);
    } catch (error) {
      console.error("Error fetching hospitals:", error);
      res.status(500).json({ error: "Failed to fetch hospitals" });
    }
  });

  app.get("/api/hospitals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const hospital = await db.query.hospitals.findFirst({
        where: eq(hospitals.id, id)
      });
      
      if (!hospital) {
        return res.status(404).json({ error: "Hospital not found" });
      }
      
      res.json(hospital);
    } catch (error) {
      console.error("Error fetching hospital:", error);
      res.status(500).json({ error: "Failed to fetch hospital" });
    }
  });





  app.get("/api/service-categories", async (req, res) => {
    try {
      const categories = await db.select().from(serviceCategories).orderBy(serviceCategories.order);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching service categories:", error);
      res.status(500).json({ error: "Failed to fetch service categories" });
    }
  });

  // Authentication & Profile Routes
  app.put("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { fullName, email, phoneNumber, dueDate, birthdate } = req.body;

      if (email) {
        const existingUser = await db.query.users.findFirst({
          where: and(eq(users.email, email), ne(users.id, userId))
        });
        
        if (existingUser) {
          return res.status(400).json({ 
            success: false, 
            message: "이미 사용 중인 이메일입니다." 
          });
        }
      }

      const updateData: any = {};
      if (fullName !== undefined) updateData.fullName = fullName;
      if (email !== undefined) updateData.email = email;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
      if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
      if (birthdate !== undefined) updateData.birthdate = birthdate ? new Date(birthdate) : null;
      updateData.updatedAt = new Date();

      const [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();

      res.json({
        success: true,
        message: "프로필이 업데이트되었습니다.",
        user: updatedUser
      });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({
        success: false,
        message: "프로필 업데이트 중 오류가 발생했습니다."
      });
    }
  });

  app.put("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { currentPassword, newPassword } = req.body;

      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!user || !user.password) {
        return res.status(400).json({
          success: false,
          message: "비밀번호를 변경할 수 없습니다. 소셜 로그인 계정입니다."
        });
      }

      const bcrypt = require('bcrypt');
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: "현재 비밀번호가 올바르지 않습니다."
        });
      }

      const saltRounds = 10;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      await db
        .update(users)
        .set({ 
          password: hashedNewPassword,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      res.json({
        success: true,
        message: "비밀번호가 성공적으로 변경되었습니다."
      });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({
        success: false,
        message: "비밀번호 변경 중 오류가 발생했습니다."
      });
    }
  });

  app.get("/api/auth/notification-settings", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;

      let settings = await db.query.userNotificationSettings?.findFirst({
        where: eq(userNotificationSettings.userId, userId)
      });

      if (!settings) {
        const [newSettings] = await db.insert(userNotificationSettings).values({
          userId,
          emailNotifications: true,
          pushNotifications: true,
          smsNotifications: false,
          promotionalEmails: false,
        }).returning();
        
        settings = newSettings;
      }

      res.json({
        success: true,
        settings
      });
    } catch (error) {
      console.error("Error fetching notification settings:", error);
      res.status(500).json({
        success: false,
        message: "알림 설정을 불러오는 중 오류가 발생했습니다."
      });
    }
  });

  app.put("/api/auth/notification-settings", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { emailNotifications, pushNotifications, smsNotifications, marketingEmails } = req.body;

      const updateData = {
        emailNotifications: emailNotifications ?? true,
        pushNotifications: pushNotifications ?? true,
        smsNotifications: smsNotifications ?? false,
        marketingEmails: marketingEmails ?? false,
        updatedAt: new Date()
      };

      const existingSettings = await db.query.userNotificationSettings?.findFirst({
        where: eq(userNotificationSettings.userId, userId)
      });

      let updatedSettings;
      if (existingSettings) {
        [updatedSettings] = await db
          .update(userNotificationSettings)
          .set(updateData)
          .where(eq(userNotificationSettings.userId, userId))
          .returning();
      } else {
        [updatedSettings] = await db.insert(userNotificationSettings).values({
          userId,
          ...updateData
        }).returning();
      }

      res.json({
        success: true,
        message: "알림 설정이 업데이트되었습니다.",
        settings: updatedSettings
      });
    } catch (error) {
      console.error("Error updating notification settings:", error);
      res.status(500).json({
        success: false,
        message: "알림 설정 업데이트 중 오류가 발생했습니다."
      });
    }
  });

  // Image Generation & Processing Routes
  app.post("/api/image/transform", requireAuth, upload.single("image"), async (req, res) => {
    try {
      const userId = validateUserId(req, res);
      if (!userId) return;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "이미지 파일이 필요합니다."
        });
      }

      // Process image transformation logic here
      const transformedImageUrl = `/uploads/${req.file.filename}`;
      
      res.json({
        success: true,
        originalUrl: `/uploads/${req.file.filename}`,
        transformedUrl: transformedImageUrl,
        message: "이미지가 성공적으로 변환되었습니다."
      });
    } catch (error) {
      console.error("Image transform error:", error);
      res.status(500).json({
        success: false,
        message: "이미지 변환 중 오류가 발생했습니다."
      });
    }
  });

  app.get("/api/images", requireAuth, async (req, res) => {
    try {
      const userId = validateUserId(req, res);
      if (!userId) return;

      const userImages = await db.query.images.findMany({
        where: eq(images.userId, userId),
        orderBy: [desc(images.createdAt)]
      });

      res.json({
        success: true,
        images: userImages
      });
    } catch (error) {
      console.error("Error fetching images:", error);
      res.status(500).json({
        success: false,
        message: "이미지를 불러오는 중 오류가 발생했습니다."
      });
    }
  });

  app.delete("/api/images/:id", requireAuth, async (req, res) => {
    try {
      const userId = validateUserId(req, res);
      if (!userId) return;

      const imageId = parseInt(req.params.id);
      
      const imageToDelete = await db.query.images.findFirst({
        where: and(eq(images.id, imageId), eq(images.userId, userId))
      });

      if (!imageToDelete) {
        return res.status(404).json({
          success: false,
          message: "이미지를 찾을 수 없습니다."
        });
      }

      await db.delete(images).where(eq(images.id, imageId));

      res.json({
        success: true,
        message: "이미지가 성공적으로 삭제되었습니다."
      });
    } catch (error) {
      console.error("Error deleting image:", error);
      res.status(500).json({
        success: false,
        message: "이미지 삭제 중 오류가 발생했습니다."
      });
    }
  });

  // Music Generation Routes
  app.get("/api/music-styles", async (req, res) => {
    try {
      const styles = await getAvailableMusicStyles();
      res.json(styles);
    } catch (error) {
      console.error("Error fetching music styles:", error);
      res.status(500).json({ error: "Failed to fetch music styles" });
    }
  });

  app.get("/api/music-durations", async (req, res) => {
    try {
      const durations = await getAvailableDurations();
      res.json({ durations });
    } catch (error) {
      console.error("Error fetching music durations:", error);
      res.status(500).json({ error: "Failed to fetch music durations" });
    }
  });





  // Test & Development Routes
  app.get("/api/public/test", (req, res) => {
    res.json({ 
      message: "Public test endpoint working",
      timestamp: new Date().toISOString()
    });
  });

  app.post("/api/public/image-transform", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const transformedImageUrl = `/uploads/${req.file.filename}`;
      
      res.json({
        success: true,
        originalUrl: `/uploads/${req.file.filename}`,
        transformedUrl: transformedImageUrl,
        message: "Public image transform successful"
      });
    } catch (error) {
      console.error("Public image transform error:", error);
      res.status(500).json({ error: "Image transformation failed" });
    }
  });

  // Development Routes
  app.get('/embed.js', (req, res) => {
    res.type('application/javascript');
    res.send('// Embed script placeholder');
  });

  app.get('/dev-chat-export', (req, res) => {
    res.json({ message: "Dev chat export endpoint" });
  });

  app.get('/dev-history', (req, res) => {
    res.json({ message: "Dev history endpoint" });
  });

  app.get("/api/test-replicate", async (req, res) => {
    try {
      res.json({ 
        message: "Replicate API test endpoint",
        status: "available"
      });
    } catch (error) {
      console.error("Replicate test error:", error);
      res.status(500).json({ error: "Replicate test failed" });
    }
  });
}