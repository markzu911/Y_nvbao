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
async function uploadResultToSaas(userId: string, toolId: string, imageBuffer: Buffer, index = 0) {
  const mimeType = "image/png";
  const fileName = `bag_result_${Date.now()}_${index}.png`;

  const tokenRes = await axios.post(`${SAAS_TARGET}/api/upload/direct-token`, {
    userId,
    toolId,
    source: "result",
    mimeType,
    fileName,
    fileSize: imageBuffer.length
  }, { validateStatus: () => true });

  const token = tokenRes.data.data || tokenRes.data;
  if (!token?.success) {
    throw new Error(token?.message || token?.error || "获取上传凭证失败");
  }

  const uploadRes = await axios.put(token.uploadUrl || token.ossUploadUrl, imageBuffer, {
    headers: { ...(token.headers || {}), "Content-Type": mimeType },
    validateStatus: () => true
  });

  if (uploadRes.status < 200 || uploadRes.status >= 300) {
    throw new Error(`OSS 上传失败: ${uploadRes.status}`);
  }

  const commitRes = await axios.post(`${SAAS_TARGET}/api/upload/commit`, {
    userId,
    toolId,
    source: "result",
    objectKey: token.objectKey,
    fileSize: imageBuffer.length
  }, { validateStatus: () => true });

  const commit = commitRes.data;
  if (!commit?.success && !commit?.savedToRecords && !commit?.image?.savedToRecords) {
    throw new Error(commit?.message || commit?.error || "图片入库失败");
  }

  return commit.image || {
    recordId: commit.recordId,
    url: commit.url,
    fileName: commit.fileName,
    fileSize: imageBuffer.length,
    savedToRecords: commit.savedToRecords
  };
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
    const parts = response.candidates?.[0]?.content?.parts || [];
    const generatedImageParts = parts.filter((part: any) => part.inlineData?.data);

    if (userId && toolId && generatedImageParts.length > 0) {
      const consumeRes = await axios.post(`${SAAS_TARGET}/api/tool/consume`, {
        userId,
        toolId
      }, { validateStatus: () => true });

      const consume = consumeRes.data;
      if (!consume?.success) {
        throw new Error(consume?.message || consume?.error || "积分扣除失败");
      }

      const currentIntegral = consume.data?.currentIntegral;

      for (let i = 0; i < generatedImageParts.length; i++) {
        const part: any = generatedImageParts[i];
        const imageBuffer = Buffer.from(part.inlineData.data, "base64");
        
        try {
          const imageInfo = await uploadResultToSaas(userId, toolId, imageBuffer, i);

          part.inlineData = undefined;
          part.saasImage = {
            ...imageInfo,
            currentIntegral
          };
        } catch (saasErr) {
          console.error("Failed to upload generated image to SaaS OSS:", saasErr);
          throw saasErr;
        }
      }
    }
    
    res.json({
      candidates: response.candidates,
      text: response.text
    });
  } catch (error: any) {
    console.error("Gemini Proxy Error:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.error?.message || error.message || "Failed to generate content";
    res.status(status).json({ error: message });
  }
});

export default app;
