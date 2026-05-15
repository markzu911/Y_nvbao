import express from "express";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

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
async function saveToSaas(userId: string, toolId: string, imageBuffer: Buffer) {
  try {
    const mimeType = 'image/png';
    const fileName = `render_${Date.now()}.png`;

    console.log(`[saveToSaas] Starting SaaS save flow for User ID: ${userId}, Tool ID: ${toolId}, File size: ${imageBuffer.length} bytes`);

    // 1. Consume
    console.log(`[saveToSaas Step 1] Calling /api/tool/consume`);
    const consumeRes = await axios.post(`${SAAS_TARGET}/api/tool/consume`, { userId, toolId });
    console.log(`[saveToSaas Step 1] /api/tool/consume response:`, JSON.stringify(consumeRes.data));
    const consumeInfo = consumeRes.data.data || consumeRes.data;
    const currentIntegral = consumeInfo.currentIntegral;

    // 2. Direct Token
    console.log(`[saveToSaas Step 2] Calling /api/upload/direct-token`);
    const tokenRes = await axios.post(`${SAAS_TARGET}/api/upload/direct-token`, {
      userId,
      toolId,
      source: 'result',
      mimeType,
      fileName,
      fileSize: imageBuffer.length
    });
    console.log(`[saveToSaas Step 2] /api/upload/direct-token response:`, JSON.stringify(tokenRes.data));
    const token = tokenRes.data.data || tokenRes.data;

    // 3. PUT to OSS
    console.log(`[saveToSaas Step 3] Uploading to OSS via direct PUT to ${token.uploadUrl}`);
    const uploadRes = await axios.put(token.uploadUrl, imageBuffer, {
      headers: { ...token.headers, 'Content-Type': mimeType }
    });
    console.log(`[saveToSaas Step 3] OSS PUT response status:`, uploadRes.status);

    // 4. Commit
    console.log(`[saveToSaas Step 4] Calling /api/upload/commit with objectKey: ${token.objectKey}`);
    const commitRes = await axios.post(`${SAAS_TARGET}/api/upload/commit`, {
      userId,
      toolId,
      source: 'result',
      objectKey: token.objectKey,
      fileSize: imageBuffer.length
    });
    console.log(`[saveToSaas Step 4] /api/upload/commit response:`, JSON.stringify(commitRes.data));

    const commitInfo = commitRes.data.image || commitRes.data;
    console.log(`[saveToSaas] Flow completed successfully!`);
    return { ...commitInfo, currentIntegral };
  } catch (err: any) {
    console.error(`[saveToSaas Error] Flow failed. error response:`, err.response?.data || err.message);
    throw err;
  }
}

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
    if (response.candidates?.[0]?.content?.parts && userId && toolId) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const buffer = Buffer.from(part.inlineData.data, 'base64');
          try {
            // Upload to SAAS directly on the server
            const imageInfo = await saveToSaas(userId, toolId, buffer);
            
            // Output SaaS URLs so frontend can use it directly
            part.inlineData = undefined;
            (part as any).saasImage = imageInfo;
          } catch (saasErr) {
            console.error("Failed to upload generated image to SaaS OSS:", saasErr);
            throw saasErr;
          }
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
