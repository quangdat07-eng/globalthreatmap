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
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const country = searchParams.get("country");

  if (!country) {
    return NextResponse.json({ error: "Country parameter is required" }, { status: 400 });
  }

  try {
    const [pastAnswer, currentAnswer] = await Promise.all([
      askGemini(
        `Provide a concise summary of major historical conflicts involving ${country} from the 20th century to 2020. 
        Include: conflict names, dates, brief description, outcome. 
        Format as a clear paragraph. Maximum 300 words. Be factual and neutral.`
      ),
      askGemini(
        `Provide a concise summary of current conflicts, tensions, and security situations involving ${country} as of 2024-2025.
        Include: ongoing conflicts, geopolitical tensions, recent military activities, diplomatic disputes.
        Format as a clear paragraph. Maximum 300 words. Be factual and neutral.`
      ),
    ]);

    return NextResponse.json({
      country,
      past: {
        conflicts: pastAnswer,
        sources: ["Gemini AI Analysis"],
      },
      current: {
        conflicts: currentAnswer,
        sources: ["Gemini AI Analysis"],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching country conflicts:", error);
    return NextResponse.json({ error: "Failed to fetch country conflicts" }, { status: 500 });
  }
}
