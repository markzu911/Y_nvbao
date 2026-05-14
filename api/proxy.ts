import express from "express";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import sharp from "sharp";

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

// SaaS Target
const SAAS_TARGET = "http://aibigtree.com";

// CORS Middleware
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Security-Policy", "frame-ancestors *");

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

const proxyRequest = async (req: express.Request, res: express.Response, targetPath: string) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${SAAS_TARGET}${targetPath}`,
      data: req.body,
      headers: { 'Content-Type': 'application/json' }
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error(`SaaS Proxy Error (${targetPath}):`, error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { error: "SaaS Proxy failed" });
  }
};

// SaaS Proxy Routes
app.post("/api/tool/launch", (req, res) => proxyRequest(req, res, "/api/tool/launch"));
app.post("/api/tool/verify", (req, res) => proxyRequest(req, res, "/api/tool/verify"));
app.post("/api/tool/consume", (req, res) => proxyRequest(req, res, "/api/tool/consume"));

// Upload & Commit Routes (Strictly matching the spec)
app.post("/api/upload/direct-token", (req, res) => proxyRequest(req, res, "/api/upload/direct-token"));
app.post("/api/upload/commit", (req, res) => proxyRequest(req, res, "/api/upload/commit"));

// Spec-compliant Save Function (Server-side)
async function saveToSaas(userId: string, toolId: string, base64Data: string) {
  try {
    const base64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    let imageBuffer = Buffer.from(base64, 'base64');
    
    // Spec Point 6: Normalize result image
    imageBuffer = await sharp(imageBuffer)
      .resize({
        width: 3072, 
        height: 3072, 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .toBuffer();

    const mimeType = 'image/png';
    const fileName = `render_${Date.now()}.png`;

    // 1. Consume
    const consumeRes = await axios.post(`${SAAS_TARGET}/api/tool/consume`, { userId, toolId });
    const consumeInfo = consumeRes.data.data || consumeRes.data;
    const currentIntegral = consumeInfo.currentIntegral;

    // 2. Direct Token
    const tokenRes = await axios.post(`${SAAS_TARGET}/api/upload/direct-token`, {
      userId,
      toolId,
      source: 'result',
      mimeType,
      fileName,
      fileSize: imageBuffer.length
    });
    const token = tokenRes.data.data || tokenRes.data;

    // 3. PUT to OSS
    await axios.put(token.uploadUrl, imageBuffer, {
      headers: { ...token.headers, 'Content-Type': mimeType }
    });

    // 4. Commit
    const commitRes = await axios.post(`${SAAS_TARGET}/api/upload/commit`, {
      userId,
      toolId,
      source: 'result',
      objectKey: token.objectKey,
      fileSize: imageBuffer.length
    });

    const commitInfo = commitRes.data.image || commitRes.data;
    return { ...commitInfo, currentIntegral };
  } catch (err: any) {
    console.error("Save to SaaS Failed:", err.response?.data || err.message);
    throw err;
  }
}

// Dedicated endpoint for frontend to call, ensuring server-side handling
app.post("/api/upload/image", async (req, res) => {
  const { userId, toolId, base64 } = req.body;
  
  if (!userId || !toolId || !base64) {
    return res.status(400).json({ error: "Missing required fields (userId, toolId, base64)" });
  }

  try {
    const imageData = await saveToSaas(userId, toolId, base64);
    res.json({ success: true, image: imageData });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save image to SaaS" });
  }
});

// Gemini Proxy Route
app.post("/api/gemini", async (req, res) => {
  try {
    const { model, payload, userId, toolId, resolution } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server" });
    }

    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    const response = await ai.models.generateContent({
      model,
      ...payload
    });
    
    // Process generated images if any
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          let buffer = Buffer.from(part.inlineData.data, 'base64');
          
          // Determine target size based on resolution
          let targetSize = 3072; // Default 3K
          if (resolution === '1K') targetSize = 1024;
          else if (resolution === '2K') targetSize = 2048;
          else if (resolution === '4K') targetSize = 4096;

          buffer = await sharp(buffer)
            .resize({
              width: targetSize,
              height: targetSize,
              fit: 'inside',
              withoutEnlargement: true
            })
            .toBuffer();
          
          part.inlineData.data = buffer.toString('base64');
        }
      }
    }
    
    res.json({
      candidates: response.candidates,
      text: response.text
    });
  } catch (error: any) {
    console.error("Gemini Proxy Error:", error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.error?.message || error.message || "Failed to generate content";
    res.status(status).json({ error: message });
  }
});

export default app;
