import { NextResponse } from "next/server";
import { generateEventId } from "@/lib/utils";
import { extractKeywords, extractEntities } from "@/lib/event-classifier";
import type { ThreatEvent } from "@/types";

export const dynamic = "force-dynamic";

// GDELT API - completely free, no API key needed
const GDELT_API = "https://api.gdeltproject.org/api/v2/doc/doc";

const THREAT_QUERIES = [
  "conflict military attack",
  "geopolitical crisis tensions",
  "protest demonstration unrest",
  "natural disaster emergency",
  "earthquake tsunami volcano",
  "terrorism attack security",
  "cyber attack breach hacking",
  "diplomatic crisis sanctions",
  "shipping attack piracy maritime",
  "missile strike airstrike bombing",
  "military deployment mobilization",
  "coup political crisis",
  "nuclear threat missile test",
  "Iran US military strikes",
  "Israel Hamas Gaza",
  "Ukraine Russia frontline",
  "Yemen Houthi Red Sea",
  "Taiwan China military",
  "North Korea missile",
  "South China Sea Philippines",
];

// Country name to coordinates mapping
const COUNTRY_COORDS: Record<string, { lat: number; lng: number }> = {
  "United States": { lat: 37.09, lng: -95.71 },
  "Russia": { lat: 55.75, lng: 37.62 },
  "China": { lat: 35.86, lng: 104.19 },
  "Ukraine": { lat: 48.38, lng: 31.17 },
  "Israel": { lat: 31.05, lng: 34.85 },
  "Iran": { lat: 32.43, lng: 53.69 },
  "Gaza": { lat: 31.35, lng: 34.31 },
  "Palestine": { lat: 31.95, lng: 35.23 },
  "Yemen": { lat: 15.55, lng: 48.52 },
  "Syria": { lat: 34.80, lng: 38.99 },
  "Iraq": { lat: 33.22, lng: 43.68 },
  "Afghanistan": { lat: 33.93, lng: 67.71 },
  "Pakistan": { lat: 30.37, lng: 69.34 },
  "India": { lat: 20.59, lng: 78.96 },
  "North Korea": { lat: 40.34, lng: 127.51 },
  "South Korea": { lat: 35.90, lng: 127.77 },
  "Taiwan": { lat: 23.69, lng: 120.96 },
  "Myanmar": { lat: 21.91, lng: 95.96 },
  "Sudan": { lat: 12.86, lng: 30.22 },
  "Ethiopia": { lat: 9.14, lng: 40.49 },
  "Somalia": { lat: 5.15, lng: 46.20 },
  "Libya": { lat: 26.33, lng: 17.23 },
  "Mali": { lat: 17.57, lng: -3.99 },
  "Nigeria": { lat: 9.08, lng: 8.67 },
  "Congo": { lat: -4.03, lng: 21.75 },
  "Venezuela": { lat: 6.42, lng: -66.58 },
  "Mexico": { lat: 23.63, lng: -102.55 },
  "Haiti": { lat: 18.97, lng: -72.29 },
  "Turkey": { lat: 38.96, lng: 35.24 },
  "Saudi Arabia": { lat: 23.88, lng: 45.08 },
  "Lebanon": { lat: 33.85, lng: 35.86 },
  "Jordan": { lat: 30.59, lng: 36.24 },
  "Egypt": { lat: 26.82, lng: 30.80 },
  "France": { lat: 46.23, lng: 2.21 },
  "Germany": { lat: 51.17, lng: 10.45 },
  "United Kingdom": { lat: 55.38, lng: -3.44 },
  "Brazil": { lat: -14.24, lng: -51.93 },
  "Philippines": { lat: 12.88, lng: 121.77 },
  "Indonesia": { lat: -0.79, lng: 113.92 },
  "Japan": { lat: 36.20, lng: 138.25 },
};

function classifyThreatLevel(title: string, content: string): ThreatEvent["threatLevel"] {
  const text = `${title} ${content}`.toLowerCase();
  if (/nuclear|chemical weapon|mass casualty|genocide|world war|ballistic missile/.test(text)) return "critical";
  if (/airstrike|missile strike|bombing|military offensive|coup|terror attack|explosion/.test(text)) return "critical";
  if (/military clash|armed conflict|shooting|killed|deaths|casualties|invasion/.test(text)) return "high";
  if (/protest|sanction|tension|dispute|crisis|cyber attack|threat/.test(text)) return "medium";
  if (/diplomatic|negotiation|summit|agreement|deal/.test(text)) return "low";
  return "info";
}

