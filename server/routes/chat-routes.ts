import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { generateChatResponse } from "../services/openai";

const router = Router();

const chatMessageSchema = z.object({
  message: z.string().min(1, "Message is required"),
  personaSystemPrompt: z.string().optional(),
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

router.post("/message", async (req, res) => {
  try {
    const validatedData = chatMessageSchema.parse(req.body);

    const isEphemeral = req.query.ephemeral === 'true';

    let userMessage, assistantMessage;

    const aiResponse = await generateChatResponse(
      validatedData.message,
      validatedData.personaSystemPrompt
    );

    if (isEphemeral) {
      userMessage = {
        id: Date.now(),
        role: "user",
        content: validatedData.message,
        createdAt: new Date().toISOString(),
      };

      assistantMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: aiResponse,
        createdAt: new Date().toISOString(),
      };
    } else {
    }

    return res.json({
      userMessage,
      assistantMessage,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error("Error sending chat message:", error);
    return res.status(500).json({ error: "Failed to process chat message" });
  }
});

router.get("/history", async (req, res) => {
  try {
    const chatHistory = await storage.getChatHistory();
    return res.json(chatHistory);
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

router.post("/save", async (req, res) => {
  try {
    const validatedData = saveChatSchema.parse(req.body);

    const savedChat = await storage.saveChat(validatedData);

    return res.status(201).json(savedChat);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error("Error saving chat:", error);
    return res.status(500).json({ error: "Failed to save chat" });
  }
});

router.get("/saved/:id", async (req, res) => {
  try {
    const chatId = parseInt(req.params.id);
    if (isNaN(chatId)) {
      return res.status(400).json({ error: "Invalid chat ID" });
    }

    const savedChat = await storage.getSavedChat(chatId);

    if (!savedChat) {
      return res.status(404).json({ error: "Saved chat not found" });
    }

    return res.json(savedChat);
  } catch (error) {
    console.error("Error fetching saved chat:", error);
    return res.status(500).json({ error: "Failed to fetch saved chat" });
  }
});

router.delete("/saved/:id", async (req, res) => {
  try {
    const chatId = parseInt(req.params.id);
    if (isNaN(chatId)) {
      return res.status(400).json({ error: "Invalid chat ID" });
    }

    const result = await storage.deleteSavedChat(chatId);
    return res.json(result);
  } catch (error) {
    console.error("Error deleting saved chat:", error);
    return res.status(500).json({ error: "Failed to delete saved chat" });
  }
});

export default router;
