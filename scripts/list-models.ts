import "dotenv/config";
import fetch from "node-fetch";

async function listModels() {
  const apiKey = process.env.OPENAI_API_KEY;
  const projectId = process.env.OPENAI_PROJECT_ID;

  if (!apiKey) {
    console.error("No OPENAI_API_KEY found");
    return;
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
  };

  if (projectId && apiKey.startsWith('sk-proj-')) {
    headers['OpenAI-Project'] = projectId;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', { headers });
    const data = await response.json();
    console.log("Available models:", data.data.map((m: any) => m.id).filter((id: string) => id.includes("image") || id.includes("dall") || id.includes("gpt")));
  } catch (error) {
    console.error("Error:", error);
  }
}

listModels();
