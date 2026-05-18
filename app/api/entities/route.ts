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
      generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
    }),
  });

  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function detectEntityType(name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase();
  if (/country|nation|republic|kingdom|state/.test(text)) return "country";
  if (/military|army|force|corps|brigade|battalion/.test(text)) return "military";
  if (/organization|group|movement|party|coalition/.test(text)) return "organization";
  if (/president|minister|general|leader|commander/.test(text)) return "person";
  return "organization";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  if (!name) {
    return NextResponse.json({ error: "Entity name is required" }, { status: 400 });
  }

  try {
    const description = await askGemini(
      `Provide a concise intelligence profile of "${name}" in the context of global security and geopolitics.
      Include: what/who they are, their role in conflicts or geopolitical events, key activities, areas of operation.
      Maximum 200 words. Be factual and neutral.`
    );

    const profile = {
      id: `entity_${Date.now()}`,
      name,
      type: detectEntityType(name, description),
      description,
      locations: [],
      relatedEntities: [],
      economicData: {},
    };

    return NextResponse.json({ entity: profile });
  } catch (error) {
    console.error("Error researching entity:", error);
    return NextResponse.json({ error: "Failed to research entity" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, includeDeepResearch } = body;

    if (!name) {
      return NextResponse.json({ error: "Entity name is required" }, { status: 400 });
    }

    const description = await askGemini(
      `Provide a concise intelligence profile of "${name}" in the context of global security and geopolitics.
      Include: what/who they are, their role in conflicts or geopolitical events, key activities, areas of operation.
      Maximum 200 words. Be factual and neutral.`
    );

    const profile = {
      id: `entity_${Date.now()}`,
      name,
      type: detectEntityType(name, description),
      description,
      locations: [],
      relatedEntities: [],
      economicData: {},
    };

    let researchSummary = undefined;

    if (includeDeepResearch) {
      researchSummary = await askGemini(
        `Provide a detailed intelligence dossier on "${name}". Include:
        1. Background and history
        2. Current activities and operations
        3. Key personnel or leadership
        4. Geographic presence and areas of influence
        5. Relationships with other entities
        6. Recent developments (2024-2025)
        7. Threat assessment
        Be comprehensive, factual, and neutral. Maximum 800 words.`
      );
      profile.researchSummary = researchSummary;
    }

    return NextResponse.json({ entity: profile });
  } catch (error) {
    console.error("Error researching entity:", error);
    return NextResponse.json({ error: "Failed to research entity" }, { status: 500 });
  }
}
