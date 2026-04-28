import "dotenv/config";
import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";

async function testOpenAIEdit() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("No OPENAI_API_KEY found");
    return;
  }

  // create a dummy image (transparent 1x1 png)
  const dummyImage = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
  fs.writeFileSync("dummy.png", dummyImage);

  const formData = new FormData();
  formData.append("prompt", "A cute baby wearing a spacesuit, 3d render, high quality");
  formData.append("model", "gpt-image-1"); // Testing legacy model name
  formData.append("image", fs.createReadStream("dummy.png"));
  formData.append("n", "1");
  formData.append("size", "1024x1024");

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
  };

  console.log("Sending request to OpenAI API (images/edits) with model: gpt-image-1...");
  
  try {
    const response = await fetch('https://api.openai.com/v1/images/edits', {
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
  } finally {
    fs.unlinkSync("dummy.png");
  }
}

testOpenAIEdit();
