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
    // Châu Âu (tiếp)
  "Poland": { lat: 51.92, lng: 19.15 },
  "Italy": { lat: 41.87, lng: 12.57 },
  "Spain": { lat: 40.46, lng: -3.75 },
  "Netherlands": { lat: 52.13, lng: 5.29 },
  "Belgium": { lat: 50.50, lng: 4.47 },
  "Sweden": { lat: 60.13, lng: 18.64 },
  "Norway": { lat: 60.47, lng: 8.47 },
  "Finland": { lat: 61.92, lng: 25.75 },
  "Denmark": { lat: 56.26, lng: 9.50 },
  "Switzerland": { lat: 46.82, lng: 8.23 },
  "Austria": { lat: 47.52, lng: 14.55 },
  "Greece": { lat: 39.07, lng: 21.82 },
  "Portugal": { lat: 39.40, lng: -8.22 },
  "Ireland": { lat: 53.14, lng: -7.69 },
  "Czech Republic": { lat: 49.82, lng: 15.47 },
  "Hungary": { lat: 47.16, lng: 19.50 },
  "Romania": { lat: 45.94, lng: 24.97 },
  "Bulgaria": { lat: 42.73, lng: 25.49 },
  "Serbia": { lat: 44.02, lng: 21.01 },
  "Croatia": { lat: 45.10, lng: 15.20 },
  "Bosnia and Herzegovina": { lat: 44.00, lng: 17.68 },
  "Albania": { lat: 41.15, lng: 20.17 },
  "Kosovo": { lat: 42.60, lng: 20.90 },
  
  // Châu Á (tiếp)
  "Vietnam": { lat: 14.05, lng: 108.27 },
  "Thailand": { lat: 15.87, lng: 100.99 },
  "Malaysia": { lat: 4.21, lng: 101.98 },
  "Singapore": { lat: 1.35, lng: 103.82 },
  "Cambodia": { lat: 12.57, lng: 104.99 },
  "Laos": { lat: 19.86, lng: 102.50 },
  "Bangladesh": { lat: 23.68, lng: 90.36 },
  "Sri Lanka": { lat: 7.87, lng: 80.77 },
  "Nepal": { lat: 28.39, lng: 84.12 },
  "Mongolia": { lat: 46.86, lng: 103.82 },
  "Kazakhstan": { lat: 48.02, lng: 66.92 },
  "Uzbekistan": { lat: 41.38, lng: 64.59 },
  "Turkmenistan": { lat: 38.97, lng: 59.56 },
  "Tajikistan": { lat: 38.86, lng: 71.28 },
  "Kyrgyzstan": { lat: 41.20, lng: 74.77 },
  "Georgia": { lat: 42.31, lng: 43.36 },
  "Armenia": { lat: 40.07, lng: 45.04 },
  "Azerbaijan": { lat: 40.14, lng: 47.58 },
  
  // Trung Đông (tiếp)
  "United Arab Emirates": { lat: 23.42, lng: 53.85 },
  "Qatar": { lat: 25.35, lng: 51.18 },
  "Kuwait": { lat: 29.31, lng: 47.48 },
  "Oman": { lat: 21.51, lng: 55.92 },
  "Bahrain": { lat: 26.07, lng: 50.56 },
  
  // Châu Phi (tiếp)
  "South Africa": { lat: -30.56, lng: 22.94 },
  "Kenya": { lat: -0.02, lng: 37.91 },
  "Morocco": { lat: 31.79, lng: -7.09 },
  "Algeria": { lat: 28.03, lng: 1.66 },
  "Tunisia": { lat: 33.89, lng: 9.54 },
  "Uganda": { lat: 1.37, lng: 32.29 },
  "Tanzania": { lat: -6.37, lng: 34.89 },
  "Mozambique": { lat: -18.67, lng: 35.53 },
  "Angola": { lat: -11.20, lng: 17.87 },
  "Ghana": { lat: 7.95, lng: -1.02 },
  "Ivory Coast": { lat: 7.54, lng: -5.55 },
  "Senegal": { lat: 14.50, lng: -14.45 },
  "Cameroon": { lat: 7.37, lng: 12.35 },
  "Zimbabwe": { lat: -19.02, lng: 29.15 },
  "Zambia": { lat: -13.13, lng: 27.85 },
  "Rwanda": { lat: -1.94, lng: 29.87 },
  "South Sudan": { lat: 6.88, lng: 29.70 },
  "Chad": { lat: 15.45, lng: 18.73 },
  "Niger": { lat: 17.60, lng: 8.08 },
  "Burkina Faso": { lat: 12.24, lng: -1.56 },
  "Mauritania": { lat: 21.01, lng: -10.94 },
  "Eritrea": { lat: 15.18, lng: 39.78 },
  "Djibouti": { lat: 11.83, lng: 42.59 },
  
  // Châu Mỹ (tiếp)
  "Canada": { lat: 56.13, lng: -106.35 },
  "Argentina": { lat: -38.42, lng: -63.62 },
  "Chile": { lat: -35.67, lng: -71.54 },
  "Peru": { lat: -9.19, lng: -75.02 },
  "Colombia": { lat: 4.57, lng: -74.30 },
  "Bolivia": { lat: -16.29, lng: -63.59 },
  "Ecuador": { lat: -1.83, lng: -78.18 },
  "Paraguay": { lat: -23.44, lng: -58.44 },
  "Uruguay": { lat: -32.52, lng: -55.77 },
  "Guyana": { lat: 4.86, lng: -58.93 },
  "Suriname": { lat: 3.92, lng: -56.03 },
  "Cuba": { lat: 21.52, lng: -77.78 },
  "Dominican Republic": { lat: 18.74, lng: -70.16 },
  "Puerto Rico": { lat: 18.22, lng: -66.59 },
  "Jamaica": { lat: 18.11, lng: -77.30 },
  "Trinidad and Tobago": { lat: 10.69, lng: -61.22 },
  "Honduras": { lat: 15.20, lng: -86.24 },
  "Guatemala": { lat: 15.78, lng: -90.23 },
  "El Salvador": { lat: 13.79, lng: -88.90 },
  "Nicaragua": { lat: 12.87, lng: -85.21 },
  "Costa Rica": { lat: 9.75, lng: -83.75 },
  "Panama": { lat: 8.54, lng: -80.78 },
  
    // Châu Đại Dương
  "Australia": { lat: -25.27, lng: 133.78 },
  "New Zealand": { lat: -40.90, lng: 174.89 },
  "Papua New Guinea": { lat: -6.44, lng: 144.86 },
  "Fiji": { lat: -17.71, lng: 178.07 },
  "Solomon Islands": { lat: -9.65, lng: 160.15 }
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
      maxrecords: "25",
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
      if (seen.has(e.sourceUrl ?? "")) return false;
      seen.add(e.sourceUrl ?? "");
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
      if (seen.has(e.sourceUrl ?? "")) return false;
      seen.add(e.sourceUrl ?? "");
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
