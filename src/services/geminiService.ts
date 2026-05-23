import { GoogleGenAI, Type } from "@google/genai";

export interface LogAnalysisResponse {
  cause: string;
  solution: string;
  severity: 'Critical' | 'Warning' | 'Info';
  summary: string;
}

export async function analyzeLogWithGemini(
  logContent: string, 
  apiKey: string, 
  modelName: string = "gemini-3-flash-preview"
): Promise<LogAnalysisResponse> {
  if (!apiKey) {
    throw new Error("API Key is required. Please set it in the settings.");
  }

  const genAI = new GoogleGenAI({ apiKey });
  
  // Limit input size for efficiency and cost
  const truncatedLog = logContent.slice(0, 5000);

  const prompt = `
You are a senior backend engineer specializing in debugging distributed systems.

Your task is to analyze logs and identify the most probable root cause.

Strict rules:
- Return ONLY valid JSON.
- Do NOT include explanations outside JSON.
- Be concise but precise.
- If uncertain, reflect it in the confidence implicitly through wording.

Analysis steps you MUST follow internally:
1. Identify error patterns and repeated failures
2. Correlate related log lines
3. Infer the root cause (not just symptoms)
4. Propose actionable fixes (not generic advice)

Output format:
{
  "summary": "Short, high-signal description of the issue",
  "cause": "Most likely root cause with reasoning",
  "solution": "Step-by-step concrete fix (no vague suggestions)",
  "severity": "Critical | Warning | Info"
}

Severity rules:
- Critical: system failure, crash, data loss, blocking issue
- Warning: degraded performance, retry loops, potential failure
- Info: non-critical or expected behavior

Log Content:
${truncatedLog}
`;

  try {
    const response = await genAI.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            cause: { type: Type.STRING },
            solution: { type: Type.STRING },
            severity: { 
              type: Type.STRING,
              enum: ["Critical", "Warning", "Info"]
            },
          },
          required: ["summary", "cause", "solution", "severity"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    return JSON.parse(text) as LogAnalysisResponse;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
}
