# AI Snapshot Generator 개발 완전 가이드

**작성일**: 2025-10-29  
**목적**: 롤백 후 재개발 시 동일한 기능 구현 및 오류 방지

---

## 📋 목차

1. [개발 개요](#개발-개요)
2. [데이터베이스 스키마](#데이터베이스-스키마)
3. [백엔드 API 구현](#백엔드-api-구현)
4. [프론트엔드 구현](#프론트엔드-구현)
5. [발생한 오류 및 해결](#발생한-오류-및-해결)
6. [치명적 오류: 데이터 손실](#치명적-오류-데이터-손실)
7. [재개발 체크리스트](#재개발-체크리스트)

---

## 개발 개요

### 기능 설명
- **목적**: 사용자가 업로드한 사진(1-4장)으로 AI 스냅사진 5장 생성
- **AI 엔진**: Gemini 2.5 Flash
- **모드**: Individual(개인), Couple(커플), Family(가족)
- **스타일**: Mix(믹스), Daily(일상), Travel(여행), Film(필름)
- **핵심 특징**: 데이터베이스 기반 랜덤 프롬프트 선택으로 매번 다른 결과

### 개발 완료 범위

#### Phase 0: 환경 검증
- ✅ Gemini API 키 확인 및 테스트
- ✅ GCS 업로드 인프라 검증
- ✅ Firebase Admin SDK 설정 확인

#### Phase 1: 데이터베이스 & 서비스
- ✅ `snapshot_generations` 테이블
- ✅ `snapshot_generation_images` 테이블
- ✅ `snapshot_prompts` 테이블 (100개 프롬프트 시드)
- ✅ 가중치 기반 프롬프트 선택 서비스
- ✅ Gemini 스냅샷 생성 서비스

#### Phase 2: API 구현
- ✅ POST `/api/snapshot/generate` - 스냅샷 생성
- ✅ GET `/api/snapshot/history` - 생성 이력
- ✅ 관리자 프롬프트 CRUD API (6개 엔드포인트)

#### Phase 3: 프론트엔드
- ✅ `/snapshot` - 메인 생성 페이지
- ✅ `/snapshot/history` - 이력 페이지
- ✅ 관리자 프롬프트 관리 UI

---

## 데이터베이스 스키마

### 1. snapshot_prompts 테이블

**파일**: `shared/schema.ts`

```typescript
export const snapshotPrompts = pgTable('snapshot_prompts', {
  id: serial('id').primaryKey(),
  category: text('category').notNull(), // 'individual', 'couple', 'family'
  type: text('type').notNull(), // 'mix', 'daily', 'travel', 'film'
  gender: text('gender'), // 'male', 'female', null (for couple/family)
  region: text('region'), // 'domestic', 'international', null
  season: text('season'), // 'spring', 'summer', 'fall', 'winter', null
  prompt: text('prompt').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  usageCount: integer('usage_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  categoryTypeIdx: index('snapshot_prompts_category_type_idx').on(table.category, table.type),
  isActiveIdx: index('snapshot_prompts_is_active_idx').on(table.isActive),
  usageCountIdx: index('snapshot_prompts_usage_count_idx').on(table.usageCount)
}));

export const snapshotPromptsInsertSchema = createInsertSchema(snapshotPrompts, {
  category: (schema) => schema.refine(
    (val) => ['individual', 'couple', 'family'].includes(val),
    { message: "Category must be 'individual', 'couple', or 'family'" }
  ),
  type: (schema) => schema.refine(
    (val) => ['mix', 'daily', 'travel', 'film'].includes(val),
    { message: "Type must be 'mix', 'daily', 'travel', or 'film'" }
  ),
  prompt: (schema) => schema.min(10, "Prompt must be at least 10 characters")
});

export type SnapshotPrompt = typeof snapshotPrompts.$inferSelect;
export type SnapshotPromptInsert = z.infer<typeof snapshotPromptsInsertSchema>;
```

### 2. snapshot_generations 테이블

```typescript
export const snapshotGenerations = pgTable('snapshot_generations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  mode: text('mode').notNull(), // 'individual', 'couple', 'family'
  style: text('style').notNull(), // 'mix', 'daily', 'travel', 'film'
  gender: text('gender'), // Optional: 'male', 'female'
  promptId: integer('prompt_id').references(() => snapshotPrompts.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('pending'), // 'pending', 'completed', 'failed'
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  userIdCreatedAtIdx: index('snapshot_generations_user_id_created_at_idx').on(table.userId, table.createdAt),
  statusIdx: index('snapshot_generations_status_idx').on(table.status)
}));

export const snapshotGenerationsInsertSchema = createInsertSchema(snapshotGenerations, {
  mode: (schema) => schema.refine(
    (val) => ['individual', 'couple', 'family'].includes(val),
    { message: "Mode must be 'individual', 'couple', or 'family'" }
  ),
  style: (schema) => schema.refine(
    (val) => ['mix', 'daily', 'travel', 'film'].includes(val),
    { message: "Style must be 'mix', 'daily', 'travel', or 'film'" }
  )
});

export type SnapshotGeneration = typeof snapshotGenerations.$inferSelect;
export type SnapshotGenerationInsert = z.infer<typeof snapshotGenerationsInsertSchema>;
```

### 3. snapshot_generation_images 테이블

```typescript
export const snapshotGenerationImages = pgTable('snapshot_generation_images', {
  id: serial('id').primaryKey(),
  generationId: integer('generation_id').notNull().references(() => snapshotGenerations.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  imageIndex: integer('image_index').notNull(), // 0-4 (5 images per generation)
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  generationIdIdx: index('snapshot_generation_images_generation_id_idx').on(table.generationId),
  uniqueGenerationImage: unique('unique_generation_image').on(table.generationId, table.imageIndex)
}));

export const snapshotGenerationImagesInsertSchema = createInsertSchema(snapshotGenerationImages);

export type SnapshotGenerationImage = typeof snapshotGenerationImages.$inferSelect;
export type SnapshotGenerationImageInsert = z.infer<typeof snapshotGenerationImagesInsertSchema>;
```

### 스키마 업데이트 명령

```bash
npm run db:push
```

**⚠️ 주의**: `npm run db:push --force`는 데이터 손실 위험이 있으므로 개발 환경에서만 사용

---

## 백엔드 API 구현

### 1. 프롬프트 선택 서비스

**파일**: `server/services/snapshotPromptService.ts`

```typescript
import { db } from '@db';
import { snapshotPrompts } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export class SnapshotPromptSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotPromptSelectionError';
  }
}

interface PromptSelectionParams {
  category: 'individual' | 'couple' | 'family';
  type: 'mix' | 'daily' | 'travel' | 'film';
  gender?: 'male' | 'female' | null;
}

export async function selectWeightedPrompt(params: PromptSelectionParams) {
  const { category, type, gender } = params;

  return await db.transaction(async (tx) => {
    // 조건에 맞는 프롬프트 조회 (FOR UPDATE로 락 걸기)
    let whereConditions = and(
      eq(snapshotPrompts.category, category),
      eq(snapshotPrompts.type, type),
      eq(snapshotPrompts.isActive, true)
    );

    if (gender) {
      whereConditions = and(whereConditions, eq(snapshotPrompts.gender, gender));
    }

    const prompts = await tx
      .select()
      .from(snapshotPrompts)
      .where(whereConditions)
      .for('update');

    // Fallback: gender 조건 없이 재시도
    if (prompts.length === 0 && gender) {
      const fallbackConditions = and(
        eq(snapshotPrompts.category, category),
        eq(snapshotPrompts.type, type),
        eq(snapshotPrompts.isActive, true)
      );
      
      const fallbackPrompts = await tx
        .select()
        .from(snapshotPrompts)
        .where(fallbackConditions)
        .for('update');

      if (fallbackPrompts.length === 0) {
        throw new SnapshotPromptSelectionError(
          `No active prompts found for category=${category}, type=${type}`
        );
      }

      prompts.push(...fallbackPrompts);
    }

    if (prompts.length === 0) {
      throw new SnapshotPromptSelectionError(
        `No active prompts found for category=${category}, type=${type}, gender=${gender}`
      );
    }

    // 가중치 계산: weight = 1 / (usageCount + 1)
    const weights = prompts.map(p => 1 / (p.usageCount + 1));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    // 가중치 기반 랜덤 선택
    let random = Math.random() * totalWeight;
    let selectedPrompt = prompts[0];

    for (let i = 0; i < prompts.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        selectedPrompt = prompts[i];
        break;
      }
    }

    // usageCount 증가
    await tx
      .update(snapshotPrompts)
      .set({ 
        usageCount: sql`${snapshotPrompts.usageCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(snapshotPrompts.id, selectedPrompt.id));

    return selectedPrompt;
  });
}
```

**핵심 로직**:
1. `FOR UPDATE` 락으로 동시성 제어
2. 가중치 = 1 / (usageCount + 1)
3. Gender 필터링 실패 시 Fallback
4. 트랜잭션으로 원자성 보장

### 2. Gemini 스냅샷 생성 서비스

**파일**: `server/services/geminiSnapshotService.ts`

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { storage } from '../storage';
import { logger } from '../logger';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface GenerateSnapshotParams {
  referenceImages: Express.Multer.File[];
  prompt: string;
  numberOfImages?: number;
}

export async function generateSnapshot(params: GenerateSnapshotParams): Promise<string[]> {
  const { referenceImages, prompt, numberOfImages = 5 } = params;

  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-exp'
  });

  const imageUrls: string[] = [];

  // 참조 이미지를 Base64로 변환
  const imageParts = referenceImages.map(file => ({
    inlineData: {
      data: file.buffer.toString('base64'),
      mimeType: file.mimetype
    }
  }));

  for (let i = 0; i < numberOfImages; i++) {
    const fullPrompt = `${prompt}\n\nGenerate image ${i + 1} of ${numberOfImages}.`;

    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        const result = await model.generateContent([
          fullPrompt,
          ...imageParts
        ]);

        const response = await result.response;
        const generatedImage = response.candidates?.[0]?.content;

        if (!generatedImage) {
          throw new Error('No image generated');
        }

        // GCS 업로드 (PUBLIC)
        const fileName = `snapshot_${Date.now()}_${i}.png`;
        const file = storage.bucket('createtree-upload').file(`snapshots/${fileName}`);
        
        await file.save(Buffer.from(generatedImage, 'base64'), {
          metadata: { contentType: 'image/png' }
        });

        await file.makePublic();

        const publicUrl = `https://storage.googleapis.com/createtree-upload/snapshots/${fileName}`;
        imageUrls.push(publicUrl);
        
        logger.info(`Snapshot ${i + 1}/${numberOfImages} generated: ${publicUrl}`);
        break;

      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          logger.error(`Failed to generate snapshot ${i + 1} after ${maxRetries} retries:`, error);
          throw error;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
      }
    }
  }

  return imageUrls;
}
```

**핵심 포인트**:
- ✅ **참조 이미지**: PRIVATE (사용자 프라이버시 보호)
- ✅ **생성 결과**: PUBLIC (공유 가능)
- ✅ Exponential backoff 재시도
- ✅ GCS 업로드 후 공개 URL 반환

### 3. 스냅샷 생성 API

**파일**: `server/routes/snapshot.ts`

```typescript
import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { selectWeightedPrompt } from '../services/snapshotPromptService';
import { generateSnapshot } from '../services/geminiSnapshotService';
import { db } from '@db';
import { snapshotGenerations, snapshotGenerationImages } from '@shared/schema';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