function classifyCategory(title: string, content: string): ThreatEvent["category"] {
  const text = `${title} ${content}`.toLowerCase();
  if (/military|airstrike|missile|bomb|troops|army|navy|war/.test(text)) return "conflict";
  if (/terror|attack|isis|al-qaeda|jihadist/.test(text)) return "terrorism";
  if (/protest|demonstration|riot|unrest|uprising/.test(text)) return "protest";
  if (/earthquake|flood|hurricane|typhoon|volcano|tsunami|wildfire|disaster/.test(text)) return "disaster";
  if (/diplomat|sanction|summit|treaty|negotiation/.test(text)) return "diplomatic";
  if (/economy|trade|inflation|recession|market/.test(text)) return "economic";
  if (/cyber|hack|breach|ransomware|malware/.test(text)) return "cyber";
  if (/ship|maritime|piracy|naval|coast guard/.test(text)) return "piracy";
  if (/health|disease|pandemic|outbreak|virus/.test(text)) return "health";
  if (/nuclear|radiation|chemical|biological/.test(text)) return "conflict";
  return "conflict";
}

function extractCountryFromText(text: string): { country: string; lat: number; lng: number } | null {
  for (const [country, coords] of Object.entries(COUNTRY_COORDS)) {
    if (text.includes(country)) {
      return { country, ...coords };
    }
  }
  return null;
}

async function fetchGDELTEvents(query: string): Promise<ThreatEvent[]> {
  try {
    const params = new URLSearchParams({
      query: query,
      mode: "artlist",
      maxrecords: "10",
      format: "json",
      timespan: "3d",
      sort: "datedesc",
    });

    const res = await fetch(`${GDELT_API}?${params}`, {
      next: { revalidate: 900 }, // cache 15 minutes
    });

    if (!res.ok) return [];

    const data = await res.json();
    const articles = data.articles || [];

    const events: ThreatEvent[] = [];

    for (const article of articles) {
      const title = article.title || "";
      const content = article.seendate || "";
      const url = article.url || "";
      const source = article.domain || "gdelt";

      if (!title || title.length < 10) continue;

      // Try to find location from title + url
      const fullText = `${title} ${url}`;
      const location = extractCountryFromText(fullText);
      if (!location) continue;

      const event: ThreatEvent = {
        id: generateEventId(),
        title,
        summary: title,
        category: classifyCategory(title, ""),
        threatLevel: classifyThreatLevel(title, ""),
        location: {
          latitude: location.lat,
          longitude: location.lng,
          country: location.country,
          placeName: location.country,
        },
        timestamp: new Date().toISOString(),
        source,
        sourceUrl: url,
        entities: extractEntities(title),
        keywords: extractKeywords(title),
        rawContent: title,
      };

      events.push(event);
    }

    return events;
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  try {
    const queries = query ? [query] : THREAT_QUERIES.slice(0, 15);

    // Fetch from GDELT in parallel (batches of 5 to avoid rate limit)
    const batches = [];
    for (let i = 0; i < queries.length; i += 5) {
      batches.push(queries.slice(i, i + 5));
    }

    const allEvents: ThreatEvent[] = [];
    for (const batch of batches) {
      const results = await Promise.all(batch.map(fetchGDELTEvents));
      allEvents.push(...results.flat());
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const unique = allEvents.filter((e) => {
      if (seen.has(e.sourceUrl)) return false;
      seen.add(e.sourceUrl);
      return true;
    });

    // Sort by threat level
    const priority: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    unique.sort((a, b) => (priority[a.threatLevel] ?? 5) - (priority[b.threatLevel] ?? 5));

    return NextResponse.json({
      events: unique,
      count: unique.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { queries } = body;
    const searchQueries = queries?.length ? queries.slice(0, 10) : THREAT_QUERIES.slice(0, 10);

    const results = await Promise.all(searchQueries.map(fetchGDELTEvents));
    const allEvents = results.flat();

    const seen = new Set<string>();
    const unique = allEvents.filter((e) => {
      if (seen.has(e.sourceUrl)) return false;
      seen.add(e.sourceUrl);
      return true;
    });

    const priority: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    unique.sort((a, b) => (priority[a.threatLevel] ?? 5) - (priority[b.threatLevel] ?? 5));

    return NextResponse.json({ events: unique, count: unique.length, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}
