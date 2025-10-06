// app/api/suggestions/route.ts
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

const CANNED: Record<string, Record<string, string[]>> = {
  en: {
    general: [
      "Map your top-3 export-ready SKUs with gross margin and MOQ",
      "Draft a 90-day domestic sell-in playbook",
      "Find 10 target distributors with fit score"
    ],
    wine: [
      "UK off-trade: pricing ladder vs. competitors",
      "Build a 3-tier distributor pitch (buyers, tech, finance)",
      "List building: 25 HoReCa importers to approach"
    ],
    food: [
      "Premium deli channels: margin math & promos",
      "Compliance checklist for DE/FR/UK labeling",
      "Inbound logistics: INCOTERMS & lead times"
    ]
  },
  it: {
    general: [
      "Mappa i 3 SKU più pronti all’export con margine e MOQ",
      "Piano di sell-in domestico in 90 giorni",
      "Trova 10 distributori target con punteggio di fit"
    ],
    wine: [
      "Off-trade UK: scala prezzi vs competitor",
      "Pitch a 3 livelli (buyer, tecnico, finance)",
      "Lista: 25 importatori HoReCa da contattare"
    ],
    food: [
      "Canali gourmet: margini e promo",
      "Checklist etichettatura per DE/FR/UK",
      "Logistica inbound: INCOTERMS e lead time"
    ]
  }
};

// CORS preflight
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
  const lang = (searchParams.get("lang") || "en").toLowerCase();
  const sector = (searchParams.get("sector") || "general").toLowerCase();

  const bank = CANNED[lang] || CANNED["en"];
  const list = bank[sector] || bank["general"];

  return new Response(JSON.stringify({ suggestions: list.slice(0, 3) }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": process.env.RUNTIME_ORIGIN || "*"
    }
  });
}

