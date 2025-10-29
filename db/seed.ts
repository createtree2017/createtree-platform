import { db } from "./index";
import * as schema from "@shared/schema";
import { format } from "date-fns";

async function seed() {
  // ========================================
  // 🚨 PRODUCTION SAFETY GUARDS
  // ========================================
  
  const nodeEnv = process.env.NODE_ENV || 'development';
  const replSlug = process.env.REPL_SLUG || '';
  const databaseUrl = process.env.DATABASE_URL || '';
  
  // Guard 1: NODE_ENV check
  if (nodeEnv === 'production') {
    console.error('');
    console.error('╔════════════════════════════════════════════════════════════╗');
    console.error('║  🚨 CRITICAL ERROR: SEEDING BLOCKED IN PRODUCTION          ║');
    console.error('╚════════════════════════════════════════════════════════════╝');
    console.error('');
    console.error('❌ This script DELETES ALL DATA from images and music tables!');
    console.error('❌ Running this in production will cause PERMANENT DATA LOSS!');
    console.error('');
    console.error('✅ To seed data safely:');
    console.error('   1. Use development environment');
    console.error('   2. Or use staging environment');
    console.error('   3. Or manually insert data via admin UI');
    console.error('');
    console.error(`Current environment: ${nodeEnv}`);
    console.error('');
    process.exit(1);
  }
  
  // Guard 2: Replit production domain check
  if (replSlug.toLowerCase().includes('prod') || 
      replSlug.toLowerCase().includes('main') ||
      databaseUrl.includes('prod')) {
    console.error('');
    console.error('╔════════════════════════════════════════════════════════════╗');
    console.error('║  🚨 CRITICAL ERROR: PRODUCTION ENVIRONMENT DETECTED        ║');
    console.error('╚════════════════════════════════════════════════════════════╝');
    console.error('');
    console.error('❌ Detected production indicators:');
    if (replSlug) console.error(`   REPL_SLUG: ${replSlug}`);
    if (databaseUrl.includes('prod')) console.error('   DATABASE_URL contains "prod"');
    console.error('');
    console.error('❌ Seeding is NOT ALLOWED in production environment!');
    console.error('');
    process.exit(1);
  }
  
  // Guard 3: Interactive confirmation
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  ⚠️  WARNING: DESTRUCTIVE OPERATION                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('This script will DELETE the following data:');
  console.log('  • ALL images (images table)');
  console.log('  • ALL music (music table)');
  console.log('  • ALL snapshot generation records');
  console.log('');
  console.log(`Current environment: ${nodeEnv}`);
  console.log(`Database: ${databaseUrl.substring(0, 30)}...`);
  console.log('');
  console.log('⚠️  This action CANNOT be undone without a backup!');
  console.log('');
  
  // For automated environments, check for FORCE flag
  if (process.env.FORCE_SEED !== 'true') {
    console.error('❌ BLOCKED: Set FORCE_SEED=true environment variable to proceed');
    console.error('   Example: FORCE_SEED=true npm run db:seed');
    console.error('');
    process.exit(1);
  }
  
  console.log('✅ FORCE_SEED=true detected, proceeding with seeding...');
  console.log('');
  
  try {
    // Clear previous data for fresh seed
    console.log("⚠️  Step 1/3: Clearing previous data...");
    console.log("   Deleting images...");
    await db.delete(schema.images);
    console.log("   ✓ Images deleted");
    
    console.log("   Deleting music...");
    await db.delete(schema.music);
    console.log("   ✓ Music deleted");
    
    console.log("✓ Previous data cleared");
    console.log("");
    
    // We don't delete personas and categories since we want to preserve user data

    // Seed persona categories
    console.log("Seeding persona categories...");
    const defaultCategories = [
      {
        categoryId: "all",
        name: "All Characters",
        description: "Browse all available companion characters",
        emoji: "✨",
        order: 0,
        isActive: true
      },
      {
        categoryId: "popular",
        name: "Popular",
        description: "Most-loved companion characters",
        emoji: "🌟",
        order: 1,
        isActive: true
      },
      {
        categoryId: "pregnancy",
        name: "Pregnancy",
        description: "Companions focused on prenatal support",
        emoji: "🤰",
        order: 2,
        isActive: true
      },
      {
        categoryId: "postpartum",
        name: "Postpartum",
        description: "Support for the fourth trimester",
        emoji: "👶",
        order: 3,
        isActive: true
      },
      {
        categoryId: "cultural",
        name: "Cultural",
        description: "Characters with cultural perspectives",
        emoji: "🌏",
        order: 4,
        isActive: true
      },
      {
        categoryId: "seasonal",
        name: "Seasonal",
        description: "Special themed characters",
        emoji: "🍁",
        order: 5,
        isActive: true
      }
    ];
    
    for (const category of defaultCategories) {
      // Check if category already exists
      const existingCategory = await db.query.personaCategories.findFirst({
        where: schema.eq(schema.personaCategories.categoryId, category.categoryId)
      });
      
      if (!existingCategory) {
        // Create new category
        await db.insert(schema.personaCategories).values({
          categoryId: category.categoryId,
          name: category.name,
          description: category.description,
          emoji: category.emoji,
          order: category.order,
          isActive: category.isActive,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`Created category: ${category.name}`);
      } else {
        console.log(`Category already exists: ${category.name}`);
      }
    }
    
    // Seed default personas
    console.log("Seeding default personas...");
    const defaultPersonas = [
      {
        personaId: "maternal-guide",
        name: "Maternal Guide",
        avatarEmoji: "👩‍⚕️",
        description: "A caring and knowledgeable maternal health specialist who provides evidence-based advice.",
        welcomeMessage: "안녕하세요! I'm your maternal companion. Share your feelings, ask questions, or simply chat. I'm here to provide emotional support during your motherhood journey. Your conversation is private and won't be permanently saved.",
        systemPrompt: "You are MomMelody's Maternal Guide, a supportive AI companion for pregnant women and young mothers. Your role is to provide empathetic, informative, and encouraging responses to help mothers through their journey. Always be warm, patient, and positive in your tone. Provide practical advice when asked, but remember you're not a replacement for medical professionals. Keep responses concise (under 150 words) and appropriate for a mobile interface.",
        primaryColor: "#7c3aed",
        secondaryColor: "#ddd6fe",
        personality: "Warm, caring, balanced",
        tone: "Supportive and informative",
        usageContext: "For mothers needing general guidance",
        emotionalKeywords: ["uncertain", "curious", "confused"],
        timeOfDay: "all",
        isActive: true,
        isFeatured: true,
        order: 0,
        categories: ["popular", "pregnancy", "postpartum"]
      },
      {
        personaId: "postpartum-angel",
        name: "Postpartum Angel",
        avatarEmoji: "👼",
        description: "A soft and nurturing persona for emotional recovery after birth",
        welcomeMessage: "Hello beautiful mama. I'm here to hold space for you during this tender time of healing. There's no right way to feel right now - I'm here to support you exactly as you are.",
        systemPrompt: "You are a gentle, nurturing support companion for mothers in the postpartum period. Your primary focus is emotional wellbeing and reassurance. You validate feelings, normalize postpartum challenges, and offer gentle encouragement. You are especially attuned to signs of postpartum depression and anxiety, and you encourage self-compassion and reaching out for help. You speak in a soft, warm voice with short, simple sentences - never overwhelming. You recognize the mother's strength while acknowledging that rest and healing are equally important forms of strength. You never give medical advice but do encourage speaking with healthcare providers about concerns.",
        primaryColor: "#f9a8d4",
        secondaryColor: "#fdf2f8",
        personality: "Warm, empathetic, gentle",
        tone: "Reassuring and calm",
        usageContext: "For moms struggling emotionally after birth",
        emotionalKeywords: ["anxious", "overwhelmed", "tired"],
        timeOfDay: "night",
        isActive: true,
        isFeatured: true,
        order: 1,
        categories: ["popular", "postpartum"]
      },
      {
        personaId: "taemyeong-companion",
        name: "태명 Companion",
        avatarEmoji: "🌱",
        description: "A Korean-focused companion who discusses taemyeong and cultural traditions for expecting mothers.",
        welcomeMessage: "안녕하세요! I'm your 태명 (Taemyeong) Companion. I can help you choose a beautiful prenatal nickname for your baby and discuss Korean pregnancy traditions. How can I assist you today?",
        systemPrompt: "You are MomMelody's 태명 (Taemyeong) Companion, an AI specializing in Korean pregnancy traditions, especially taemyeong (prenatal nicknames). You're knowledgeable about Korean culture, traditional pregnancy practices, and naming customs. You help mothers choose meaningful taemyeong based on their hopes, dreams, or baby's characteristics. You incorporate Korean words naturally and explain traditions like 태교 (prenatal education). Your tone is culturally respectful and warm. Include both Korean characters and romanization when using Korean terms. Keep responses concise (under 150 words) while being informative about Korean maternal traditions.",
        primaryColor: "#10b981",
        secondaryColor: "#d1fae5",
        personality: "Culturally informed, thoughtful",
        tone: "Respectful and warm",
        usageContext: "For mothers interested in Korean traditions",
        emotionalKeywords: ["curious", "multicultural", "tradition"],
        timeOfDay: "all",
        isActive: true,
        isFeatured: false,
        order: 2,
        categories: ["cultural", "pregnancy"]
      }
    ];
    
    for (const persona of defaultPersonas) {
      // Check if persona already exists
      const existingPersona = await db.query.personas.findFirst({
        where: schema.eq(schema.personas.personaId, persona.personaId)
      });
      
      if (!existingPersona) {
        // Create new persona
        await db.insert(schema.personas).values({
          personaId: persona.personaId,
          name: persona.name,
          avatarEmoji: persona.avatarEmoji,
          description: persona.description,
          welcomeMessage: persona.welcomeMessage,
          systemPrompt: persona.systemPrompt,
          primaryColor: persona.primaryColor,
          secondaryColor: persona.secondaryColor,
          personality: persona.personality,
          tone: persona.tone,
          usageContext: persona.usageContext,
          emotionalKeywords: persona.emotionalKeywords,
          timeOfDay: persona.timeOfDay,
          isActive: persona.isActive,
          isFeatured: persona.isFeatured,
          order: persona.order,
          useCount: 0,
          categories: persona.categories,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`Created persona: ${persona.name}`);
      } else {
        console.log(`Persona already exists: ${persona.name}`);
      }
    }

    // Note: Music data seeding removed - using real user-generated data only

    // Note: Image sample data removed - using real user-generated data only

    // Note: Chat messages and favorites mock data removed - using real user data only

    // Seed Service Categories
    console.log("Seeding service categories...");
    const defaultServiceCategories = [
      {
        categoryId: "image",
        title: "AI 이미지 만들기",
        icon: "image",
        isPublic: true,
        order: 0,
      },
      {
        categoryId: "music",
        title: "AI 노래 만들기",
        icon: "music",
        isPublic: false, // 기본적으로 비공개 상태
        order: 1,
      },
      {
        categoryId: "chat",
        title: "AI 친구 만들기",
        icon: "message-circle",
        isPublic: false, // 기본적으로 비공개 상태
        order: 2,
      }
    ];
    
    for (const category of defaultServiceCategories) {
      // 카테고리가 이미 존재하는지 확인
      const existingCategory = await db.query.serviceCategories.findFirst({
        where: schema.eq(schema.serviceCategories.categoryId, category.categoryId)
      });
      
      if (!existingCategory) {
        // 새 카테고리 생성
        await db.insert(schema.serviceCategories).values({
          categoryId: category.categoryId,
          title: category.title,
          icon: category.icon,
          isPublic: category.isPublic,
          order: category.order,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`Created service category: ${category.title}`);
      } else {
        console.log(`Service category already exists: ${category.title}`);
      }
    }

    // Seed Pregnancy Milestones
    console.log("Seeding pregnancy milestones...");
    
    // Check if milestones already exist
    const existingMilestones = await db.query.milestones.findMany();
    
    // Only insert if no milestones exist
    if (existingMilestones.length === 0) {
      const milestonesList = [
        {
          milestoneId: "first-trimester-complete",
          title: "First Trimester Complete",
          description: "Congratulations! You've completed the first trimester of your pregnancy. Your baby's essential structures are formed, and the risk of miscarriage decreases significantly.",
          weekStart: 13,
          weekEnd: 14,
          badgeEmoji: "🌱",
          badgeImageUrl: "https://placehold.co/200x200/9DC8B7/fff?text=%F0%9F%8C%B1",
          encouragementMessage: "You've made it through the often challenging first trimester! Your baby is now the size of a peach and developing rapidly. The foundation for all your baby's systems is in place.",
          categoryId: "baby_development",
          order: 1,
          isActive: true,
        },
        {
          milestoneId: "hear-babys-heartbeat",
          title: "Hear Baby's Heartbeat",
          description: "One of the most magical moments of pregnancy is hearing your baby's heartbeat for the first time during an ultrasound appointment.",
          weekStart: 10,
          weekEnd: 12,
          badgeEmoji: "💓",
          badgeImageUrl: "https://placehold.co/200x200/E8B7D5/fff?text=%F0%9F%92%93",
          encouragementMessage: "There's nothing quite like hearing that beautiful sound for the first time! Your baby's heart is now beating around 120-160 beats per minute.",
          categoryId: "baby_development",
          order: 0,
          isActive: true,
        },
        {
          milestoneId: "feel-baby-movement",
          title: "Feel Baby's First Movements",
          description: "You'll start to feel your baby's subtle movements, often described as flutters, bubbles, or 'butterflies' in your stomach.",
          weekStart: 18,
          weekEnd: 22,
          badgeEmoji: "🦋",
          badgeImageUrl: "https://placehold.co/200x200/ADB5E1/fff?text=%F0%9F%A6%8B",
          encouragementMessage: "Those little flutters are your baby saying hello! These first movements, called 'quickening,' will gradually become stronger and more noticeable in the coming weeks.",
          categoryId: "baby_development",
          order: 2,
          isActive: true,
        },
        {
          milestoneId: "second-trimester-complete",
          title: "Second Trimester Complete",
          description: "You've completed the middle phase of your pregnancy, often considered the most comfortable trimester. Your baby is growing rapidly and developing features.",
          weekStart: 27,
          weekEnd: 28,
          badgeEmoji: "🌿",
          badgeImageUrl: "https://placehold.co/200x200/9DC8B7/fff?text=%F0%9F%8C%BF",
          encouragementMessage: "Well done! Your baby now weighs about 2 pounds and is developing rapidly. You're entering the final stretch of your pregnancy journey!",
          categoryId: "baby_development",
          order: 3,
          isActive: true,
        },
        {
          milestoneId: "nursery-ready",
          title: "Nursery Preparation Complete",
          description: "You've prepared the baby's room with all the essentials needed for their arrival.",
          weekStart: 30,
          weekEnd: 36,
          badgeEmoji: "🏠",
          badgeImageUrl: "https://placehold.co/200x200/FFD4A7/fff?text=%F0%9F%8F%A0",
          encouragementMessage: "Your baby's special space is ready! Having the nursery prepared ahead of time gives you peace of mind and helps you feel more prepared for your little one's arrival.",
          categoryId: "preparations",
          order: 4,
          isActive: true,
        },
        {
          milestoneId: "hospital-bag-packed",
          title: "Hospital Bag Packed",
          description: "You've prepared your hospital bag with all the essentials for labor, delivery, and the first days with your newborn.",
          weekStart: 35,
          weekEnd: 38,
          badgeEmoji: "🧳",
          badgeImageUrl: "https://placehold.co/200x200/95C5DA/fff?text=%F0%9F%A7%B3",
          encouragementMessage: "Being prepared with your hospital bag brings peace of mind as you approach delivery. You're ready for this exciting next step!",
          categoryId: "preparations",
          order: 5,
          isActive: true,
        },
        {
          milestoneId: "birth-plan-complete",
          title: "Birth Plan Created",
          description: "You've thought through your preferences for labor and delivery and created a flexible birth plan to share with your healthcare team.",
          weekStart: 30,
          weekEnd: 36,
          badgeEmoji: "📝",
          badgeImageUrl: "https://placehold.co/200x200/A7C1E2/fff?text=%F0%9F%93%9D",
          encouragementMessage: "Having a birth plan helps communicate your wishes to your healthcare team. Remember that flexibility is important, as birth can be unpredictable.",
          categoryId: "preparations",
          order: 6,
          isActive: true,
        },
        {
          milestoneId: "full-term-reached",
          title: "Full Term Reached",
          description: "Congratulations on reaching full term in your pregnancy! Your baby is considered fully developed and ready for birth.",
          weekStart: 37,
          weekEnd: 40,
          badgeEmoji: "🎉",
          badgeImageUrl: "https://placehold.co/200x200/E8B7D5/fff?text=%F0%9F%8E%89",
          encouragementMessage: "Amazing achievement! Your baby is now considered full term and would be ready to thrive outside the womb. Any day now, you'll meet your little one!",
          categoryId: "baby_development",
          order: 7,
          isActive: true,
        },
        {
          milestoneId: "self-care-routine",
          title: "Self-Care Routine Established",
          description: "You've created and maintained a regular self-care routine during your pregnancy journey.",
          weekStart: 15,
          weekEnd: 30,
          badgeEmoji: "❤️",
          badgeImageUrl: "https://placehold.co/200x200/ADB5E1/fff?text=%E2%9D%A4%EF%B8%8F",
          encouragementMessage: "Taking care of yourself is one of the best things you can do for your baby too! Your commitment to self-care supports your physical and emotional wellbeing.",
          categoryId: "maternal_health",
          order: 8,
          isActive: true,
        },
        {
          milestoneId: "healthy-eating-habits",
          title: "Healthy Nutrition Champion",
          description: "You've consistently maintained healthy eating habits and proper nutrition during your pregnancy.",
          weekStart: 10,
          weekEnd: 40,
          badgeEmoji: "🥗",
          badgeImageUrl: "https://placehold.co/200x200/9DC8B7/fff?text=%F0%9F%A5%97",
          encouragementMessage: "Your dedication to nutrition is nurturing your baby's development. The healthy choices you make provide essential nutrients for your growing little one!",
          categoryId: "maternal_health",
          order: 9,
          isActive: true,
        },
      ];

      // Validate and insert milestones
      for (const milestone of milestonesList) {
        await db.insert(schema.milestones).values([milestone]);
      }
      
      console.log(`Inserted ${milestonesList.length} pregnancy milestones.`);
    } else {
      console.log(`Found ${existingMilestones.length} existing pregnancy milestones. Skipping seeding.`);
    }

    // ========================================
    // 스냅사진 프롬프트 시드 데이터 (Snapshot Prompts)
    // ========================================
    console.log("Seeding snapshot prompts...");
    
    // 기존 스냅사진 프롬프트 확인
    const existingSnapshotPrompts = await db.query.snapshotPrompts.findMany();
    
    if (existingSnapshotPrompts.length === 0) {
      const snapshotPromptsList = [
        // Daily Family Prompts (35개)
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "A warm family portrait in a sunlit kitchen, parents and children laughing together while making pizza. Flour dust floats in the air, caught by golden hour light streaming through the window. Shot on Kodak Portra 400 for natural skin tones with noticeable fine grain and warm, inviting colors.",
          tags: ["indoor", "cooking", "bonding"],
          region: null,
          season: null,
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 0,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "A candid shot of a family playing board games on a rainy afternoon. Soft window light illuminates their concentrated expressions and joyful smiles. The cozy living room background is softly blurred. Shot with vintage film aesthetic, featuring warm tones and visible grain.",
          tags: ["indoor", "games", "bonding"],
          region: null,
          season: null,
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 1,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "A joyful family moment in a park, children on swings with parents pushing them. The setting sun creates beautiful backlighting and lens flare. Background trees are softly out of focus. Shot on Fuji Pro 400H with dreamy, pastel tones and characteristic grain.",
          tags: ["outdoor", "park", "play"],
          region: null,
          season: "summer",
          timeOfDay: "evening",
          isActive: true,
          usageCount: 0,
          order: 2,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "A family gathered around a birthday cake, candles glowing in a dimly lit room. Their faces are illuminated by warm candlelight, eyes sparkling with anticipation. The scene has nostalgic, warm tones with visible film grain reminiscent of family photo albums.",
          tags: ["indoor", "celebration", "birthday"],
          region: null,
          season: null,
          timeOfDay: "evening",
          isActive: true,
          usageCount: 0,
          order: 3,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Parents and children building a snowman together in their front yard. Fresh snow blankets the ground, creating a bright, overexposed winter wonderland. Shot with soft, diffused light and muted colors characteristic of Fuji Pro 400H film.",
          tags: ["outdoor", "winter", "snow"],
          region: null,
          season: "winter",
          timeOfDay: "morning",
          isActive: true,
          usageCount: 0,
          order: 4,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "A family movie night scene with everyone cuddled on the sofa under blankets. The TV's glow softly illuminates their relaxed faces. Popcorn bowl in foreground is slightly blurred. Shot with warm, intimate lighting and heavy grain for a cozy, nostalgic feel.",
          tags: ["indoor", "relaxation", "bonding"],
          region: null,
          season: null,
          timeOfDay: "night",
          isActive: true,
          usageCount: 0,
          order: 5,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Parents teaching their child to ride a bicycle in a quiet neighborhood street. Soft evening light creates long shadows. The background of suburban houses is beautifully blurred. Shot on Kodak Portra 400 with warm, natural tones and fine grain.",
          tags: ["outdoor", "teaching", "milestone"],
          region: null,
          season: "spring",
          timeOfDay: "evening",
          isActive: true,
          usageCount: 0,
          order: 6,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "A family breakfast scene at a sunny kitchen table. Morning light streams through lace curtains, creating a soft, hazy glow. Everyone's reaching for pancakes and laughing. Shot with overexposed, dreamy quality and visible grain.",
          tags: ["indoor", "meal", "morning"],
          region: null,
          season: null,
          timeOfDay: "morning",
          isActive: true,
          usageCount: 0,
          order: 7,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Family members picking apples together in an orchard. Golden autumn light filters through branches. Children reaching up with baskets while parents help. Background foliage is softly blurred. Shot on Kodak Ektar 100 for vibrant, saturated colors with fine grain.",
          tags: ["outdoor", "harvest", "autumn"],
          region: null,
          season: "fall",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 8,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "A tender moment of parents reading bedtime stories to children. Soft nightlight creates warm, intimate lighting. The cozy bedroom background fades into soft focus. Shot with gentle, grainy film aesthetic and muted, peaceful tones.",
          tags: ["indoor", "bedtime", "bonding"],
          region: null,
          season: null,
          timeOfDay: "night",
          isActive: true,
          usageCount: 0,
          order: 9,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Family washing the car together on a sunny summer day. Water spray creates rainbow effects in the bright sunlight. Everyone's laughing and getting splashed. Shot on Kodak Gold 200 with vibrant, warm colors and distinct grain.",
          tags: ["outdoor", "activity", "summer"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 10,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Parents and kids gardening together in the backyard. Hands dirty with soil, planting flowers. Soft spring light creates a fresh, green atmosphere. Background garden is beautifully blurred. Shot on Fuji Pro 400H with gentle, pastel tones.",
          tags: ["outdoor", "gardening", "spring"],
          region: null,
          season: "spring",
          timeOfDay: "morning",
          isActive: true,
          usageCount: 0,
          order: 11,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Family playing with their dog in the living room. Joyful chaos with everyone rolling on the carpet. Afternoon light from windows creates warm, natural illumination. Shot with candid, spontaneous feel and visible grain.",
          tags: ["indoor", "pets", "play"],
          region: null,
          season: null,
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 12,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Parents and children baking cookies together, faces dusted with flour. Warm kitchen light creates a cozy, homey atmosphere. Focus on their happy expressions with background slightly blurred. Shot on Kodak Portra 400 with warm, nostalgic tones.",
          tags: ["indoor", "baking", "bonding"],
          region: null,
          season: null,
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 13,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "A family picnic scene in a meadow filled with wildflowers. Checkered blanket spread out, basket open. Everyone enjoying sandwiches and laughing. Shot with bright, slightly overexposed summer light and fine grain.",
          tags: ["outdoor", "picnic", "nature"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 14,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Family decorating a Christmas tree together. Twinkling lights create a magical, warm glow. Children hanging ornaments while parents adjust the star. Shot with soft, atmospheric lighting and heavy grain for nostalgic holiday feel.",
          tags: ["indoor", "holiday", "tradition"],
          region: null,
          season: "winter",
          timeOfDay: "evening",
          isActive: true,
          usageCount: 0,
          order: 15,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Parents pushing children on a merry-go-round at a playground. Motion blur on the spinning equipment, faces frozen in laughter. Golden hour light creates warm backlighting. Shot on Fuji Pro 400H with dreamy, soft tones.",
          tags: ["outdoor", "playground", "play"],
          region: null,
          season: null,
          timeOfDay: "evening",
          isActive: true,
          usageCount: 0,
          order: 16,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Family dancing together in the living room to music. Spontaneous joy and movement captured mid-dance. Warm lamp light creates intimate atmosphere. Shot with slight motion blur and grainy texture for authentic moment feel.",
          tags: ["indoor", "dancing", "joy"],
          region: null,
          season: null,
          timeOfDay: "evening",
          isActive: true,
          usageCount: 0,
          order: 17,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Children helping parents prepare dinner, standing on stools to reach the counter. Busy kitchen scene full of vegetables and cooking utensils. Warm overhead light creates cozy atmosphere. Shot on Kodak Portra 400 with natural, warm tones.",
          tags: ["indoor", "cooking", "helping"],
          region: null,
          season: null,
          timeOfDay: "evening",
          isActive: true,
          usageCount: 0,
          order: 18,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Family lying on grass looking up at clouds together. Their faces in profile against the bright sky. Peaceful, contemplative moment. Shot with soft, bright daylight and gentle grain for serene atmosphere.",
          tags: ["outdoor", "relaxation", "nature"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 19,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Parents and kids making sand castles at the beach. Focused on their hands shaping towers and moats. Late afternoon sun creates long shadows. Background ocean is beautifully blurred. Shot with warm, golden tones and fine grain.",
          tags: ["outdoor", "beach", "creativity"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 20,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Family having a water balloon fight in the backyard. Mid-action shots of balloons bursting, everyone laughing and dodging. Bright summer sunlight creates high-contrast, vibrant scene. Shot on Kodak Gold 200 with saturated colors and grain.",
          tags: ["outdoor", "summer", "play"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 21,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Parents teaching children to fly kites in an open field. Kites soaring against a bright blue sky. Wind in everyone's hair, expressions of joy and concentration. Shot with slightly overexposed, dreamy quality and visible grain.",
          tags: ["outdoor", "activity", "teaching"],
          region: null,
          season: "spring",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 22,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Family gathered around a campfire roasting marshmallows. Warm firelight illuminates their faces against the darkening evening. Trees in background fade into soft darkness. Shot with atmospheric lighting and heavy grain.",
          tags: ["outdoor", "camping", "evening"],
          region: null,
          season: "summer",
          timeOfDay: "night",
          isActive: true,
          usageCount: 0,
          order: 23,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Parents and children playing hide and seek in a sunny park. Children peeking from behind trees, parents pretending not to see. Dappled sunlight through leaves creates beautiful light patterns. Shot on Fuji Pro 400H with soft, gentle tones.",
          tags: ["outdoor", "park", "play"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 24,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Family doing yoga together in the living room. Morning sunlight streaming through windows. Everyone in various poses, some more successful than others, all smiling. Shot with bright, clean light and subtle grain.",
          tags: ["indoor", "exercise", "wellness"],
          region: null,
          season: null,
          timeOfDay: "morning",
          isActive: true,
          usageCount: 0,
          order: 25,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Parents and kids jumping in puddles after rain. Splashes frozen mid-air, rainbow boots, pure joy. Overcast sky creates even, soft lighting. Shot with vibrant colors and fine grain for playful, carefree feel.",
          tags: ["outdoor", "rain", "play"],
          region: null,
          season: "spring",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 26,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Family painting or drawing together at a table. Concentrated expressions, hands covered in paint. Natural window light illuminates the creative chaos. Shot on Kodak Portra 400 with warm, natural tones and noticeable grain.",
          tags: ["indoor", "art", "creativity"],
          region: null,
          season: null,
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 27,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Parents and children feeding ducks at a pond. Bread in hand, ducks gathering, gentle ripples on water. Soft, peaceful morning light. Background trees and water beautifully blurred. Shot with serene, muted tones and fine grain.",
          tags: ["outdoor", "nature", "animals"],
          region: null,
          season: "spring",
          timeOfDay: "morning",
          isActive: true,
          usageCount: 0,
          order: 28,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Family creating a puzzle together on the floor. Overhead shot showing everyone's hands piecing it together. Warm lamp light creates cozy evening atmosphere. Shot with intimate, grainy aesthetic.",
          tags: ["indoor", "games", "bonding"],
          region: null,
          season: null,
          timeOfDay: "evening",
          isActive: true,
          usageCount: 0,
          order: 29,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Parents and kids making Halloween jack-o'-lanterns. Carving pumpkins, scooping seeds, laughing at the mess. Warm kitchen light creates festive atmosphere. Shot on Kodak Gold 200 with warm, autumnal tones and visible grain.",
          tags: ["indoor", "holiday", "creativity"],
          region: null,
          season: "fall",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 30,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Family blowing bubbles in the backyard. Iridescent bubbles floating everywhere, catching sunlight. Children and parents both reaching to pop them. Shot with bright, slightly overexposed summer light and dreamy quality.",
          tags: ["outdoor", "play", "summer"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 31,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Parents helping children build a blanket fort in the living room. Flashlights glowing from inside, excited faces peeking out. Cozy, intimate lighting. Shot with warm tones and heavy grain for nostalgic childhood feel.",
          tags: ["indoor", "play", "creativity"],
          region: null,
          season: null,
          timeOfDay: "evening",
          isActive: true,
          usageCount: 0,
          order: 32,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Family raking autumn leaves together, then jumping into the pile. Leaves flying through the air, everyone laughing. Golden afternoon light filters through trees. Shot on Fuji Pro 400H with warm, soft autumn tones.",
          tags: ["outdoor", "autumn", "play"],
          region: null,
          season: "fall",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 33,
        },
        {
          category: "daily",
          type: "family",
          gender: "unisex",
          text: "Parents and children making homemade ice cream together. Everyone taking turns cranking the old-fashioned ice cream maker. Summer backyard setting with bright, cheerful light. Shot with vibrant, nostalgic tones and grain.",
          tags: ["outdoor", "cooking", "summer"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 34,
        },

        // Travel Family Prompts (30개)
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family standing at a scenic mountain overlook, arms around each other. Vast mountain ranges stretch into the distance under a bright sky. Shot on Kodak Ektar 100 for saturated, vibrant landscape colors with fine grain.",
          tags: ["outdoor", "mountains", "scenic"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 35,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family exploring cobblestone streets in a charming European village. Children running ahead while parents follow, old stone buildings in soft focus background. Shot on Fuji Pro 400H with soft, romantic tones and gentle grain.",
          tags: ["urban", "exploration", "europe"],
          region: "europe",
          season: "spring",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 36,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family at the beach building sandcastles together. Ocean waves in the background are beautifully blurred. Golden hour sun creates warm backlighting. Shot on Kodak Portra 400 with warm, summery tones and noticeable grain.",
          tags: ["beach", "ocean", "play"],
          region: null,
          season: "summer",
          timeOfDay: "evening",
          isActive: true,
          usageCount: 0,
          order: 37,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family hiking through a lush green forest trail. Dappled sunlight filtering through the canopy illuminates their path. Children pointing at interesting plants. Shot with natural, fresh green tones and fine grain.",
          tags: ["forest", "hiking", "nature"],
          region: null,
          season: "summer",
          timeOfDay: "morning",
          isActive: true,
          usageCount: 0,
          order: 38,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family posing in front of a famous landmark, everyone making silly faces and laughing. Tourists and architecture blurred in the background. Bright midday sun creates vibrant, energetic atmosphere. Shot with candid, spontaneous feel.",
          tags: ["landmark", "city", "fun"],
          region: null,
          season: null,
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 39,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family riding bicycles along a scenic coastal path. Wind in their hair, ocean sparkling in the background. Shot with motion and energy, bright sunny day. Shot on Kodak Gold 200 with saturated, cheerful colors and grain.",
          tags: ["cycling", "coast", "activity"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 40,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family at a traditional temple in Japan, trying to ring the large bell together. Serene atmosphere with cherry blossoms in soft focus. Shot on Fuji Pro 400H with gentle, peaceful tones and atmospheric grain.",
          tags: ["temple", "culture", "tradition"],
          region: "japan",
          season: "spring",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 41,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family on a gondola ride in Venice, everyone waving at the camera. Historic buildings and canals in soft focus background. Warm Italian sunlight creates romantic, dreamy atmosphere. Shot with vintage film aesthetic and warm tones.",
          tags: ["boat", "city", "water"],
          region: "europe",
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 42,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family watching sunset from a cliff edge. Silhouettes against vibrant orange and pink sky. Peaceful, contemplative moment captured. Shot with dramatic backlighting and grainy texture for emotional impact.",
          tags: ["sunset", "cliff", "scenic"],
          region: null,
          season: "summer",
          timeOfDay: "evening",
          isActive: true,
          usageCount: 0,
          order: 43,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family skiing together on a snowy mountain slope. Bright white snow, blue sky, everyone in colorful ski gear. Shot with high contrast, crisp winter light. Shot on Kodak Ektar 100 for vibrant, saturated colors.",
          tags: ["snow", "skiing", "mountains"],
          region: null,
          season: "winter",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 44,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family exploring a bustling Asian night market. Colorful lanterns and food stalls create vibrant background blur. Everyone trying street food with curious expressions. Shot on CineStill 800T with characteristic green-tinted neon glow and grain.",
          tags: ["market", "night", "food"],
          region: "asia",
          season: null,
          timeOfDay: "night",
          isActive: true,
          usageCount: 0,
          order: 45,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family canoeing on a calm lake. Reflections of trees and mountains in the still water. Peaceful morning mist creates ethereal atmosphere. Shot with soft, muted tones and fine grain for tranquil feel.",
          tags: ["lake", "boating", "nature"],
          region: null,
          season: "summer",
          timeOfDay: "morning",
          isActive: true,
          usageCount: 0,
          order: 46,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family at a safari viewing animals from their vehicle. Excited children pointing, parents with cameras. African savanna in soft focus background. Shot on Kodak Portra 400 with warm, natural tones and documentary feel.",
          tags: ["safari", "animals", "adventure"],
          region: null,
          season: null,
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 47,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family running through a field of lavender in Provence. Purple flowers stretching to the horizon. Golden hour light creates dreamy, romantic atmosphere. Shot on Fuji Pro 400H with soft, pastel tones and delicate grain.",
          tags: ["flowers", "field", "running"],
          region: "europe",
          season: "summer",
          timeOfDay: "evening",
          isActive: true,
          usageCount: 0,
          order: 48,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family camping in the mountains, gathered around a tent at dawn. First light illuminating the peaks. Everyone emerging with messy hair and sleepy smiles. Shot with soft morning light and gentle, atmospheric grain.",
          tags: ["camping", "mountains", "adventure"],
          region: null,
          season: "summer",
          timeOfDay: "morning",
          isActive: true,
          usageCount: 0,
          order: 49,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family at a traditional Korean hanok village, trying on hanbok traditional dress. Colorful costumes against historic architecture. Shot with vibrant colors and cultural richness, Kodak Ektar 100 for saturated tones.",
          tags: ["culture", "tradition", "costume"],
          region: "korea",
          season: "spring",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 50,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family snorkeling in crystal clear tropical water. Underwater shot showing their faces through masks, coral in background. Bright sunlight filtering through water creates magical light rays. Shot with vibrant blues and greens.",
          tags: ["underwater", "tropical", "adventure"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 51,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family at a theme park on a roller coaster, hands up in the air, faces showing pure exhilaration. Motion blur adds to the excitement. Shot with high energy and bright, vibrant colors.",
          tags: ["themepark", "rides", "excitement"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 52,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family picking oranges in a sunny grove. Children reaching for fruit, parents helping with baskets. Warm Mediterranean light filters through orange trees. Shot on Kodak Portra 400 with warm, golden tones and natural feel.",
          tags: ["orchard", "harvest", "outdoor"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 53,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family exploring ancient ruins, children pretending to be archaeologists. Stone structures in soft focus background. Warm afternoon sun creates adventurous, educational atmosphere. Shot with documentary feel and fine grain.",
          tags: ["ruins", "history", "exploration"],
          region: null,
          season: null,
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 54,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family on a hot air balloon ride at sunrise. Basket in foreground, patchwork of fields below in soft focus. Warm golden light illuminates their amazed expressions. Shot with dreamy, ethereal quality and grain.",
          tags: ["balloon", "aerial", "sunrise"],
          region: null,
          season: "summer",
          timeOfDay: "morning",
          isActive: true,
          usageCount: 0,
          order: 55,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family at a waterfall, feeling the mist on their faces. Powerful cascade in background creates dramatic scene. Everyone in rain ponchos with big smiles. Shot with dynamic energy and cool, fresh tones.",
          tags: ["waterfall", "nature", "adventure"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 56,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family dining at an outdoor café in Paris. Eiffel Tower softly blurred in background. Everyone enjoying croissants and hot chocolate. Warm afternoon light creates romantic, cultured atmosphere. Shot on Fuji Pro 400H with soft European tones.",
          tags: ["cafe", "city", "dining"],
          region: "europe",
          season: "spring",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 57,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family on a train journey, faces pressed against window watching countryside fly by. Reflections and outside scenery create layered composition. Shot with nostalgic, journey feel and visible grain.",
          tags: ["train", "journey", "window"],
          region: null,
          season: null,
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 58,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family at a lighthouse on a rocky coast. Wind blowing, ocean spray in the air. Dramatic seascape in background. Shot with stormy, adventurous atmosphere and heavy grain for emotional impact.",
          tags: ["lighthouse", "ocean", "coast"],
          region: null,
          season: null,
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 59,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family at Jeju Island walking through a tunnel of canola flowers. Bright yellow blooms surround them, blue ocean visible in distance. Shot on Fuji Pro 400H with vibrant spring colors and soft, dreamy quality.",
          tags: ["flowers", "island", "spring"],
          region: "korea",
          season: "spring",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 60,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family visiting a traditional fish market in Japan. Colorful fresh catch displayed, everyone sampling local delicacies. Bustling market atmosphere with vendors in soft focus. Shot with vibrant, authentic documentary feel.",
          tags: ["market", "food", "culture"],
          region: "japan",
          season: null,
          timeOfDay: "morning",
          isActive: true,
          usageCount: 0,
          order: 61,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family horseback riding through scenic countryside. Rolling green hills stretch into the distance. Everyone comfortable in saddles, enjoying the peaceful ride. Shot on Kodak Portra 400 with natural, warm landscape tones.",
          tags: ["horses", "countryside", "activity"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 62,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family at a desert oasis, touching cool water after a hot trek. Palm trees and sand dunes in background. Relief and joy on their faces. Shot with warm, golden desert light and fine grain.",
          tags: ["desert", "oasis", "adventure"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 63,
        },
        {
          category: "travel",
          type: "family",
          gender: "unisex",
          text: "Family on a vineyard tour, walking through rows of grapevines. Tuscan hills rolling in soft focus background. Late afternoon golden light creates warm, rustic atmosphere. Shot on Fuji Pro 400H with romantic European tones.",
          tags: ["vineyard", "countryside", "walking"],
          region: "europe",
          season: "fall",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 64,
        },

        // Film Family Prompts (35개)
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "A cinematic wide shot of a family walking down a tree-lined path in autumn. Leaves falling around them, sun rays breaking through branches. Shot on Kodak Portra 400 with warm, nostalgic tones, heavy grain, and dreamy haze.",
          tags: ["outdoor", "autumn", "walking"],
          region: null,
          season: "fall",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 65,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "A family silhouette at the beach during golden hour. Sun setting behind them creates dramatic backlighting and lens flare. Ocean waves gently blurred. Shot on Fuji Pro 400H with overexposed, dreamy pastel tones and visible grain.",
          tags: ["beach", "silhouette", "sunset"],
          region: null,
          season: "summer",
          timeOfDay: "evening",
          isActive: true,
          usageCount: 0,
          order: 66,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Parents and children running through a wheat field at sunset. Motion blur on the wheat, strong backlight creating halo effects. Shot on Kodak Portra 400 with warm, golden tones, heavy grain, and slightly overexposed quality.",
          tags: ["field", "running", "sunset"],
          region: null,
          season: "summer",
          timeOfDay: "evening",
          isActive: true,
          usageCount: 0,
          order: 67,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "A moody portrait of a family standing on a foggy morning pier. Mist surrounds them, creating atmospheric depth. Shot on CineStill 800T with cool, cinematic tones, heavy grain, and greenish cast typical of tungsten film.",
          tags: ["pier", "fog", "atmospheric"],
          region: null,
          season: null,
          timeOfDay: "morning",
          isActive: true,
          usageCount: 0,
          order: 68,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Family gathered around a vintage car in a field at dusk. Warm light from car headlights illuminates their faces. Soft purple and orange sky in background. Shot with nostalgic 1970s film aesthetic, heavy grain, and muted colors.",
          tags: ["car", "vintage", "dusk"],
          region: null,
          season: "summer",
          timeOfDay: "evening",
          isActive: true,
          usageCount: 0,
          order: 69,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "A family portrait through a rain-streaked window. Water droplets create dreamy distortion. Soft indoor light illuminates their faces. Shot on Fuji Pro 400H with soft, melancholic tones and delicate grain.",
          tags: ["window", "rain", "indoor"],
          region: null,
          season: null,
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 70,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Family walking through cherry blossom trees in full bloom. Petals falling like snow around them. Soft, diffused spring light creates ethereal atmosphere. Shot on Fuji Pro 400H with dreamy, pastel pink tones and heavy grain.",
          tags: ["cherry blossoms", "spring", "walking"],
          region: null,
          season: "spring",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 71,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "A candid family moment reflected in a puddle after rain. Upside-down reflection shows them jumping together. Shot with urban street feel, heavy grain, and slightly desaturated colors.",
          tags: ["reflection", "urban", "rain"],
          region: null,
          season: null,
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 72,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Family sitting on a blanket watching fireworks explode in night sky. Their faces illuminated by colorful bursts of light. Shot on CineStill 800T with vibrant, cinematic night colors and characteristic grain.",
          tags: ["fireworks", "night", "celebration"],
          region: null,
          season: "summer",
          timeOfDay: "night",
          isActive: true,
          usageCount: 0,
          order: 73,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Parents and children in a sunflower field, faces turned toward the sun. Bright yellow blooms create vibrant, joyful scene. Shot on Kodak Ektar 100 with saturated, punchy colors and fine grain.",
          tags: ["sunflowers", "field", "joy"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 74,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "A family portrait in front of an old barn at golden hour. Rustic wood texture, warm sunlight creating long shadows. Shot on Kodak Portra 400 with warm, nostalgic tones, visible grain, and slightly faded quality.",
          tags: ["barn", "rustic", "golden hour"],
          region: null,
          season: "summer",
          timeOfDay: "evening",
          isActive: true,
          usageCount: 0,
          order: 75,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Family on a wooden dock extending into a misty lake. Morning fog creates layers of depth. Calm water reflects soft colors. Shot on Fuji Pro 400H with muted, peaceful tones and atmospheric grain.",
          tags: ["dock", "lake", "fog"],
          region: null,
          season: null,
          timeOfDay: "morning",
          isActive: true,
          usageCount: 0,
          order: 76,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "A cinematic shot of family camping under starry night sky. Tent glowing from within, Milky Way visible above. Shot with long exposure feel, deep blues and warm tent light contrast, heavy grain.",
          tags: ["camping", "stars", "night"],
          region: null,
          season: "summer",
          timeOfDay: "night",
          isActive: true,
          usageCount: 0,
          order: 77,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Family dancing in their living room, captured with intentional motion blur. Warm lamp light creates intimate, joyful atmosphere. Shot with spontaneous, alive feel and grainy texture reminiscent of home movies.",
          tags: ["indoor", "dancing", "motion"],
          region: null,
          season: null,
          timeOfDay: "evening",
          isActive: true,
          usageCount: 0,
          order: 78,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Parents and children at a carnival at night. Colorful lights create bokeh in background. Faces illuminated by warm carnival glow. Shot on CineStill 800T with vibrant neon colors, halation, and characteristic green tint.",
          tags: ["carnival", "night", "lights"],
          region: null,
          season: "summer",
          timeOfDay: "night",
          isActive: true,
          usageCount: 0,
          order: 79,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Family lying in tall grass looking up at clouds. Shot from above showing their relaxed poses and peaceful expressions. Soft, bright daylight. Shot on Fuji Pro 400H with airy, dreamy quality and gentle grain.",
          tags: ["grass", "relaxation", "overhead"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 80,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "A vintage-style family portrait in black and white. Classic composition in a park setting. Timeless quality with soft focus and distinct grain characteristic of Ilford HP5 film.",
          tags: ["blackwhite", "vintage", "classic"],
          region: null,
          season: null,
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 81,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Family building a snowman in soft, falling snow. Overcast winter light creates even, gentle illumination. Shot on Kodak Portra 400 with cool, muted tones, slight overexposure, and visible grain.",
          tags: ["snow", "winter", "activity"],
          region: null,
          season: "winter",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 82,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Parents and children in a field of poppies. Vibrant red flowers contrast with blue sky. Strong summer sun creates high contrast scene. Shot on Kodak Ektar 100 with punchy, saturated colors and fine grain.",
          tags: ["poppies", "flowers", "field"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 83,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "A family huddled together on a cold winter evening, vapor from their breath visible. Street lights create warm glow in background. Shot with cinematic, atmospheric quality and heavy grain.",
          tags: ["winter", "cold", "evening"],
          region: null,
          season: "winter",
          timeOfDay: "evening",
          isActive: true,
          usageCount: 0,
          order: 84,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Family walking across a wooden bridge over a stream in autumn forest. Colorful leaves everywhere, soft afternoon light filtering through trees. Shot on Fuji Pro 400H with warm fall tones and dreamy quality.",
          tags: ["bridge", "forest", "autumn"],
          region: null,
          season: "fall",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 85,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "A family portrait taken with harsh flash in Y2K digital camera style. Slightly overexposed, deep shadows, authentic early 2000s party photo aesthetic. Spontaneous, energetic feel.",
          tags: ["flash", "y2k", "indoor"],
          region: null,
          season: null,
          timeOfDay: "night",
          isActive: true,
          usageCount: 0,
          order: 86,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Parents and children at a drive-in movie theater at dusk. Sitting on car hood, big screen glowing in background. Shot on CineStill 800T with nostalgic, cinematic atmosphere and characteristic halation.",
          tags: ["drivein", "vintage", "evening"],
          region: null,
          season: "summer",
          timeOfDay: "night",
          isActive: true,
          usageCount: 0,
          order: 87,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Family in a rowboat on a calm lake at sunrise. Mist rising from water, warm golden light. Peaceful, serene moment. Shot on Kodak Portra 400 with soft, warm tones and gentle grain.",
          tags: ["boat", "lake", "sunrise"],
          region: null,
          season: "summer",
          timeOfDay: "morning",
          isActive: true,
          usageCount: 0,
          order: 88,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "A double exposure effect showing family faces blended with nature scenes. Artistic, dreamy quality. Shot with experimental film aesthetic and ethereal, layered composition.",
          tags: ["artistic", "doubleexposure", "creative"],
          region: null,
          season: null,
          timeOfDay: null,
          isActive: true,
          usageCount: 0,
          order: 89,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Family jumping off a dock into a lake together. Mid-air shot capturing the joy and freedom. Bright summer sun creates vibrant, energetic scene. Shot with high shutter speed freeze and fine grain.",
          tags: ["lake", "jumping", "summer"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 90,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Parents and children in a cozy cabin, playing cards by candlelight. Warm, intimate glow from candles. Rustic wooden interior in soft focus. Shot with atmospheric, nostalgic quality and heavy grain.",
          tags: ["cabin", "indoor", "candlelight"],
          region: null,
          season: "winter",
          timeOfDay: "night",
          isActive: true,
          usageCount: 0,
          order: 91,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Family at an empty beach at dawn. Soft pastel sky, wet sand reflecting colors. Peaceful, contemplative moment. Shot on Fuji Pro 400H with soft, ethereal tones and delicate grain.",
          tags: ["beach", "dawn", "peaceful"],
          region: null,
          season: null,
          timeOfDay: "morning",
          isActive: true,
          usageCount: 0,
          order: 92,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "A family shadow portrait on a sunny wall. Creative composition using only shadows. Strong afternoon light creates dramatic silhouette. Shot with artistic, minimalist feel and fine grain.",
          tags: ["shadow", "creative", "minimalist"],
          region: null,
          season: null,
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 93,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Family walking through a tunnel of autumn trees. Canopy creates natural frame, golden leaves everywhere. Shot on Kodak Portra 400 with warm, rich autumn tones, slight overexposure, and nostalgic grain.",
          tags: ["autumn", "trees", "tunnel"],
          region: null,
          season: "fall",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 94,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Parents and children at a Japanese onsen, surrounded by steam and natural rock pools. Serene, misty atmosphere. Shot with soft, atmospheric quality and muted, peaceful tones.",
          tags: ["onsen", "steam", "culture"],
          region: "japan",
          season: "winter",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 95,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "A family portrait in a field of wildflowers at magic hour. Soft, glowing backlight creates halo effects. Colors are warm and slightly overexposed. Shot on Fuji Pro 400H with dreamy, romantic quality and visible grain.",
          tags: ["wildflowers", "magichour", "field"],
          region: null,
          season: "summer",
          timeOfDay: "evening",
          isActive: true,
          usageCount: 0,
          order: 96,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Family at a window on a rainy day, watching raindrops race down the glass. Cozy indoor scene with natural window light. Shot with intimate, quiet atmosphere and gentle grain.",
          tags: ["window", "rain", "indoor"],
          region: null,
          season: null,
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 97,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "A cinematic family portrait in an old library with rows of books. Warm lamp light creates dramatic chiaroscuro. Shot with moody, atmospheric quality and heavy grain reminiscent of classic film.",
          tags: ["library", "indoor", "dramatic"],
          region: null,
          season: null,
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 98,
        },
        {
          category: "film",
          type: "family",
          gender: "unisex",
          text: "Family running through sprinklers in backyard on a hot summer day. Water droplets frozen mid-air, sun creating rainbow effects. Shot on Kodak Gold 200 with bright, vibrant colors and nostalgic grain.",
          tags: ["sprinklers", "summer", "play"],
          region: null,
          season: "summer",
          timeOfDay: "afternoon",
          isActive: true,
          usageCount: 0,
          order: 99,
        },
      ];

      // Validate and insert snapshot prompts
      for (const prompt of snapshotPromptsList) {
        await db.insert(schema.snapshotPrompts).values(prompt);
      }
      
      console.log(`✅ Inserted ${snapshotPromptsList.length} snapshot prompts.`);
    } else {
      console.log(`📋 Found ${existingSnapshotPrompts.length} existing snapshot prompts. Skipping seeding.`);
    }

    // ========================================
    // 시스템 설정 시드 데이터 (NEW)
    // ========================================
    console.log("Seeding system settings...");
    
    // 시스템 설정 존재 여부 확인
    const existingSystemSettings = await db.query.systemSettings.findFirst();
    
    if (!existingSystemSettings) {
      // 기본 시스템 설정 생성 (Singleton ID=1)
      const defaultSystemSettings = {
        id: 1 as const,
        defaultAiModel: "openai" as const,
        supportedAiModels: ["openai", "gemini"] as ("openai" | "gemini")[],
        clientDefaultModel: "openai" as const,
      };
      
      console.log("Creating default system settings:", defaultSystemSettings);
      
      await db.insert(schema.systemSettings)
        .values([defaultSystemSettings])
        .onConflictDoUpdate({
          target: schema.systemSettings.id,
          set: {
            updatedAt: new Date()
          }
        });
      
      console.log("✅ System settings seeded successfully");
    } else {
      console.log("📋 System settings already exist:", {
        id: existingSystemSettings.id,
        defaultAiModel: existingSystemSettings.defaultAiModel,
        supportedAiModels: existingSystemSettings.supportedAiModels,
        clientDefaultModel: existingSystemSettings.clientDefaultModel
      });
    }

    console.log("Seed completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error; // Re-throw to ensure seed failures are visible
  }
}

seed();
