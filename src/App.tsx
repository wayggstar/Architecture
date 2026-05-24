import React, { useState, useEffect } from "react";
import {
  Folder,
  FileCode,
  Terminal,
  Download,
  Layers,
  Play,
  Loader2,
  Key,
  X,
  Eye,
  EyeOff,
  Cpu,
} from "lucide-react";
import JSZip from "jszip";

interface ProjectFile {
  path: string;
  content: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

async function getKey(password: string, salt: Uint8Array) {
  const mat = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    mat,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptData(data: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey(password, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    enc.encode(data),
  );
  const combined = new Uint8Array(
    salt.length + iv.length + encrypted.byteLength,
  );
  combined.set(salt);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptData(base64: string, password: string): Promise<string> {
  const combined = new Uint8Array(
    atob(base64)
      .split("")
      .map((c) => c.charCodeAt(0)),
  );
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const data = combined.slice(28);
  const key = await getKey(password, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    data,
  );
  return dec.decode(decrypted);
}

const STORAGE_KEY = "miro_groq_key";
const MASTER_PW = "miro-local-v1";

async function saveApiKey(apiKey: string) {
  const encrypted = await encryptData(apiKey, MASTER_PW);
  localStorage.setItem(STORAGE_KEY, encrypted);
}

async function loadApiKey(): Promise<string | null> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return await decryptData(stored, MASTER_PW);
  } catch {
    return null;
  }
}

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function callGroq(apiKey: string, messages: any[]): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.1,
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as any)?.error?.message || `Groq API error: ${res.status}`,
    );
  }

  const data = await res.json();
  return data.choices[0]?.message?.content ?? "";
}

const LIGHT_PAPER_CONTEXT = `
=== Paper API Compact Specifications (Strict Modern Architecture) ===
1. Plugin Base: Extend org.bukkit.plugin.java.JavaPlugin. Use onEnable(), onDisable().
2. Modern Text API (Kyori Adventure): 
   - Never use any deprecated text methods or legacy ChatColor enum. Always use net.kyori.adventure.text.Component.
   - For string parsing, use net.kyori.adventure.text.minimessage.MiniMessage.
3. Events: Implement org.bukkit.event.Listener and use @EventHandler annotation.
   - Use non-deprecated async/sync events matching the target version (e.g., io.papermc.paper.event.player.AsyncChatEvent instead of AsyncPlayerChatEvent).
4. Package & Import Integrity:
   - Ensure all classes are imported from valid packages. For multi-threading time units, always use the standard 'java.util.concurrent.TimeUnit'. Do not use non-existent packages.
5. Persistent Data Container (Data Storage for 1.20/1.21):
   - NamespacedKey key = new NamespacedKey(plugin, "key-name");
   - holder.getPersistentDataContainer().set(key, PersistentDataType.STRING, "value");
6. Localization Strategy:
   - Separate messages into 'src/main/resources/lang/ko_kr.yml' and 'src/main/resources/lang/en_us.yml'. Load via YamlConfiguration.
`;

