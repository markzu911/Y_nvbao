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
app.post("/api/upload/image", (req, res) => proxyRequest(req, res, "/api/upload/image"));

// Gemini Proxy Route
app.post("/api/gemini", async (req, res) => {
  try {
    const { model, payload } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server" });
    }

    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    const response = await ai.models.generateContent({
      model,
      ...payload
    });
    
    res.json({
      candidates: response.candidates,
      text: response.text
    });
  } catch (error: any) {
    console.error("Gemini Proxy Error:", error.message);
    res.status(500).json({ error: error.message || "Failed to generate content" });
  }
});

export default app;
