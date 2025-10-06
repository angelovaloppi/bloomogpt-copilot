// app/api/suggestions/route.ts
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

// Keyword buckets (rough, expandable); fall back to "general"
const BANK = {
  general: [
    "Map top-3 export-ready SKUs with margin & MOQ",
    "Draft a 90-day domestic sell-in plan",
    "Build a first 25-company prospect list",
    "Define buyer personas & outreach script",
    "Compliance checklist for target markets",
    "Unit economics & pricing ladder vs competitors"
  ],
  wine: [
    "UK off-trade pricing ladder vs competitors",
    "3-tier distributor pitch (buyers, tech, finance)",
    "List 25 HoReCa importers to approach",
    "Labeling & duty basics for UK/US/EU",
    "Sampling plan + intro mail template"
  ],
  food: [
    "Premium deli channels: margin math & promos",
    "EU/UK labeling checklist",
    "Importer prospects short-list (25)",
    "Incoterms & lead times plan",
    "Trade show prep: targets + script"
  ],
  fashion: [
    "Wholesale vs DTC: channel plan (90 days)",
    "Showroom & agent shortlist",
    "Sizing/returns policy for EU/US",
    "Retailer prospecting email sequence",
    "Export duties quick estimator"
  ],
  tech: [
    "ICP definition + prospect list (SaaS/VARs)",
    "Demo script & qualification checklist",
    "Partner program outline",
    "Localization quick wins",
    "Pricing & packaging suggestions"
  ],
  spirits: [
    "Distributor mapping by market",
    "Excise & label basics",
    "Bartender outreach sequence",
    "Tasting roadshow plan",
    "Competitive positioning storyboard"
  ]
};

function pickBucket(sectorRaw: string) {
  const s = (sectorRaw || "").toLowerCase();
  if (/(wine|winery|vine)/.test(s)) return "wine";
  if (/(food|grocery|deli|snack)/.test(s)) return "food";
  if (/(fashion|apparel|clothing|shoes)/.test(s)) return "fashion";
  if (/(tech|software|saas|it|hardware)/.test(s)) return "tech";
  if (/(spirit|liquor|whisky|vodka|gin|rum)/.test(s)) return "spirits";
  return "general";
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.RUNTIME_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sectorFree = searchParams.get("sector") || "";
  const bucket = pickBucket(sectorFree);
  const list = BANK[bucket] || BANK.general;
  return new Response(JSON.stringify({ suggestions: list.slice(0, 5), bucket }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": process.env.RUNTIME_ORIGIN || "*"
    }
  });
}
