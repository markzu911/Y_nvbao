import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  Image as ImageIcon, 
  Settings, 
  Maximize, 
  Download, 
  RefreshCcw, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Monitor,
  Store,
  Palmtree,
  Building2,
  Home,
  Shirt,
  Zap,
  Lock,
  Search
} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';

// API Configuration for SaaS
const SAAS_API = {
  launch: '/api/tool/launch',
  verify: '/api/tool/verify',
  consume: '/api/tool/consume'
};

// Constants
const BACKGROUNDS = [
  { id: 'city_street', name: '城市街道', icon: <Building2 className="w-5 h-5" />, prompt: 'luxury city street with modern architecture, shallow depth of field' },
  { id: 'modern_cafe', name: '现代咖啡店', icon: <Store className="w-5 h-5" />, prompt: 'minimalist modern cafe lounge, warm natural light, high-end interior' },
  { id: 'sunset_beach', name: '日落海滩', icon: <Palmtree className="w-5 h-5" />, prompt: 'luxury tropical sunset beach, golden hour, soft sand' },
  { id: 'white_studio', name: '白色影棚', icon: <Camera className="w-5 h-5" />, prompt: 'professional stark white photography studio, clean minimalist lighting' },
  { id: 'luxury_mall', name: '高端百货', icon: <Store className="w-5 h-5" />, prompt: 'high-end luxury department store interior, glossy surfaces, bokeh lighting' },
  { id: 'minimal_home', name: '简约家居', icon: <Home className="w-5 h-5" />, prompt: 'modern minimalist luxury penthouse interior, scandiavian design' },
];

const RATIOS = [
  { id: '1:1', name: '1:1' },
  { id: '3:4', name: '3:4' },
  { id: '4:3', name: '4:3' },
  { id: '16:9', name: '16:9' },
  { id: '9:16', name: '9:16' },
];

const RESOLUTIONS = [
  { id: '1K', name: '1k (高清)' },
  { id: '2K', name: '2k (超清)' },
  { id: '4K', name: '4k (极致)' },
];

const AGES = [
  { id: 'child', name: '小孩', prompt: 'a cute child model' },
  { id: 'young', name: '青年', prompt: 'a stylish young adult female model' },
  { id: 'senior', name: '老年', prompt: 'an elegant senior female model' },
];

const STILL_LIFE_STYLES = [
  { id: 'creative_rabbit', name: '创意兔兔', prompt: 'SCENE COMPOSITION REPLICA (EXACT MATCH TO REFERENCE): BACKGROUND: A two-tone premium studio setup with a vibrant solid sky-blue back wall and a slightly darker blue floor surface. THE HERO: This specific bag. SPECIFIC PROPS: 1. A large, matte-finish white sphere (geometric studio ball) is placed directly behind the bag to the left. 2. A small, cute white fluffy rabbit is peeking out from behind the bag to the right. 3. Another smaller white sphere is in the lower-left foreground. ENHANCEMENT: A few delicate white lily petals are scattered artistically on the blue floor. LIGHTING: High-end luxury fashion photography.' },
  { id: 'minimalist_pedestal', name: '极简氛围', prompt: 'ARCHITECTURAL MINIMALISM REPLICA: SETTING: A high-end editorial gallery space with a warm off-white background. CENTRAL PROP: The hero bag stands atop a liquid-black glossy architectural pedestal. ENHANCEMENT: Next to the bag on the pedestal sits a sleek, minimalist crystal perfume bottle reflecting the studio lights. A single long-stemmed calla lily leans gracefully against the pedestal. LIGHTING: Soft, directional top-down studio lighting. ATMOSPHERE: Sophisticated quiet luxury.' },
  { id: 'natural_branch', name: '自然意境', prompt: 'NATURAL ZEN COMPOSITION: The hero bag is artistically balanced on a weathered organic wooden branch. Background: A warm apricot-toned studio background. ENHANCEMENT: Small, smooth river pebbles and a few stalks of pampas grass are arranged near the base of the branch. A thin silk ribbon in a matching earth tone is draped elegantly over one side of the branch. LIGHTING: Soft, cinematic side-lighting with long organic shadows.' },
  { id: 'cozy_lifestyle', name: '家居闲适', prompt: 'COZY LIFESTYLE REPLICA: The hero bag is placed on soft, crumpled white linen fabric. Background: Neutral warm-grey wall. ENHANCEMENT: A pair of high-end oversized designer sunglasses and an open luxury fashion magazine are lying naturally near the bag, as if just set down. A soft, warm morning sunbeam casts the shadow of a Monstera leaf across the scene. Style: Clean and airy lifestyle aesthetic.' },
];

