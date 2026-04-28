import "dotenv/config";
import fetch from "node-fetch";
import FormData from "form-data";

async function testOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  const projectId = process.env.OPENAI_PROJECT_ID;

  if (!apiKey) {
    console.error("No OPENAI_API_KEY found");
    return;
  }

  const formData = new FormData();
  formData.append("prompt", "A cute baby wearing a spacesuit, 3d render, high quality");
  formData.append("model", "gpt-image-2-mini");
  formData.append("n", "1");
  formData.append("size", "1024x1024");
  formData.append("response_format", "url");

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
  };

  if (projectId && apiKey.startsWith('sk-proj-')) {
    headers['OpenAI-Project'] = projectId;
  }

  console.log("Sending request to OpenAI API (gpt-image-2-mini)...");
  
  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        ...headers,
        ...formData.getHeaders()
      },
      body: formData
    });

    const data = await response.json();
    console.log("Response Status:", response.status);
    console.log("Response Data:", JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error("Error:", error);
  }
}

testOpenAI();