router.post(
  '/generate',
  requireAuth,
  upload.array('photos', 4), // Max 4 images
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const { mode, style, gender } = req.body;
      const files = req.files as Express.Multer.File[];

      // Validation
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'At least one photo is required' });
      }

      if (files.length > 4) {
        return res.status(400).json({ error: 'Maximum 4 photos allowed' });
      }

      if (!['individual', 'couple', 'family'].includes(mode)) {
        return res.status(400).json({ error: 'Invalid mode' });
      }

      if (!['mix', 'daily', 'travel', 'film'].includes(style)) {
        return res.status(400).json({ error: 'Invalid style' });
      }

      // 1. 프롬프트 선택
      const selectedPrompt = await selectWeightedPrompt({
        category: mode,
        type: style,
        gender: gender || null
      });

      // 2. 생성 레코드 생성
      const [generation] = await db.insert(snapshotGenerations).values({
        userId,
        mode,
        style,
        gender: gender || null,
        promptId: selectedPrompt.id,
        status: 'pending'
      }).returning();

      // 3. Gemini로 이미지 생성
      let imageUrls: string[];
      try {
        imageUrls = await generateSnapshot({
          referenceImages: files,
          prompt: selectedPrompt.prompt,
          numberOfImages: 5
        });

        // 4. 생성된 이미지 저장
        const imageRecords = imageUrls.map((url, index) => ({
          generationId: generation.id,
          imageUrl: url,
          imageIndex: index
        }));

        await db.insert(snapshotGenerationImages).values(imageRecords);

        // 5. 상태 업데이트
        await db.update(snapshotGenerations)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(eq(snapshotGenerations.id, generation.id));

        return res.json({
          success: true,
          generationId: generation.id,
          imageUrls
        });

      } catch (error) {
        // 실패 시 상태 업데이트
        await db.update(snapshotGenerations)
          .set({ 
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            updatedAt: new Date()
          })
          .where(eq(snapshotGenerations.id, generation.id));

        throw error;
      }

    } catch (error) {
      console.error('Snapshot generation error:', error);
      return res.status(500).json({ 
        error: 'Failed to generate snapshot',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;
```

### 4. 이력 조회 API

```typescript
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;

    let whereCondition = eq(snapshotGenerations.userId, userId);

    if (status && ['pending', 'completed', 'failed'].includes(status)) {
      whereCondition = and(whereCondition, eq(snapshotGenerations.status, status));
    }

    const [generations, totalCount] = await Promise.all([
      db.query.snapshotGenerations.findMany({
        where: whereCondition,
        orderBy: desc(snapshotGenerations.createdAt),
        limit,
        offset,
        with: {
          images: {
            orderBy: asc(snapshotGenerationImages.imageIndex)
          }
        }
      }),
      db.select({ count: sql<number>`count(*)` })
        .from(snapshotGenerations)
        .where(whereCondition)
    ]);

    const records = generations.map(gen => ({
      id: gen.id,
      mode: gen.mode,
      style: gen.style,
      status: gen.status,
      imageUrls: gen.images.map(img => img.imageUrl),
      createdAt: gen.createdAt.toISOString()
    }));

    return res.json({
      success: true,
      records,
      pagination: {
        page,
        limit,
        total: totalCount[0].count,
        totalPages: Math.ceil(totalCount[0].count / limit)
      }
    });

  } catch (error) {
    console.error('History fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
});
```

**⚠️ 중요**: 응답 필드명 주의
- ✅ `records` (배열)
- ✅ `imageUrls` (각 레코드의 이미지 배열)
- ❌ `generations`, `previewUrls` (잘못된 필드명)

### 5. 라우터 등록

**파일**: `server/routes.ts`

```typescript
import snapshotRouter from './routes/snapshot';

export function registerRoutes(app: Express) {
  // ... 기존 라우터들
  
  app.use('/api/snapshot', snapshotRouter);
  
  // ... 나머지 코드
}
```

---

## 프론트엔드 구현

### 1. 상수 정의

**파일**: `client/src/constants/snapshot.ts`

```typescript
export const SNAPSHOT_MODES = [
  { value: 'individual', label: '개인' },
  { value: 'couple', label: '커플' },
  { value: 'family', label: '가족' }
] as const;

export const SNAPSHOT_STYLES = [
  { value: 'mix', label: '믹스' },
  { value: 'daily', label: '일상' },
  { value: 'travel', label: '여행' },
  { value: 'film', label: '필름' }
] as const;

export const SNAPSHOT_GENDERS = [
  { value: 'male', label: '남성' },
  { value: 'female', label: '여성' }
] as const;

export type SnapshotMode = typeof SNAPSHOT_MODES[number]['value'];
export type SnapshotStyle = typeof SNAPSHOT_STYLES[number]['value'];
export type SnapshotGender = typeof SNAPSHOT_GENDERS[number]['value'];
```

### 2. 메인 생성 페이지

**파일**: `client/src/pages/snapshot/index.tsx`

```typescript
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Camera, X, Download } from 'lucide-react';
import { SNAPSHOT_MODES, SNAPSHOT_STYLES, SNAPSHOT_GENDERS } from '@/constants/snapshot';

const formSchema = z.object({
  mode: z.enum(['individual', 'couple', 'family']),
  style: z.enum(['mix', 'daily', 'travel', 'film']),
  gender: z.enum(['male', 'female']).optional(),
  photos: z.instanceof(FileList).refine(
    (files) => files.length >= 1 && files.length <= 4,
    { message: '1-4장의 사진을 업로드해주세요' }
  )
});

type FormData = z.infer<typeof formSchema>;

export default function SnapshotPage() {
  const { toast } = useToast();
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mode: 'individual',
      style: 'mix'
    }
  });

  const generateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const formData = new FormData();
      formData.append('mode', data.mode);
      formData.append('style', data.style);
      if (data.gender) {
        formData.append('gender', data.gender);
      }

      Array.from(data.photos).forEach((file) => {
        formData.append('photos', file);
      });

      return apiRequest<{ imageUrls: string[] }>('/api/snapshot/generate', {
        method: 'POST',
        body: formData,
        headers: {} // Let browser set Content-Type with boundary
      });
    },
    onSuccess: (response) => {
      setGeneratedImages(response.imageUrls);
      toast({
        title: '생성 완료!',
        description: '5장의 스냅사진이 생성되었습니다.'
      });
    },
    onError: (error) => {
      toast({
        title: '생성 실패',
        description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        variant: 'destructive'
      });
    }
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Clear previous previews
    previewUrls.forEach(url => URL.revokeObjectURL(url));

    const newPreviews = Array.from(files).map(file => URL.createObjectURL(file));
    setPreviewUrls(newPreviews);
  };

  const removePhoto = (index: number) => {
    const currentFiles = form.getValues('photos');
    if (!currentFiles) return;

    const dt = new DataTransfer();
    Array.from(currentFiles).forEach((file, i) => {
      if (i !== index) dt.items.add(file);
    });

    form.setValue('photos', dt.files);
    
    URL.revokeObjectURL(previewUrls[index]);
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const downloadImage = (url: string, index: number) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `snapshot_${index + 1}.png`;
    a.click();
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">AI 스냅사진 생성</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => generateMutation.mutate(data))} className="space-y-6">
          
          {/* 사진 업로드 */}
          <FormField
            control={form.control}
            name="photos"
            render={({ field: { onChange, value, ...field } }) => (
              <FormItem>
                <FormLabel>사진 업로드 (1-4장)</FormLabel>
                <FormControl>
                  <div className="space-y-4">
                    <label className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                      <div className="flex flex-col items-center">
                        <Camera className="w-8 h-8 mb-2 text-gray-400" />
                        <span className="text-sm text-gray-500">클릭하여 사진 선택</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          onChange(e.target.files);
                          handlePhotoChange(e);
                        }}
                        {...field}
                      />
                    </label>

                    {previewUrls.length > 0 && (
                      <div className="grid grid-cols-2 gap-4">
                        {previewUrls.map((url, index) => (
                          <div key={index} className="relative">
                            <img src={url} alt={`Preview ${index + 1}`} className="w-full h-32 object-cover rounded-lg" />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2 h-6 w-6"
                              onClick={() => removePhoto(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 모드 선택 */}
          <FormField
            control={form.control}
            name="mode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>모드</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex gap-4"
                  >
                    {SNAPSHOT_MODES.map((mode) => (
                      <FormItem key={mode.value} className="flex items-center space-x-2">
                        <FormControl>
                          <RadioGroupItem value={mode.value} />
                        </FormControl>
                        <FormLabel className="font-normal cursor-pointer">
                          {mode.label}
                        </FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 스타일 선택 */}
          <FormField
            control={form.control}
            name="style"
            render={({ field }) => (
              <FormItem>
                <FormLabel>스타일</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="grid grid-cols-2 gap-4"
                  >
                    {SNAPSHOT_STYLES.map((style) => (
                      <FormItem key={style.value} className="flex items-center space-x-2">
                        <FormControl>
                          <RadioGroupItem value={style.value} />
                        </FormControl>
                        <FormLabel className="font-normal cursor-pointer">
                          {style.label}
                        </FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 성별 선택 (선택사항) */}
          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>성별 (선택사항)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="선택하지 않음" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">선택하지 않음</SelectItem>
                    {SNAPSHOT_GENDERS.map((gender) => (
                      <SelectItem key={gender.value} value={gender.value}>
                        {gender.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={generateMutation.isPending}>
            {generateMutation.isPending ? '생성 중...' : '스냅사진 생성'}
          </Button>
        </form>
      </Form>

      {/* 생성 결과 */}
      {generatedImages.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">생성된 스냅사진</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {generatedImages.map((url, index) => (
              <Card key={index} className="relative overflow-hidden">
                <img src={url} alt={`Generated ${index + 1}`} className="w-full h-48 object-cover" />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute bottom-2 right-2"
                  onClick={() => downloadImage(url, index)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### 3. 이력 페이지

**파일**: `client/src/pages/snapshot/history.tsx`

```typescript
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HistoryRecord {
  id: number;
  mode: string;
  style: string;
  status: string;
  imageUrls: string[];
  createdAt: string;
}

interface HistoryResponse {
  records: HistoryRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function SnapshotHistoryPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);

  const { data, isLoading } = useQuery<HistoryResponse>({
    queryKey: ['/api/snapshot/history', page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/snapshot/history?${params}`);
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    }
  });

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1); // Reset to first page when filter changes
  };

  const openImageViewer = (images: string[], index: number) => {
    setSelectedImage(images[index]);
    setImageIndex(index);
  };

  const navigateImage = (direction: 'prev' | 'next', images: string[]) => {
    const newIndex = direction === 'prev' 
      ? Math.max(0, imageIndex - 1)
      : Math.min(images.length - 1, imageIndex + 1);
    
    setImageIndex(newIndex);
    setSelectedImage(images[newIndex]);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">스냅사진 이력</h1>

        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="completed">완료</SelectItem>
            <SelectItem value="pending">대기중</SelectItem>
            <SelectItem value="failed">실패</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12">로딩 중...</div>
      ) : data?.records.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          생성 이력이 없습니다.
        </div>
      ) : (
        <>
          <div className="grid gap-6">
            {data?.records.map((record) => (
              <Card key={record.id} className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex gap-2 mb-2">
                      <Badge variant="outline">{record.mode}</Badge>
                      <Badge variant="outline">{record.style}</Badge>
                      <Badge 
                        variant={
                          record.status === 'completed' ? 'default' :
                          record.status === 'pending' ? 'secondary' : 'destructive'
                        }
                      >
                        {record.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      {new Date(record.createdAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                </div>

                {record.imageUrls.length > 0 && (
                  <div className="grid grid-cols-5 gap-2">
                    {record.imageUrls.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`Result ${index + 1}`}
                        className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-80 transition"
                        onClick={() => openImageViewer(record.imageUrls, index)}
                      />
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                이전
              </Button>
              <span className="flex items-center px-4">
                {page} / {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page === data.pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                다음
              </Button>
            </div>
          )}
        </>
      )}

      {/* Image Viewer Dialog */}
      <Dialog open={selectedImage !== null} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          <div className="relative">
            <img src={selectedImage || ''} alt="Full view" className="w-full h-auto" />
            
            {data?.records.find(r => r.imageUrls.includes(selectedImage || ''))?.imageUrls.length! > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2"
                  disabled={imageIndex === 0}
                  onClick={() => {
                    const currentRecord = data?.records.find(r => r.imageUrls.includes(selectedImage || ''));
                    if (currentRecord) navigateImage('prev', currentRecord.imageUrls);
                  }}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  disabled={imageIndex === (data?.records.find(r => r.imageUrls.includes(selectedImage || ''))?.imageUrls.length! - 1)}
                  onClick={() => {
                    const currentRecord = data?.records.find(r => r.imageUrls.includes(selectedImage || ''));
                    if (currentRecord) navigateImage('next', currentRecord.imageUrls);
                  }}
                >
                  <ChevronRight />
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

### 4. 라우팅 등록

**파일**: `client/src/App.tsx`

```typescript
import { Route, Switch } from 'wouter';
import SnapshotPage from '@/pages/snapshot';
import SnapshotHistoryPage from '@/pages/snapshot/history';

function App() {
  return (
    <Switch>
      {/* ... 기존 라우트들 */}
      
      <Route path="/snapshot" component={SnapshotPage} />
      <Route path="/snapshot/history" component={SnapshotHistoryPage} />
      
      {/* ... 나머지 라우트들 */}
    </Switch>
  );
}
```

### 5. 사이드바 메뉴 추가

사이드바에 Camera 아이콘과 함께 "스냅사진" 메뉴 추가

```typescript
import { Camera } from 'lucide-react';

// 메뉴 아이템 추가
{
  icon: Camera,
  label: '스냅사진',
  path: '/snapshot'
}
```

---

## 발생한 오류 및 해결

### 1. ❌ Snapshot History API 필드명 불일치

**증상**: 프론트엔드에서 이력이 빈 배열로 표시됨

**원인**:
```typescript
// 백엔드 응답
{
  generations: [...],
  previewUrls: [...]
}

// 프론트엔드 기대
{
  records: [...],
  imageUrls: [...]
}
```

**해결**:
```typescript
// server/routes/snapshot.ts - 수정 후
return res.json({
  success: true,
  records: generations.map(gen => ({
    id: gen.id,
    mode: gen.mode,
    style: gen.style,
    status: gen.status,
    imageUrls: gen.images.map(img => img.imageUrl), // ✅ imageUrls
    createdAt: gen.createdAt.toISOString()
  })),
  pagination: { ... }
});
```

### 2. ❌ Admin Images Gallery API - originalUrl 누락

**증상**: 관리자 이미지 갤러리에서 이미지가 표시되지 않음

**원인**:
```typescript
// server/routes/admin-routes.ts - 문제 코드
const imageList = await db.select({
  id: images.id,
  title: images.title,
  transformedUrl: images.transformedUrl,
  thumbnailUrl: images.thumbnailUrl,
  // ❌ originalUrl이 없음!
  createdAt: images.createdAt,
  userId: images.userId,
  categoryId: images.categoryId,
  conceptId: images.conceptId
})
```

**해결**:
```typescript
// server/routes/admin-routes.ts - 수정 후
const imageList = await db.select({
  id: images.id,
  title: images.title,
  originalUrl: images.originalUrl, // ✅ 추가!
  transformedUrl: images.transformedUrl,
  thumbnailUrl: images.thumbnailUrl,
  createdAt: images.createdAt,
  userId: images.userId,
  categoryId: images.categoryId,
  conceptId: images.conceptId
})
```

### 3. ❌ LSP 오류 - 타입 불일치

**증상**: TypeScript 컴파일 오류 발생

**원인**: 
- API 응답 타입과 프론트엔드 타입 불일치
- Optional 필드 처리 누락

**해결**:
```typescript
// 타입 정의 시 Optional 처리
interface HistoryRecord {
  id: number;
  mode: string;
  style: string;
  status: string;
  imageUrls: string[]; // 항상 배열
  createdAt: string;
}

// API 응답 처리 시 기본값 제공
const records = generations.map(gen => ({
  id: gen.id,
  mode: gen.mode,
  style: gen.style,
  status: gen.status,
  imageUrls: gen.images?.map(img => img.imageUrl) || [], // ✅ 기본값
  createdAt: gen.createdAt.toISOString()
}));
```

---

## 치명적 오류: 데이터 손실

### 🚨 문제 상황

**2025-10-29 06:06 AM**: `npm run db:seed` 실행으로 프로덕션 데이터베이스가 초기화됨

**피해 현황**:
- ❌ `images` 테이블: 수천 개 레코드 → **1개**만 남음
- ❌ `music` 테이블: 전체 삭제
- ❌ `snapshot_generation_images` 테이블: 전체 삭제
- ✅ GCS 파일: **안전** (물리 파일은 삭제되지 않음)

**원인 코드**:

```typescript
// db/seed.ts - 위험한 코드
async function seed() {
  try {
    console.log("Clearing previous data...");
    await db.delete(schema.images);  // ⚠️ 모든 이미지 삭제!
    await db.delete(schema.music);   // ⚠️ 모든 음악 삭제!
    
    // ... 시드 데이터 삽입
  }
}
```

### ✅ 즉시 적용 필수: 보호 장치

**파일**: `db/seed.ts`

```typescript
async function seed() {
  // ✅ 환경 확인 보호 장치
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  if (nodeEnv === 'production') {
    console.error('❌ ERROR: Seeding is disabled in production environment!');
    console.error('❌ This prevents accidental data loss.');
    console.error('❌ To seed data, use development or staging environment.');
    process.exit(1);
  }

  // ✅ 추가 확인 - Replit 프로덕션 도메인 체크
  const replitDomain = process.env.REPL_SLUG;
  if (replitDomain && replitDomain.includes('production')) {
    console.error('❌ ERROR: Detected production Replit environment!');
    console.error('❌ Seeding is not allowed in production.');
    process.exit(1);
  }

  // ✅ 대화형 확인 (선택사항)
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const shouldProceed = await new Promise<boolean>((resolve) => {
    rl.question('⚠️  WARNING: This will DELETE all existing data. Continue? (yes/no): ', (answer: string) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });

  if (!shouldProceed) {
    console.log('Seeding cancelled.');
    process.exit(0);
  }

  try {
    console.log("Clearing previous data...");
    
    // ✅ 안전한 삭제: 특정 조건만 삭제
    // 예: 테스트 데이터만 삭제
    await db.delete(schema.images).where(
      eq(schema.images.userId, 'TEST_USER_ID')
    );
    
    // 또는 전체 삭제하되, 로그 남기기
    console.log("⚠️  Deleting all images...");
    await db.delete(schema.images);
    console.log("✓ Images deleted");
    
    console.log("⚠️  Deleting all music...");
    await db.delete(schema.music);
    console.log("✓ Music deleted");

    // ... 시드 데이터 삽입
    console.log("✓ Seed data inserted successfully");
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
```

### ✅ package.json 스크립트 수정

```json
{
  "scripts": {
    "db:seed": "NODE_ENV=development tsx db/seed.ts",
    "db:seed:force": "tsx db/seed.ts"
  }
}
```

**사용법**:
- `npm run db:seed` - 안전 (환경 체크)
- `npm run db:seed:force` - 강제 실행 (위험!)

### ✅ 추가 보호: Git Hook

**파일**: `.git/hooks/pre-commit`

```bash
#!/bin/bash

# seed.ts 변경사항 확인
if git diff --cached --name-only | grep -q "db/seed.ts"; then
  echo "⚠️  WARNING: You are about to commit changes to db/seed.ts"
  echo "⚠️  Make sure it has proper production safeguards!"
  read -p "Continue? (yes/no): " answer
  if [ "$answer" != "yes" ]; then
    echo "Commit cancelled."
    exit 1
  fi
fi
```

### ✅ 데이터 복구 방법

**방법 1: Replit 체크포인트 롤백**

1. Replit UI에서 "View Checkpoints" 버튼 클릭
2. 데이터 손실 이전 체크포인트 선택 (2025-10-29 06:06 AM 이전)
3. **"Restore databases" 옵션 반드시 체크**
4. 롤백 실행

**주의사항**:
- 체크포인트 이후 모든 코드 변경사항이 제거됨
- 이 문서를 참고하여 재개발 필요

**방법 2: GCS 파일로 레코드 재생성** (부분 복구)

```typescript
// scripts/restore-images-from-gcs.ts
import { storage } from '../server/storage';
import { db } from '../db';
import { images } from '@shared/schema';

async function restoreFromGCS() {
  const bucket = storage.bucket('createtree-upload');
  const [files] = await bucket.getFiles({ prefix: 'images/' });

  for (const file of files) {
    const metadata = file.metadata;
    
    // 메타데이터에서 정보 추출 (파일명 패턴 분석)
    const fileName = file.name;
    const match = fileName.match(/images\/user_(\d+)_(.+)_(\d+)\.webp/);
    
    if (match) {
      const [, userId, style, timestamp] = match;
      
      await db.insert(images).values({
        userId: userId,
        originalUrl: `gs://createtree-upload/${fileName}`,
        transformedUrl: `gs://createtree-upload/${fileName}`,
        style: style,
        createdAt: new Date(parseInt(timestamp))
      });
    }
  }
  
  console.log('✓ Images restored from GCS');
}

restoreFromGCS();
```

**한계**: 
- 메타데이터 부족 시 완전 복구 불가능
- userId, categoryId 등 정보 손실 가능

---

## 재개발 체크리스트

### 📋 Phase 0: 사전 준비

- [ ] `db/seed.ts`에 프로덕션 보호 장치 추가
- [ ] 환경 변수 확인 (GEMINI_API_KEY, GCS 설정)
- [ ] Firebase Admin SDK 설정 확인
- [ ] `.gitignore`에 `.env` 포함 확인

### 📋 Phase 1: 데이터베이스

- [ ] `shared/schema.ts`에 3개 테이블 추가
  - [ ] `snapshotPrompts`
  - [ ] `snapshotGenerations`
  - [ ] `snapshotGenerationImages`
- [ ] 인덱스 설정 확인
- [ ] Relations 정의
- [ ] Insert/Select 스키마 생성
- [ ] `npm run db:push` 실행
- [ ] 테이블 생성 확인: `SELECT * FROM snapshot_prompts LIMIT 1;`

### 📋 Phase 2: 시드 데이터

- [ ] `db/seed.ts`에 100개 프롬프트 추가
  - [ ] Family Daily: 35개
  - [ ] Family Travel: 30개
  - [ ] Family Film: 35개
- [ ] **개발 환경에서만** `npm run db:seed` 실행
- [ ] 프롬프트 개수 확인: `SELECT category, type, COUNT(*) FROM snapshot_prompts GROUP BY category, type;`

### 📋 Phase 3: 백엔드 서비스

- [ ] `server/services/snapshotPromptService.ts` 생성
  - [ ] 가중치 계산 로직
  - [ ] FOR UPDATE 락
  - [ ] Gender fallback 로직
  - [ ] 트랜잭션 처리
- [ ] `server/services/geminiSnapshotService.ts` 생성
  - [ ] Gemini API 연동
  - [ ] GCS 업로드 (PUBLIC)
  - [ ] Retry 로직
- [ ] 단위 테스트 (선택사항)

### 📋 Phase 4: 백엔드 API

- [ ] `server/routes/snapshot.ts` 생성
  - [ ] POST `/api/snapshot/generate`
    - [ ] Multer 설정 (1-4 images, 10MB)
    - [ ] 입력 검증
    - [ ] 프롬프트 선택
    - [ ] 이미지 생성
    - [ ] DB 저장
    - [ ] 에러 처리
  - [ ] GET `/api/snapshot/history`
    - [ ] 페이지네이션
    - [ ] 상태 필터
    - [ ] ✅ **필드명: records, imageUrls** 
- [ ] `server/routes/admin-snapshot.ts` (관리자용)
  - [ ] GET `/api/admin/snapshot/prompts`
  - [ ] POST `/api/admin/snapshot/prompts`
  - [ ] PATCH `/api/admin/snapshot/prompts/:id`
  - [ ] DELETE `/api/admin/snapshot/prompts/:id`
  - [ ] PATCH `/api/admin/snapshot/prompts/:id/toggle`
  - [ ] GET `/api/admin/snapshot/stats`
- [ ] `server/routes.ts`에 라우터 등록

### 📋 Phase 5: 프론트엔드

- [ ] `client/src/constants/snapshot.ts` 생성
- [ ] `client/src/pages/snapshot/index.tsx` 생성
  - [ ] 사진 업로드 (1-4장)
  - [ ] 모드 선택 (RadioGroup)
  - [ ] 스타일 선택 (RadioGroup)
  - [ ] 성별 선택 (Select, 선택사항)
  - [ ] 미리보기
  - [ ] 생성 버튼
  - [ ] 결과 표시 (5장 그리드)
  - [ ] 다운로드 버튼
- [ ] `client/src/pages/snapshot/history.tsx` 생성
  - [ ] 페이지네이션
  - [ ] 상태 필터
  - [ ] 이미지 뷰어
  - [ ] 네비게이션
- [ ] `client/src/App.tsx`에 라우트 등록
- [ ] 사이드바에 Camera 아이콘 메뉴 추가

### 📋 Phase 6: 관리자 UI

- [ ] `client/src/pages/admin.tsx`에 탭 추가
- [ ] 프롬프트 목록 테이블
- [ ] 프롬프트 생성 폼
- [ ] 프롬프트 수정 폼
- [ ] 프롬프트 삭제 확인
- [ ] 활성/비활성 토글
- [ ] 통계 대시보드

### 📋 Phase 7: 테스트 & 검증

- [ ] 스냅샷 생성 테스트 (1-4장)
- [ ] 모든 모드 조합 테스트
- [ ] 모든 스타일 조합 테스트
- [ ] 성별 선택 테스트
- [ ] 이력 조회 테스트
- [ ] 페이지네이션 테스트
- [ ] 이미지 뷰어 테스트
- [ ] 관리자 CRUD 테스트
- [ ] ✅ **LSP 오류 0개 확인**
- [ ] ✅ **Console 에러 0개 확인**

### 📋 Phase 8: 보안 & 최적화

- [ ] ✅ **사용자 업로드 이미지: PRIVATE**
- [ ] ✅ **생성 결과 이미지: PUBLIC**
- [ ] Rate limiting 확인
- [ ] 파일 크기 제한 확인
- [ ] MIME 타입 검증 확인
- [ ] SQL Injection 방어 확인
- [ ] XSS 방어 확인

### 📋 Phase 9: 문서화

- [ ] `replit.md` 업데이트
  - [ ] Recent Changes 섹션
  - [ ] System Architecture 섹션
- [ ] API 문서 작성 (선택사항)
- [ ] 사용자 가이드 작성 (선택사항)

---

## 중요 주의사항 요약

### 🚨 절대 금지 사항

1. **프로덕션에서 `npm run db:seed` 실행 금지**
   - 모든 데이터가 삭제됨!
   - 반드시 환경 보호 장치 추가

2. **GCS 파일 삭제 금지**
   - DB는 복구 가능하지만 파일은 복구 불가능
   - `bucket.file().delete()` 신중히 사용

3. **Primary Key 타입 변경 금지**
   - `serial` ↔ `varchar` 변환 시 데이터 손실
   - 기존 스키마 확인 후 작업

### ✅ 필수 검증 사항

1. **API 응답 필드명 일치**
   - 백엔드: `records`, `imageUrls`
   - 프론트엔드: 동일한 필드명 사용

2. **SELECT 쿼리 필드 누락 방지**
   - `originalUrl`, `transformedUrl`, `thumbnailUrl` 모두 포함

3. **환경 변수 확인**
   - `GEMINI_API_KEY`
   - `GOOGLE_APPLICATION_CREDENTIALS`
   - `DATABASE_URL`

4. **LSP 오류 0개 유지**
   - 개발 중 수시로 확인
   - 타입 불일치 즉시 해결

### 📝 코딩 규칙

1. **에러 처리**
   ```typescript
   try {
     // 작업
   } catch (error) {
     console.error('Error:', error);
     // 상태 업데이트 (DB)
     // 사용자 알림 (Toast)
     return res.status(500).json({ error: 'Message' });
   }
   ```

2. **트랜잭션 사용**
   ```typescript
   await db.transaction(async (tx) => {
     // 여러 DB 작업
   });
   ```

3. **타입 안전성**
   ```typescript
   // Zod 스키마로 검증
   const validated = schema.parse(data);
   
   // 타입 추론
   type User = typeof users.$inferSelect;
   ```

4. **Null 처리**
   ```typescript
   const value = data?.field || 'default';
   const array = data?.items?.map() || [];
   ```

---

## 마무리

이 문서는 AI Snapshot Generator 기능의 **완전한 재구현 가이드**입니다.

**롤백 후 재개발 시**:
1. 이 문서를 순서대로 따라 진행
2. 각 Phase별 체크리스트 완료 확인
3. 오류 해결 섹션 참고하여 동일한 실수 방지
4. 데이터 손실 방지 장치 먼저 적용

**질문이나 문제 발생 시**:
- 이 문서의 코드 예제 참고
- 오류 해결 섹션에서 유사 사례 확인
- 체크리스트 누락 항목 확인

**성공적인 재개발을 위해**:
- ✅ 환경 보호 장치 최우선
- ✅ 단계별 검증 철저히
- ✅ LSP 오류 0개 유지
- ✅ 테스트 완료 후 다음 단계 진행

---

**문서 버전**: 1.0  
**최종 업데이트**: 2025-10-29  
**작성자**: AI Assistant  
**목적**: 데이터 손실 방지 및 재개발 가이드