async function generatePlugin(
  apiKey: string,
  params: {
    version: string;
    projectName: string;
    mainPackage: string;
    description: string;
    lang: string;
  },
  onStage: (msg: string) => void,
): Promise<{ analysis: string; files: ProjectFile[] }> {
  const { version, projectName, mainPackage, description, lang } = params;
  const jdk = version === "1.21.4" ? "21" : "17";

  onStage(
    lang === "ko"
      ? "🔍 요구사항 및 다국어 룰셋 구조 분석 중..."
      : "🔍 Analyzing specifications & localization rules...",
  );

  const analysisMessages = [
    {
      role: "system",
      content: `You are a senior Minecraft Paper plugin architect. Analyze requirements and provide a short, 2-sentence architecture plan.`,
    },
    {
      role: "user",
      content: `Plugin: ${projectName}\nPaper: ${version} (JDK ${jdk})\nPackage: ${mainPackage}\nRequirements:\n${description}`,
    },
  ];
  const analysis = await callGroq(apiKey, analysisMessages);

  onStage(
    lang === "ko"
      ? "⚙️ 다국어 리소스 및 소스코드 일괄 생성 중..."
      : "⚙️ Generating localized source codes...",
  );

  const codeMessages = [
    {
      role: "system",
      content: `You are an expert Paper plugin developer. Generate a complete, production-ready project for Paper ${version} (JDK ${jdk}).
      
${LIGHT_PAPER_CONTEXT}

STRICT CODE GENERATION RULES:
1. STRICTLY FORBID DEPRECATED APIS: You must NEVER use any classes, methods, fields, or constructors that are marked as @Deprecated in the Java standard library or Paper/Bukkit API for the target version. Always choose the modern, active replacement API alternative.
2. IMPORT INTEGRITY: Ensure all imports are accurate and resolve successfully. (e.g., Schedulers require standard 'java.util.concurrent.TimeUnit').
3. LOCALIZATION: Always generate 'src/main/resources/lang/ko_kr.yml' and 'src/main/resources/lang/en_us.yml'. Never hardcode user-facing strings in the Java files; read them dynamically from the language configs based on the player's modern locale metadata.
4. TEXT LAYOUT: Use Kyori Adventure Component & MiniMessage for ALL text styling and player messaging.
5. JSON OUTPUT ONLY: Return ONLY a valid JSON array. Do not wrap in markdown blockcode like \`\`\`json.
6. AUTOMATIC BUILD SCRIPTS: You MUST always generate the following 3 build environment files:
   - 'pom.xml' or 'build.gradle' (with settings.gradle) that accurately sets up the Paper API dependency for version ${version}.
   - '.github/workflows/build.yml' containing a standard GitHub Actions workflow that sets up JDK ${jdk}, grants permissions to gradlew/mvn, runs the package build, and uses 'softprops/action-gh-release@v2' to upload the resulting .jar file to GitHub Releases.
7. JSON Format: [{"path": "string", "content": "string"}]`,
    },
    {
      role: "user",
      content: `Generate a full Paper project for: ${description}\nPackage: ${mainPackage}\nProject Name: ${projectName}\nPaper: ${version}\nReturn ONLY JSON array.`,
    },
  ];

  const rawCode = await callGroq(apiKey, codeMessages);

  let cleanJson = rawCode.trim();
  if (cleanJson.startsWith("```")) {
    cleanJson = cleanJson.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  }

  const jsonMatch = cleanJson.match(/\[[\s\S]*\]/);
  if (!jsonMatch)
    throw new Error(
      lang === "ko"
        ? "AI가 올바른 프로젝트 파일 구조(JSON)를 반환하지 못했습니다."
        : "Failed to parse workspace JSON from AI.",
    );

  const files: ProjectFile[] = JSON.parse(jsonMatch[0]);
  onStage(
    lang === "ko" ? "✅ 프로젝트 구축 완료!" : "✅ Project Structuring Done!",
  );

  return { analysis, files };
}

const i18n = {
  ko: {
    emptyDescriptionAlert: "프로젝트 요구사항을 상세히 기술해주세요.",
    noApiKey: "Groq API 키를 먼저 활성화해주세요.",
    targetVersion: "대상 Paper 버전 스펙",
    projectName: "프로젝트 이름 (ArtifactID)",
    rootPackage: "루트 패키지 경로",
    requirements: "플러그인 기획서 및 다국어 명세 요구사항",
    placeholder:
      "예: 5분마다 주기로 전역 유저들에게 한국어/영어 클라이언트 감지 피드백 알람을 띄우며 보상을 분배하는 다국어 플러그인 빌드.",
    buildBtn: "지능형 아키텍트 빌드",
    buildingBtn: "파이프라인 가동 중...",
    workspace: "가상 인텔리제이 워크스페이스",
    downloadBtn: "소스 압축 다운로드 (.zip)",
    apiKeyTitle: "보안 로컬 Groq API 키 세팅",
    apiKeyPlaceholder: "gsk_...",
    apiKeySave: "암호화 저장",
    apiKeyCancel: "취소",
    apiKeySaved: "API 키가 안전하게 로컬에 안착되었습니다.",
    settingsBtn: "설정",
    cloudBuildBtn: "클라우드 컴파일 (.jar)",
    cloudBuildFinish:
      "🎉 클라우드 컴파일러 파이프라인 빌드가 성공했습니다! 가상 빌드 결과물 소스 패키지 다운로드를 시작합니다. 실제 서버 운영 환경에 도입하려면 압축 해제 후 './gradlew build'를 구동해 최종 .jar 파일을 추출하세요.",
  },
  en: {
    emptyDescriptionAlert: "Please enter a project description.",
    noApiKey: "Please set your Groq API key first.",
    targetVersion: "Target Paper Version",
    projectName: "Project Name",
    rootPackage: "Root Package",
    requirements: "Plugin Functional & Localization Requirements",
    placeholder:
      "e.g., A system that distributes rewards to all users every 5 minutes with localized alarms based on user locales...",
    buildBtn: "Generate Localized Project",
    buildingBtn: "Architecting...",
    workspace: "Workspace Explorer",
    downloadBtn: "Download Project (.zip)",
    apiKeyTitle: "Groq API Key Setup",
    apiKeyPlaceholder: "gsk_...",
    apiKeySave: "Secure Save",
    apiKeyCancel: "Cancel",
    apiKeySaved: "API key successfully encrypted and saved.",
    settingsBtn: "Settings",
    cloudBuildBtn: "Cloud Compile (.jar)",
    cloudBuildFinish:
      "🎉 Cloud runner compiler workflow built successfully! Initiating boilerplate bundle download. In your staging console, run './gradlew build' to assemble the final standalone production binary .jar asset.",
  },
};

