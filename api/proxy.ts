import express from "express";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import path from "path";

const app = express();
app.use(express.json({ limit: '50mb' }));

// CORS & iFrame Security
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Security-Policy", "frame-ancestors *");
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

const proxyRequest = async (req: any, res: any, targetPath: string) => {
  const targetUrl = `http://aibigtree.com${targetPath}`;
  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: { 'Content-Type': 'application/json' }
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error(`SaaS Proxy Error [${targetPath}]:`, error.message);
    res.status(500).json({ error: "SaaS 接口转发失败", details: error.message });
  }
};

// SaaS Tool Routes
app.post("/api/tool/launch", (req, res) => proxyRequest(req, res, "/api/tool/launch"));
app.post("/api/tool/verify", (req, res) => proxyRequest(req, res, "/api/tool/verify"));
app.post("/api/tool/consume", (req, res) => proxyRequest(req, res, "/api/tool/consume"));

// Gemini AI Route
app.post("/api/gemini", async (req, res) => {
  try {
    const { model, contents, config } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
    }

    const genAI = new GoogleGenAI({ apiKey });
    const result = await (genAI as any).models.generateContent({
      model,
      contents,
      generationConfig: config
    });

    const response = await result.response;
    res.json(response);
  } catch (error: any) {
    console.error("Gemini Server Error:", error.message);
    res.status(500).json({ error: error.message || "AI Generation Failed" });
  }
});

export default app;
