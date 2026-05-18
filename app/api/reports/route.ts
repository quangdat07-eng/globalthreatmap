import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

async function askGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const res = await fetch(`${GEMINI_API}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    }),
  });

  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topic, type } = body;

    if (!topic) {
      return NextResponse.json({ error: "Research topic is required" }, { status: 400 });
    }

    const typePrompts: Record<string, string> = {
      geopolitical: `Generate a geopolitical intelligence report on: "${topic}".
        Include: regional dynamics, diplomatic relations, power struggles, alliances, and future outlook.`,
      economic: `Generate an economic intelligence report on: "${topic}".
        Include: trade relationships, sanctions impact, economic vulnerabilities, commodity dependencies, financial risks.`,
      security: `Generate a security threat assessment on: "${topic}".
        Include: military capabilities, threat actors, operational patterns, vulnerabilities, risk assessment.`,
      humanitarian: `Generate a humanitarian situation report on: "${topic}".
        Include: civilian impact, displacement figures, aid access, key actors, urgent needs.`,
      default: `Generate a comprehensive intelligence report on: "${topic}".
        Include: background, current situation, key actors, recent developments, risk assessment, and outlook.`,
    };

    const prompt = `${typePrompts[type] || typePrompts.default}
    
    Structure the report with clear sections. Be factual, analytical, and neutral.
    Maximum 600 words.`;

    const summary = await askGemini(prompt);

    return NextResponse.json({
      report: {
        id: `report_${Date.now()}`,
        topic,
        type: type || "general",
        summary,
        sources: ["Gemini AI Analysis"],
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