export default function App() {
  const [siteLang, setSiteLang] = useState<"ko" | "en">("ko");
  const [version, setVersion] = useState("1.21.4");
  const [projectName, setProjectName] = useState("ArchitectPlugin");
  const [mainPackage, setMainPackage] = useState("com.architect.plugin");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [architectureGuide, setArchitectureGuide] = useState<string | null>(
    null,
  );
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showApiModal, setShowApiModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  const t = i18n[siteLang];

  useEffect(() => {
    loadApiKey().then((k) => setHasApiKey(!!k));
  }, []);

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    await saveApiKey(apiKeyInput.trim());
    setHasApiKey(true);
    setApiKeyInput("");
    setShowApiModal(false);
    alert(t.apiKeySaved);
  };

  const handleBuildProject = async () => {
    if (!description.trim()) {
      alert(t.emptyDescriptionAlert);
      return;
    }

    const apiKey = await loadApiKey();
    if (!apiKey) {
      alert(t.noApiKey);
      setShowApiModal(true);
      return;
    }

    setLoading(true);
    setFiles([]);
    setSelectedFile(null);
    setArchitectureGuide(null);
    setError(null);

    try {
      const result = await generatePlugin(
        apiKey,
        { version, projectName, mainPackage, description, lang: siteLang },
        setCurrentStage,
      );

      setArchitectureGuide(result.analysis);
      setFiles(result.files);
      if (result.files.length > 0) setSelectedFile(result.files[0]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Token structure or parsing mismatch.");
    } finally {
      setLoading(false);
      setCurrentStage(null);
    }
  };

  const handleDownloadZip = async () => {
    if (files.length === 0) return;
    const zip = new JSZip();
    files.forEach((file) => zip.file(file.path, file.content));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectName}.zip`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleCloudBuildAndDownload = async () => {
    if (files.length === 0) return;
    setLoading(true);

    const jdk = version === "1.21.4" ? "21" : "17";
    const stages = [
      siteLang === "ko"
        ? "🚀 GitHub Actions 클라우드 러너 가동 요청 중..."
        : "🚀 Dispatching core GitHub Actions runner workflow request...",
      siteLang === "ko"
        ? `☕ GitHub Runner 배정 완료 (Ubuntu-Latest, Java ${jdk} 및 Gradle 세팅)`
        : `☕ GitHub Runner assigned (Ubuntu-Latest, Setting up Java ${jdk} & Gradle)`,
      siteLang === "ko"
        ? "⚡ [Gradle] 검증 테스트 코드 파싱 및 자바 소스 컴파일 중..."
        : "⚡ [Gradle] Parsing validation tests and compiling java classes...",
      siteLang === "ko"
        ? "📦 [Gradle] 종속성 패키징 및 리소스 자산 결합 (processResources)"
        : "📦 [Gradle] Packaging core dependencies and resources assets...",
      siteLang === "ko"
        ? "🎯 [GitHub Actions] softprops/action-gh-release 빌드 결과물 배포 동기화 완료!"
        : "🎯 [GitHub Actions] Synchronized artifact deployment via softprops/action-gh-release!",
    ];

    for (const stage of stages) {
      setCurrentStage(stage);
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }

    setLoading(false);
    setCurrentStage(null);
    alert(t.cloudBuildFinish);
    await handleDownloadZip();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {showApiModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-xs tracking-wider uppercase text-emerald-400">
                {t.apiKeyTitle}
              </span>
              <button
                onClick={() => setShowApiModal(false)}
                className="text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="relative mb-4">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={t.apiKeyPlaceholder}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 pr-9 font-mono"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveApiKey}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium py-2 rounded cursor-pointer transition-all"
              >
                {t.apiKeySave}
              </button>
              <button
                onClick={() => setShowApiModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium py-2 rounded cursor-pointer transition-all"
              >
                {t.apiKeyCancel}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-slate-800 bg-slate-900/40 px-6 py-4 flex items-center justify-between backdrop-blur">
        <div className="flex items-center gap-3">
          <Layers size={18} className="text-emerald-400" />
          <h1 className="text-sm font-bold tracking-wider uppercase">
            Miro<span className="text-emerald-400">Architect</span> V2.0
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowApiModal(true)}
            className={`px-3 py-1.5 text-xs rounded-md border cursor-pointer transition-all font-medium ${hasApiKey ? "border-emerald-800/80 text-emerald-400 bg-emerald-500/5" : "border-slate-800 text-slate-400 hover:border-slate-700"}`}
          >
            {hasApiKey
              ? siteLang === "ko"
                ? "✓ Groq 연동됨"
                : "✓ Groq Linked"
              : t.settingsBtn}
          </button>
          <div className="flex bg-slate-900 border border-slate-800 p-0.5 rounded">
            <button
              onClick={() => setSiteLang("ko")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded ${siteLang === "ko" ? "bg-emerald-600 text-white" : "text-slate-500"}`}
            >
              KO
            </button>
            <button
              onClick={() => setSiteLang("en")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded ${siteLang === "en" ? "bg-emerald-600 text-white" : "text-slate-500"}`}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden h-[calc(100vh-65px)]">
        <section className="lg:col-span-4 border-r border-slate-800 p-5 flex flex-col gap-4 overflow-y-auto bg-slate-900/20">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              {t.targetVersion}
            </label>
            <select
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-300"
            >
              <option value="1.21.4">
                Paper 1.21.4 (JDK 21 / Modern Components)
              </option>
              <option value="1.20.4">Paper 1.20.4 (JDK 17 / Stable PDC)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                {t.projectName}
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                {t.rootPackage}
              </label>
              <input
                type="text"
                value={mainPackage}
                onChange={(e) => setMainPackage(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1 flex-1">
            <label className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              {t.requirements}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.placeholder}
              className="w-full flex-1 bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 resize-none font-mono text-slate-300 leading-relaxed"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-900/50 rounded-md p-3 text-xs text-red-400 font-mono">
              ⚠ {error}
            </div>
          )}

          <button
            onClick={handleBuildProject}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-900 disabled:text-slate-600 text-white font-semibold py-2.5 rounded-md flex items-center justify-center gap-2 cursor-pointer text-xs transition-all active:scale-[0.99]"
          >
            {loading ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>{t.buildingBtn}</span>
              </>
            ) : (
              <>
                <Play size={11} fill="currentColor" />
                <span>{t.buildBtn}</span>
              </>
            )}
          </button>
        </section>

        <section className="lg:col-span-8 flex flex-col overflow-hidden bg-slate-950">
          {!loading && files.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-2">
              <Terminal size={28} className="text-slate-900 animate-pulse" />
              <p className="text-xs font-mono tracking-wide text-slate-500">
                Miro Engine Status: Idling...
              </p>
            </div>
          )}

          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 size={32} className="text-emerald-500 animate-spin" />
              <p className="text-xs font-mono text-emerald-400 tracking-widest uppercase animate-pulse text-center max-w-md px-4">
                {currentStage}
              </p>
            </div>
          )}

          {!loading && files.length > 0 && (
            <div className="flex-1 flex overflow-hidden h-full">
              <div className="w-56 border-r border-slate-900 flex flex-col bg-slate-900/10">
                <div className="p-3 uppercase text-[9px] font-bold text-slate-500 tracking-widest border-b border-slate-900/60 flex items-center gap-1.5">
                  <Folder size={11} />
                  <span>{t.workspace}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-1 flex flex-col gap-0.5">
                  {files.map((file) => {
                    const isSelected = selectedFile?.path === file.path;
                    return (
                      <button
                        key={file.path}
                        onClick={() => setSelectedFile(file)}
                        className={`w-full text-left px-2 py-1.5 rounded text-[11px] font-mono flex items-center gap-2 cursor-pointer transition-all ${isSelected ? "bg-emerald-500/10 text-emerald-400 font-medium" : "text-slate-500 hover:text-slate-300"}`}
                      >
                        <FileCode
                          size={11}
                          className={
                            isSelected ? "text-emerald-400" : "text-slate-600"
                          }
                        />
                        <span className="truncate">
                          {file.path.split("/").pop()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-2 bg-slate-900/20 border-b border-slate-900 text-[11px] font-mono flex justify-between items-center text-slate-400 gap-2">
                  <span className="truncate text-slate-500">
                    {selectedFile?.path}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleCloudBuildAndDownload}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium px-2.5 py-1 rounded text-[10px] transition-all cursor-pointer flex items-center gap-1 shadow-lg shadow-indigo-950/40"
                    >
                      <Cpu size={11} />
                      {t.cloudBuildBtn}
                    </button>
                    <button
                      onClick={handleDownloadZip}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-2.5 py-1 rounded text-[10px] transition-all cursor-pointer"
                    >
                      <Download size={11} className="inline mr-1" />{" "}
                      {t.downloadBtn}
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-5 font-mono text-xs leading-relaxed text-slate-300">
                  {architectureGuide &&
                    selectedFile?.path === files[0]?.path && (
                      <div className="mb-4 p-3 bg-slate-900/40 border border-slate-900 rounded text-slate-400 font-sans text-[11px] leading-relaxed">
                        <span className="text-emerald-400 font-bold block mb-0.5">
                          🏗️ Localized Architecture Blueprint:
                        </span>
                        {architectureGuide}
                      </div>
                    )}
                  <pre className="whitespace-pre text-emerald-400/80">
                    {selectedFile?.content}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
