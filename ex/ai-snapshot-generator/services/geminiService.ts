import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { UploadedImage, SnapCategory } from '../types';

const MAX_RETRIES = 3;

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateSnapshotImage = async (
  baseImages: UploadedImage[],
  prompt: string
): Promise<string> => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const imageParts = baseImages.map(image => ({
        inlineData: {
          data: image.base64,
          mimeType: image.mimeType,
        },
      }));
      
      let finalPrompt = '';
      if (baseImages.length > 1) {
          finalPrompt = `${prompt}. Faithfully recreate the faces and hair of the woman (first image) and the man (second image). Recreate their clothing from the photos, adapting it naturally to fit the scene's mood and setting. Do not include any objects they are holding in the original photos, such as phones.`;
      } else {
          finalPrompt = `${prompt}. Faithfully recreate the person's face and hair from the uploaded photo. Recreate their clothing from the photo, adapting it naturally to fit the scene's mood and setting. Do not include any objects they are holding in the original photo, such as phones.`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: {
          parts: [
            ...imageParts,
            {
              text: finalPrompt,
            },
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      const imagePart = response.candidates?.[0]?.content?.parts?.find(
        (part) => part.inlineData
      );

      if (imagePart && imagePart.inlineData) {
        return imagePart.inlineData.data;
      } else {
        throw new Error("No image data found in API response.");
      }
    } catch (error) {
      console.error(`Attempt ${attempt} failed for prompt: "${prompt}"`, error);
      if (attempt === MAX_RETRIES) {
        throw new Error(
          "Failed to generate image after multiple attempts. This could be due to content moderation or API limits."
        );
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error("Image generation failed unexpectedly.");
};

export const generateNewPrompts = async (originalPrompt: string): Promise<string[]> => {
  try {
    const systemInstruction = `You are a creative prompt engineer for an AI snapshot generator. Based on the user's original prompt, create 5 new variations for a candid, natural-feeling snapshot.
- The goal is to generate images that are clearly different but feel like they could be from the same day or outing.
- Maintain the original prompt's core mood and subject (e.g., a couple, a single person) and its film-like, hazy, soft-focus aesthetic.
- Emphasize a shallow depth of field, with the person as the main subject and a beautifully blurred background.
- Introduce noticeable variations in elements like:
    - **Pose/Action:** Describe a different natural, candid action (e.g., from walking to sitting on a bench, from laughing to looking at each other).
    - **Lighting/Time of Day:** Alter the lighting (e.g., from 'golden hour' to 'soft morning light' or 'overcast day').
    - **Camera Angle/Framing:** Slightly modify the camera shot (e.g., from 'medium shot' to 'waist-up shot' or 'close-up').
- Ensure the output is a JSON object with a single key "prompts" containing an array of 5 string prompts.
- Do not include the original prompt in the output.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Original prompt: "${originalPrompt}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prompts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["prompts"],
        },
      },
    });

    const jsonString = response.text.trim();
    const parsed = JSON.parse(jsonString);

    if (parsed.prompts && Array.isArray(parsed.prompts) && parsed.prompts.length > 0) {
      return parsed.prompts.slice(0, 5);
    } else {
      throw new Error("Invalid JSON structure in prompt generation response.");
    }
  } catch (error) {
    console.error("Failed to generate new prompts:", error);
    throw new Error("Could not generate new creative prompts.");
  }
};

export const generateMorePrompts = async (
  existingPrompts: string[],
  category: string,
  type: 'individual' | 'couple',
  gender: 'female' | 'male' | 'unisex'
): Promise<{text: string, category: SnapCategory}[]> => {
  try {
    const systemInstruction = `You are an expert prompt engineer for an AI snapshot generator. Your task is to generate 10 new, creative, and diverse prompts for photo generation. The prompts should be distinct from the provided list of existing prompts.
- Output a JSON object with a single key "prompts" containing an array of 10 new prompt objects.
- Each object in the array must have two keys: "text" (the full prompt string) and "category" (must be one of 'daily', 'travel', 'film').
- Each prompt must describe a complete, evocative scene for a candid, natural-feeling snapshot with a hazy, film-like aesthetic and a shallow depth of field. The person should be the main subject, with a beautifully blurred background.
- The prompts should fit the following criteria:
  - Type: ${type}
  - Gender: ${gender}
  - Category/Style: If a specific category like '${category}' is provided (and is not 'mix'), all new prompts should match that style. If 'mix', create a variety of styles across the four categories.
- Focus on describing:
    - **Scene & Location:** Unique settings.
    - **Action & Mood:** Natural, candid poses and emotions.
    - **Lighting:** Be specific (e.g., 'golden hour', 'neon glow', 'soft window light').
    - **Composition:** Camera angles, framing (close-ups, portraits), shallow depth of field.
    - **Aesthetic:** Mention film stocks (e.g., 'Kodak Portra 400', 'CineStill 800T'), textures (e.g., 'film grain'), and overall style (e.g., 'cinematic', 'dreamy').
- DO NOT repeat prompts from the 'Existing Prompts' list.`;

    const userMessage = `
      Category: ${category}
      Type: ${type}
      Gender: ${gender}
      
      Existing Prompts to avoid:
      - ${existingPrompts.join('\n- ')}
      
      Generate 10 new prompts.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userMessage,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prompts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                    text: { type: Type.STRING, description: "The full text of the image generation prompt." },
                    category: { type: Type.STRING, description: "The category of the prompt.", enum: ['daily', 'travel', 'film']}
                },
                required: ["text", "category"]
              },
            },
          },
          required: ["prompts"],
        },
      },
    });

    const jsonString = response.text.trim();
    const parsed = JSON.parse(jsonString);

    if (parsed.prompts && Array.isArray(parsed.prompts) && parsed.prompts.length > 0) {
      return parsed.prompts.slice(0, 10);
    } else {
      throw new Error("Invalid JSON structure in prompt generation response.");
    }
  } catch (error) {
    console.error("Failed to generate more prompts:", error);
    throw new Error("Could not generate new creative prompts.");
  }
};

export const generateStudioVideo = async (
  baseImage: UploadedImage,
  prompt: string
): Promise<string> => {
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-2.0-generate-001',
      prompt: prompt,
      image: {
        imageBytes: baseImage.base64,
        mimeType: baseImage.mimeType,
      },
      config: {
        numberOfVideos: 1,
      },
    });

    while (!operation.done) {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
      throw new Error('Video generation succeeded but no download link was found.');
    }

    const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.statusText}`);
    }

    const videoBlob = await videoResponse.blob();
    return URL.createObjectURL(videoBlob);
  } catch (error) {
    console.error('Failed to generate video:', error);
    throw new Error('Could not generate the video.');
  }
};