// Types
interface GeneratedImage {
  id: string;
  url: string;
  title: string;
}

export default function App() {
  const [mode, setMode] = useState<'model' | 'still' | 'inspired'>('model');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [background, setBackground] = useState(BACKGROUNDS[0]);
  const [ratio, setRatio] = useState(RATIOS[0]);
  const [age, setAge] = useState(AGES[1]);
  const [stillLifeStyle, setStillLifeStyle] = useState(STILL_LIFE_STYLES[0]);
  const [resolution, setResolution] = useState(RESOLUTIONS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [step, setStep] = useState(1); // 1: Analysis, 2: Generation
  const [description, setDescription] = useState<string>("");

  // SaaS States
  const [userId, setUserId] = useState<string | null>(null);
  const [toolId, setToolId] = useState<string | null>(null);
  const [userIntegral, setUserIntegral] = useState<number>(0);
  const [userInfo, setUserInfo] = useState<{ name?: string; enterprise?: string } | null>(null);

  // Listen for SAAS_INIT from parent window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SAAS_INIT') {
        const { userId: uid, toolId: tid } = event.data;
        if (uid && tid) {
          setUserId(uid);
          setToolId(tid);
          initSaaS(uid, tid);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    
    // Also try to check session storage/URL for initial load if needed, 
    // but postMessage is the recommended way here.
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const initSaaS = async (uid: string, tid: string) => {
    try {
      const response = await fetch(SAAS_API.launch, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, toolId: tid })
      });
      const result = await response.json();
      if (result.success) {
        setUserIntegral(result.data.user.integral);
        setUserInfo(result.data.user);
      }
    } catch (err) {
      console.error('SaaS Launch Error:', err);
    }
  };

  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreviewUrl, setRefPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setResults([]);
      setError(null);
      setSelectedImage(null);
    }
  };

  const handleRefFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setRefFile(selectedFile);
      setRefPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleDownload = (imageUrl: string, filename: string) => {
    try {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Download failed", err);
      setError("下载失败，请尝试右键点击图片手动保存。");
    }
  };

  const downloadAll = () => {
    results.forEach((res, index) => {
      setTimeout(() => {
        handleDownload(res.url, `luxe-bag-gen-${index + 1}.png`);
      }, index * 200);
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const generateAIImages = async () => {
    if (!file) {
      setError("请先上传包包图片以开始创作");
      return;
    }

    setIsGenerating(true);
    setError(null);
    
    // Move current results to history before clearing
    if (results.length > 0) {
      setHistory(prev => {
        // Filter out any duplicates if necessary, though IDs should be unique
        const filteredNew = results.filter(res => !prev.some(h => h.url === res.url));
        return [...filteredNew, ...prev];
      });
    }
    
    setResults([]);

    try {
      // 1. SaaS Verify Points
      if (userId && toolId) {
        const verifyRes = await fetch(SAAS_API.verify, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, toolId })
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          setError(verifyData.message || "积分不足，无法开始生成");
          setIsGenerating(false);
          return;
        }
      }

      const base64Image = await fileToBase64(file);
      const base64Ref = refFile ? await fileToBase64(refFile) : null;

      // Step 1: Deep Analysis of the product to ensure 1:1 fidelity
      setStep(1);

      const generateContent = async (model: string, payload: any) => {
        const res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            model, 
            payload, 
            resolution: resolution.id,
            userId,
            toolId
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || err.message || "Generation failed");
        }
        return res.json();
      };

      const [analysisResult, refAnalysisResult] = await Promise.all([
        generateContent("gemini-3.1-flash-image-preview", {
          contents: [
            { parts: [
              { inlineData: { data: base64Image, mimeType: file.type } },
              { text: "Identity Analysis: Describe this bag with fanatical detail so a generator can clone it. 1. Precise Geometry (box height-width ratio, edge curvature); 2. Material DNA (exact texture, grain size, sheen level); 3. Hardware Signature (exact count and placement of rivets, shape of pulls); 4. Logo Typography and Scale. Output in English technical terms." }
            ]}
          ]
        }),
        (mode === 'inspired' && base64Ref) ? generateContent("gemini-3.1-flash-image-preview", {
          contents: [
            { parts: [
              { inlineData: { data: base64Ref, mimeType: refFile!.type } },
              { text: "Detailed Visual Analysis: Analyze this reference image. Describe in one technical paragraph: 1. The Environment (architecture, lighting, color palette); 2. HUMAN ELEMENTS (If a person is present, specify their exact outfit, pose, orientation, and action); 3. Compositional layout. The goal is to replicate these elements exactly in a new generation." }
            ]}
          ]
        }) : Promise.resolve({ text: "" })
      ]);

      const bagDescription = analysisResult.text || "a high-end luxury bag";
      const sceneDescription = refAnalysisResult.text || "";
      setDescription(bagDescription);

      // Step 2: Generate 1 or 2 images
      setStep(2);
      
      const dynamicConstraints = `CORE REQUIREMENT: The bag must be a 100% VISUAL CLONE of the reference image. NO MODIFICATIONS. Do not allow the AI to 'hallucinate' extra handles, straps, or hardware. Use the exact material texture and color from the source.`;
      const commonSettings = `high-end professional commercial photography, cinematic studio lighting, f/2.8, hyper-realistic, 8k quality, elegant color grading.`;
      
      let imageConfigs: { title: string, prompt: string }[] = [];

      if (mode === 'inspired' && base64Ref) {
        imageConfigs = [
          {
            title: "灵感复刻渲染",
            prompt: `IMAGE 1 (Product) is the ABSOLUTE MASTER SOURCE for the bag. IMAGE 2 (Reference) is the SOURCE for the scene/environment ONLY.
            TASK: Create a new image replicating the scene, lighting, and human posture from IMAGE 2: ${sceneDescription}.
            STRICT MANDATE: Place the bag from IMAGE 1 (${bagDescription}) into the scene. 
            DO NOT use or include the bag from IMAGE 2. REPLACING any bag in IMAGE 2 with the bag from IMAGE 1 is COMPULSORY.
            The bag must be an identical clone of IMAGE 1 in shape, texture, and hardware.
            ${dynamicConstraints} ${commonSettings}`
          }
        ];
      } else if (mode === 'model') {
        const consistentOutfit = "Wearing a minimalist, high-end oversized cream-colored silk blazer and matching tailored trousers.";
        const consistentModel = `Model: ${age.prompt} with a ${age.id === 'child' ? 'clear and distinct facial features' : 'sleek low bun, neutral makeup, and elegant professional posture'}. OUTFIT: ${consistentOutfit}.`;
        
        imageConfigs = [
          {
            title: "模特背包正面视角",
            prompt: `${consistentModel} Full body front view, walking naturally. The bag is: ${bagDescription}. ${dynamicConstraints} Background: ${background.prompt}. ${commonSettings}`
          },
          {
            title: "模特背包侧面视角",
            prompt: `${consistentModel} Medium side profile shot. The bag is: ${bagDescription}. ${dynamicConstraints} Background: ${background.prompt}. ${commonSettings}`
          }
        ];
      } else {
        imageConfigs = [
          {
            title: "品牌创意静物大片",
            prompt: `${stillLifeStyle.prompt} The hero is: ${bagDescription}. ${dynamicConstraints} WIDE ANGLE WIDE SHOT.`
          }
        ];
      }

      const newResults: GeneratedImage[] = [];

      for (let i = 0; i < imageConfigs.length; i++) {
        const config = imageConfigs[i];
        
        const contentParts: any[] = [
          { inlineData: { data: base64Image, mimeType: file.type } }
        ];

        if (mode === 'inspired' && base64Ref) {
          contentParts.push({ inlineData: { data: base64Ref, mimeType: refFile!.type } });
        }

        const response = await generateContent('gemini-3.1-flash-image-preview', {
          contents: [
            {
              role: 'user',
              parts: [
                ...contentParts,
                { text: `TASK: ${config.prompt}. STRICT: Match the product exactly.` }
              ]
            }
          ],
          config: {
            imageConfig: {
              aspectRatio: ratio.id,
              imageSize: resolution.id
            }
          }
        });

        // The backend returns { candidates, text }
        // The inlineData might be replaced by saasImage on the backend
        const imagePart = response.candidates?.[0]?.content?.parts.find((p: any) => p.saasImage || p.inlineData);
        if (imagePart) {
          if (imagePart.saasImage) {
            // When uploaded to SaaS directly from our backend
            newResults.push({
              id: imagePart.saasImage.recordId || `gen-${i}-${Date.now()}`,
              url: imagePart.saasImage.url,
              title: config.title
            });
            if (imagePart.saasImage.currentIntegral !== undefined) {
              setUserIntegral(imagePart.saasImage.currentIntegral);
            }
          } else if (imagePart.inlineData) {
            // Fallback if not configured for SaaS (no userId/toolId)
            newResults.push({
              id: `gen-${i}-${Date.now()}`,
              url: `data:image/png;base64,${imagePart.inlineData.data}`,
              title: config.title
            });
          }
          setResults([...newResults]);
        }
      }

      if (newResults.length === 0) {
        throw new Error("生成失败，请检查网络或重试");
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "由于流量限制，生成暂时不可用，请稍后重试。");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-screen w-full bg-[#FAF9F7] text-zinc-800 flex flex-col font-sans overflow-hidden">
      <header className="h-16 px-10 flex items-center justify-between bg-white/60 backdrop-blur-xl shrink-0 z-50 border-b border-zinc-100/80">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-200">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col -space-y-1">
            <span className="text-[15px] font-black tracking-tighter text-indigo-950 uppercase">奢华影棚</span>
            <span className="text-[9px] font-bold text-indigo-400 tracking-[0.2em] uppercase">AI 渲染引擎</span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {userIntegral !== undefined && (
            <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50 rounded-xl border border-indigo-100">
               <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-indigo-900 leading-none">{userIntegral}</span>
                 <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-tighter">积分余额</span>
               </div>
               <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100">
                 <Zap className="w-4 h-4 text-white fill-current" />
               </div>
            </div>
          )}
          {userInfo?.name && (
            <div className="hidden md:flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-indigo-100 p-0.5">
                <div className="w-full h-full bg-zinc-100 rounded-full flex items-center justify-center text-indigo-600 font-black text-xs">
                  {userInfo.name.charAt(0)}
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-zinc-900 leading-none">{userInfo.name}</span>
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">{userInfo.enterprise || '企业用户'}</span>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <aside className="w-[320px] border-r border-zinc-200/60 flex flex-col bg-white shrink-0 shadow-sm z-40">
          <div className="flex-1 overflow-y-auto p-8 space-y-12">
            {/* Setting Group */}
            <section>
              <div className="grid grid-cols-3 gap-2">
                {RESOLUTIONS.map((res) => (
                  <button
                    key={res.id}
                    onClick={() => setResolution(res)}
                    className={`py-3 text-[10px] font-black rounded-xl border-2 transition-all duration-300 ${
                      resolution.id === res.id 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-200' 
                      : 'bg-white border-zinc-50 text-zinc-400 hover:border-indigo-100'
                    }`}
                  >
                    {res.id}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="grid grid-cols-3 gap-2">
                {RATIOS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRatio(r)}
                    className={`py-3 text-[10px] font-black rounded-xl border-2 transition-all duration-300 ${
                      ratio.id === r.id 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-200' 
                      : 'bg-white border-zinc-50 text-zinc-400 hover:border-indigo-100'
                    }`}
                  >
                    {r.id}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="flex flex-col gap-2">
                {[
                  { id: 'model', name: '人像模特', desc: '模特拍摄' }, 
                  { id: 'still', name: '商业静物', desc: '产品静物' },
                  { id: 'inspired', name: '灵感参考', desc: '风格注入' }
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { 
                      setMode(m.id as any); 
                      if (m.id === 'still') setRatio(RATIOS[0]); 
                    }}
                    className={`group py-4 px-5 rounded-2xl border-2 transition-all duration-500 text-left relative overflow-hidden ${
                      mode === m.id 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xl shadow-indigo-200' 
                      : 'bg-zinc-50/50 border-zinc-50 text-zinc-400 hover:border-indigo-100'
                    }`}
                  >
                    <div className="relative z-10">
                      <p className="text-[11px] font-black tracking-wider uppercase mb-0.5">{m.name}</p>
                      <p className={`text-[9px] font-bold tracking-widest uppercase ${mode === m.id ? 'text-indigo-200' : 'text-zinc-300'}`}>{m.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <AnimatePresence mode="wait">
              {mode === 'model' && (
                <motion.div key="m" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-8 pt-4">
                  <section>
                    <div className="grid grid-cols-2 gap-2">
                      {BACKGROUNDS.map((bg) => (
                        <button
                          key={bg.id}
                          onClick={() => setBackground(bg)}
                          className={`py-3 px-4 text-[9px] font-black rounded-xl border-2 transition-all duration-300 truncate text-left tracking-widest uppercase ${
                            background.id === bg.id 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
                            : 'bg-white border-zinc-50 text-zinc-400 hover:border-indigo-100'
                          }`}
                        >
                          {bg.name}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section>
                    <div className="grid grid-cols-3 gap-2">
                      {AGES.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => setAge(a)}
                          className={`py-3 text-[9px] font-black rounded-xl border-2 transition-all duration-300 tracking-widest uppercase ${
                            age.id === a.id 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
                            : 'bg-white border-zinc-50 text-zinc-400 hover:border-indigo-100'
                          }`}
                        >
                          {a.name}
                        </button>
                      ))}
                    </div>
                  </section>
                </motion.div>
              )}

              {mode === 'still' && (
                <motion.div key="s" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-8 pt-4">
                  <section>
                    <div className="grid grid-cols-2 gap-2">
                      {STILL_LIFE_STYLES.map((style) => (
                        <button
                          key={style.id}
                          onClick={() => setStillLifeStyle(style)}
                          className={`py-3 px-4 text-[9px] font-black rounded-xl border-2 transition-all duration-300 text-left tracking-widest uppercase ${
                            stillLifeStyle.id === style.id 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
                            : 'bg-zinc-50/50 border-zinc-50 text-zinc-400 hover:border-indigo-100'
                          }`}
                        >
                          {style.name}
                        </button>
                      ))}
                    </div>
                  </section>
                </motion.div>
              )}

              {mode === 'inspired' && (
                <motion.div key="i" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="pt-4">
                  <div className="p-5 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl">
                    <p className="text-[10px] text-zinc-400 font-bold leading-relaxed tracking-wide">
                      风格注入：AI 将从您的参考图中提取视觉基因（光影、质感、几何），并将其与目标产品融合。
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="p-8 bg-white border-t border-zinc-100">
            <button
              disabled={!file || isGenerating}
              onClick={generateAIImages}
              className={`w-full py-5 text-[11px] font-black tracking-[0.2em] uppercase rounded-2xl transition-all duration-500 overflow-hidden relative shadow-2xl ${
                !file || isGenerating 
                ? 'bg-zinc-100 text-zinc-300 cursor-not-allowed' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200 active:scale-[0.98]'
              }`}
            >
              <div className="relative z-10 flex items-center justify-center gap-3">
                {isGenerating ? (
                  <>
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                    <span>正在渲染生成</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    <span>立即开始创作</span>
                  </>
                )}
              </div>
            </button>
          </div>
        </aside>

        <section className="flex-1 flex flex-col bg-[#F6F5F2] overflow-y-auto relative">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />
          
          {/* Top Selection Slots */}
          <div className="p-12 lg:p-16 grid grid-cols-2 gap-12 max-w-6xl mx-auto w-full shrink-0">
             <div 
                onClick={() => fileInputRef.current?.click()}
                className={`bg-white rounded-[40px] p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-700 aspect-[1.8/1] relative group overflow-hidden ${
                  previewUrl ? 'shadow-2xl ring-2 ring-indigo-600' : 'border-4 border-dashed border-zinc-200 hover:border-indigo-400 shadow-sm'
                }`}
             >
               {previewUrl ? (
                 <>
                   <img src={previewUrl} className="h-full object-contain p-4 group-hover:scale-105 transition-transform duration-700" />
                   {step === 1 && (
                     <motion.div 
                        initial={{ top: "-10%" }}
                        animate={{ top: "110%" }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="absolute left-0 w-full h-[3px] bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.8)] z-20"
                     />
                   )}
                 </>
               ) : (
                 <>
                   <div className="w-20 h-20 bg-zinc-50 rounded-[32px] flex items-center justify-center mb-6 transition-all duration-500 group-hover:scale-110 group-hover:bg-indigo-600">
                     <Upload className="w-8 h-8 text-zinc-300 group-hover:text-white" />
                   </div>
                   <span className="text-[14px] font-black text-zinc-900 mb-1 tracking-wider uppercase">主产品图片</span>
                   <p className="text-[10px] text-zinc-400 font-bold tracking-[0.15em] uppercase">上传主产品图</p>
                 </>
               )}
               <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
             </div>

             <div 
               onClick={() => mode === 'inspired' && refFileInputRef.current?.click()}
               className={`rounded-[40px] p-12 flex flex-col items-center justify-center aspect-[1.8/1] transition-all duration-700 relative group overflow-hidden ${
                 mode === 'inspired' 
                 ? refPreviewUrl ? 'bg-white shadow-2xl ring-2 ring-black' : 'bg-white border-4 border-dashed border-zinc-200 hover:border-black cursor-pointer'
                 : 'bg-zinc-200/30 opacity-40 cursor-not-allowed border-none'
               }`}
             >
               {refPreviewUrl && mode === 'inspired' ? (
                 <>
                    <img src={refPreviewUrl} className="h-full object-contain p-4 group-hover:scale-105 transition-transform duration-700" />
                    {step === 1 && (
                      <motion.div 
                         initial={{ top: "-10%" }}
                         animate={{ top: "110%" }}
                         transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                         className="absolute left-0 w-full h-[2px] bg-black/40 shadow-[0_0_15px_rgba(0,0,0,0.5)] z-20"
                      />
                    )}
                 </>
               ) : (
                 <>
                   <div className="w-20 h-20 bg-zinc-50 rounded-[32px] flex items-center justify-center mb-6">
                     {mode === 'inspired' ? <ImageIcon className="w-8 h-8 text-zinc-300" /> : <Lock className="w-6 h-6 text-zinc-200" />}
                   </div>
                    <span className="text-[14px] font-black text-zinc-900 mb-1 tracking-wider uppercase">灵感参考</span>
                   <p className="text-[10px] text-zinc-400 font-bold tracking-[0.15em] uppercase pl-1">
                     {mode === 'inspired' ? '注入设计基因' : '当前模式下不可用'}
                   </p>
                 </>
               )}
               <input type="file" ref={refFileInputRef} onChange={handleRefFileChange} className="hidden" accept="image/*" />
             </div>
          </div>

          <div className="px-12 lg:px-16 pb-20 flex flex-col gap-12 max-w-7xl mx-auto w-full">
            <div className="flex items-center justify-between border-b-2 border-zinc-200/50 pb-6">
              <div className="flex items-center gap-4">
                <h3 className="text-[13px] font-black text-zinc-900 tracking-[0.3em] uppercase">渲染预览</h3>
                {isGenerating && (
                   <div className="flex items-center gap-2 px-4 py-1 bg-indigo-600 rounded-full shadow-lg shadow-indigo-200">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                      <span className="text-[9px] text-white font-black tracking-widest uppercase">处理中</span>
                   </div>
                )}
              </div>
              {results.length > 0 && (
                 <button onClick={downloadAll} className="px-6 py-3 bg-white text-zinc-900 text-[10px] font-black tracking-[0.2em] uppercase rounded-full shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-3">
                   <Download className="w-4 h-4" />
                   保存全部
                 </button>
              )}
            </div>


            <div className={`grid gap-8 lg:gap-12 ${
              mode === 'model' 
              ? 'grid-cols-1 xl:grid-cols-2' 
              : 'grid-cols-1'
            }`}>
                <div className="flex flex-col items-center w-full">
                  <div className="w-full h-full min-h-[400px] flex items-center justify-center">
                    <div className="w-full max-w-[540px]">
                      <AnimatePresence mode="wait">
                        {results[0] ? (
                          <ResultCard 
                            key="hero-result"
                            img={results[0]} 
                            label="主体渲染" 
                            footerLabel="主渲染全景视角" 
                            onPreview={() => setSelectedImage(results[0])} 
                            onDownload={() => handleDownload(results[0].url, 'render-hero.png')} 
                            ratio={ratio.id}
                          />
                        ) : (
                          <LoadingCard 
                            key="hero-loading"
                            label={step === 1 ? "视觉分析中" : "正在生成杰作"} 
                            loading={isGenerating && results.length < 1} 
                            activeStep={step}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
                
                {mode === 'model' && (
                  <div className="flex flex-col items-center w-full">
                    <div className="w-full h-full min-h-[400px] flex items-center justify-center">
                      <div className="w-full max-w-[540px]">
                        <AnimatePresence mode="wait">
                          {results[1] ? (
                            <ResultCard 
                              key="detail-result"
                              img={results[1]} 
                              label="细节展示" 
                              footerLabel="氛围细节视角" 
                              onPreview={() => setSelectedImage(results[1])} 
                              onDownload={() => handleDownload(results[1].url, 'render-detail.png')} 
                              ratio={ratio.id}
                            />
                          ) : (
                            <LoadingCard 
                              key="detail-loading"
                              label={step === 1 ? "场景预取" : "正在营造氛围"} 
                              loading={isGenerating && results.length < 2} 
                              activeStep={step}
                            />
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </div>

            {/* History Sheet */}
            {history.length > 0 && (
              <div className="mt-32 pt-16 border-t border-zinc-200/50">
                <div className="flex justify-between items-center mb-10">
                  <h3 className="text-[10px] uppercase tracking-[0.4em] font-black text-zinc-300">历史回顾</h3>
                  <button onClick={() => setHistory([])} className="text-[9px] uppercase tracking-widest text-zinc-400 hover:text-black transition-colors font-black">清空历史</button>
                </div>
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-6">
                  {history.map((img) => (
                    <motion.div
                      key={img.id}
                      whileHover={{ y: -6, scale: 1.05 }}
                      onClick={() => setSelectedImage(img)}
                      className="aspect-[3/4] relative bg-white border border-zinc-100 rounded-2xl cursor-pointer overflow-hidden group shadow-sm hover:shadow-2xl transition-all duration-500"
                    >
                      <img src={img.url} className="w-full h-full object-cover transition-all duration-1000" />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {!isGenerating && results.length === 0 && (
              <div className="flex-1 min-h-[500px] flex flex-col items-center justify-center opacity-[0.05]">
                <div className="w-40 h-40 border-2 border-black rounded-full flex items-center justify-center mb-8">
                  <Camera className="w-12 h-12" />
                </div>
                <p className="text-[11px] tracking-[0.8em] uppercase font-black text-black">准备就绪</p>
              </div>
            )}
          </section>
        </main>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95 }} 
            className="fixed bottom-12 right-12 p-8 bg-black text-white shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] z-[100] max-w-sm rounded-[32px] border border-white/10"
          >
            <div className="flex items-start gap-5">
              <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
              <div>
                <p className="text-[12px] font-bold leading-relaxed tracking-wide">{error}</p>
                <button onClick={() => setError(null)} className="mt-4 text-[9px] uppercase tracking-[0.2em] font-black underline opacity-40 hover:opacity-100 transition-opacity">关闭</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="h-12 px-10 border-t border-zinc-100 flex items-center justify-between text-[9px] uppercase tracking-[0.3em] font-black text-zinc-300 shrink-0 bg-white">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
          引擎已同步
        </div>
        <div className="opacity-40">系统版本 v3.1</div>
      </footer>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-8 lg:p-24"
            onClick={() => setSelectedImage(null)}
          >
            <motion.button
              className="absolute top-12 right-12 text-white/30 hover:text-white transition-colors p-4"
              onClick={() => setSelectedImage(null)}
            >
              <RefreshCcw className="w-8 h-8 rotate-45" />
            </motion.button>

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-full max-h-full flex flex-col items-center gap-12"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedImage.url}
                alt={selectedImage.title}
                className="max-w-full max-h-[75vh] object-contain shadow-[0_64px_128px_-12px_rgba(0,0,0,0.8)] rounded-2xl border border-white/5"
                referrerPolicy="no-referrer"
              />
              <div className="flex flex-col items-center gap-6 text-white text-center">
                <span className="text-[12px] uppercase tracking-[0.5em] font-black opacity-60">{selectedImage.title}</span>
                <button
                  onClick={() => handleDownload(selectedImage.url, `${selectedImage.id}.png`)}
                  className="flex items-center gap-4 px-10 py-5 bg-white text-black text-[11px] uppercase tracking-[0.3em] font-black hover:bg-black hover:text-white transition-all shadow-2xl active:scale-95"
                >
                  <Download className="w-5 h-5" />
                  保存高清文件
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultCard({ img, label, footerLabel, onPreview, onDownload, ratio }: { img: GeneratedImage, label: string, footerLabel: string, onPreview: () => void, onDownload: () => void, ratio: string, key?: string }) {
  // Use a fixed aspect ratio for the UI container for a more stable deck/grid layout
  // while the image inside maintains its actual generated ratio via object-contain
  const containerAspect = 'aspect-[4/5]';

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`group relative bg-white rounded-[40px] overflow-hidden border border-zinc-100 shadow-xl hover:shadow-[0_48px_80px_-16px_rgba(0,0,0,0.12)] transition-all duration-1000 w-full flex flex-col p-4 ${containerAspect}`}
    >
      <div className="absolute top-8 left-8 z-20 flex flex-col gap-2">
        <div className="px-4 py-2 bg-black/90 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl">
          <span className="text-[9px] font-black tracking-[0.3em] text-white uppercase">{label}</span>
        </div>
        <div className="px-3 py-1.5 bg-white/90 backdrop-blur-md rounded-full border border-zinc-100 shadow-sm self-start">
          <span className="text-[9px] font-bold text-zinc-500 uppercase">{ratio}</span>
        </div>
      </div>

      <div className="flex-1 relative cursor-zoom-in rounded-[32px] overflow-hidden bg-zinc-50" onClick={onPreview}>
        <img 
          src={img.url} 
          className="w-full h-full object-contain transition-transform duration-[2000ms] group-hover:scale-105" 
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 flex items-center justify-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center scale-75 group-hover:scale-100 transition-transform duration-700 shadow-2xl">
               <Maximize className="w-6 h-6 text-black" />
            </div>
        </div>
      </div>
      
      <div className="h-24 px-6 flex justify-between items-center shrink-0">
        <div className="flex flex-col gap-1">
          <p className="text-[12px] font-black text-zinc-900 tracking-tight">{img.title}</p>
          <p className="text-[9px] text-zinc-400 font-bold tracking-[0.2em] uppercase">{footerLabel}</p>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onDownload(); }} 
          className="w-12 h-12 rounded-2xl bg-zinc-50 hover:bg-indigo-600 text-zinc-400 hover:text-white transition-all duration-500 flex items-center justify-center group/btn shadow-sm"
        >
          <Download className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
        </button>
      </div>
    </motion.div>
  );
}

function LoadingCard({ label, loading, activeStep }: { label: string, loading: boolean, activeStep?: number, key?: string }) {
  // Use a fixed aspect ratio for UI stability
  const containerAspect = 'aspect-[4/5]';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className={`relative w-full bg-white rounded-[40px] border-4 border-dashed border-zinc-100 flex flex-col items-center justify-center overflow-hidden transition-all duration-1000 ${containerAspect}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-50/50 to-transparent pointer-events-none" />
      {loading ? (
        <div className="flex flex-col items-center gap-8 relative z-10 w-full px-12">
          <div className="relative">
            <div className="w-24 h-24 border-2 border-zinc-100 rounded-full" />
            <motion.div 
               animate={{ 
                 rotate: 360,
                 scale: [1, 1.1, 1],
                 borderColor: ["#4f46e5", "#818cf8", "#4f46e5"]
               }}
               transition={{ 
                 rotate: { duration: 3, repeat: Infinity, ease: "linear" },
                 scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                 borderColor: { duration: 4, repeat: Infinity }
               }}
               className="absolute inset-0 w-24 h-24 border-4 border-t-transparent border-r-transparent border-l-indigo-600 border-b-transparent rounded-full"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              {activeStep === 1 ? (
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.9, 1.1, 0.9] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Search className="w-8 h-8 text-indigo-600" />
                </motion.div>
              ) : (
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                >
                  <Zap className="w-8 h-8 text-indigo-600 fill-current" />
                </motion.div>
              )}
            </div>
            
            {/* Ambient Pulse */}
            <motion.div 
              animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0, 0.1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-indigo-600 rounded-full"
            />
          </div>

          <div className="text-center space-y-4 w-full">
            <div className="flex flex-col gap-1">
              <p className="text-[14px] font-black text-zinc-900 tracking-[0.3em] uppercase">{label}</p>
              <p className="text-[9px] text-zinc-400 font-bold tracking-widest uppercase">
                {activeStep === 1 ? "正在映射特征坐标" : "正在合成光影特征"}
              </p>
            </div>
            
            {/* Minimal Progress Bar */}
            <div className="h-[2px] w-full bg-zinc-100 rounded-full overflow-hidden">
               <motion.div 
                 animate={{ x: ["-100%", "200%"] }} 
                 transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                 className="h-full w-1/3 bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.5)]"
               />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 opacity-10">
           <div className="w-20 h-20 bg-zinc-50 rounded-[32px] flex items-center justify-center">
             <RefreshCcw className="w-8 h-8 text-zinc-400" />
           </div>
           <p className="text-[10px] font-black tracking-[0.4em] text-black uppercase">{label}</p>
        </div>
      )}
    </motion.div>
  );
}

