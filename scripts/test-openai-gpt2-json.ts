import "dotenv/config";
import fetch from "node-fetch";

async function testOpenAIJson() {
  const apiKey = process.env.OPENAI_API_KEY;
  const projectId = process.env.OPENAI_PROJECT_ID;

  if (!apiKey) {
    console.error("No OPENAI_API_KEY found");
    return;
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  if (projectId && apiKey.startsWith('sk-proj-')) {
    headers['OpenAI-Project'] = projectId;
  }

  console.log("Sending JSON request to OpenAI API (gpt-image-2-mini) for generations...");
  
  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: "gpt-image-2-mini",
        prompt: "A cute baby wearing a spacesuit, 3d render, high quality",
        n: 1,
        size: "1024x1024"
      })
    });

    const data = await response.json();
    console.log("Response Status:", response.status);
    console.log("Response Data:", JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error("Error:", error);
  }
}

testOpenAIJson();
