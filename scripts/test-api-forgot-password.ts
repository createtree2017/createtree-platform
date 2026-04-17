import fetch from "node-fetch";

async function main() {
  try {
    const response = await fetch("http://localhost:5000/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ct.createtree@gmail.com" }),
    });
    
    const data = await response.json();
    console.log("Status:", response.status);
    console.log("Response:", data);
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

main();
