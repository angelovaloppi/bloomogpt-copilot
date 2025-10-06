// app/api/suggestions/route.ts
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

// Buckets by sector keywords (we'll localize text below)
const BUCKETS = ["general", "wine", "food", "fashion", "tech", "spirits"] as const;
type Bucket = typeof BUCKETS[number];

function pickBucket(sectorRaw: string): Bucket {
  const s = (sectorRaw || "").toLowerCase();
  if (/(wine|winery|vine)/.test(s)) return "wine";
  if (/(food|grocery|deli|snack)/.test(s)) return "food";
  if (/(fashion|apparel|clothing|shoes)/.test(s)) return "fashion";
  if (/(tech|software|saas|it|hardware)/.test(s)) return "tech";
  if (/(spirit|liquor|whisky|vodka|gin|rum)/.test(s)) return "spirits";
  return "general";
}

// Suggestions localized
const SUGG: Record<string, Record<Bucket, string[]>> = {
  en: {
    general: [
      "Export regulations for your products",
      "Build a 25-company prospect list",
      "Competitor price mapping in target markets",
      "Channel strategy & margin model",
      "90-day domestic sell-in plan"
    ],
    wine: [
      "Importer & distributor shortlist (25)",
      "Label rules & duties by market",
      "Pitch deck outline (buyers, tech, finance)",
      "Tasting & sampling plan",
      "UK off-trade pricing ladder"
    ],
    food: [
      "EU/UK labeling checklist",
      "Premium deli / specialty channels mapping",
      "Prospects list (importers/wholesalers)",
      "Incoterms & lead-time plan",
      "Quarterly promo calendar"
    ],
    fashion: [
      "Wholesale vs DTC channel plan",
      "Showroom & agent shortlist",
      "Returns & sizing policy (EU/US)",
      "Retailer outreach sequence",
      "Price ladder vs competitors"
    ],
    tech: [
      "ICP + 25 prospect accounts",
      "Demo script & qualification flow",
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
  },
  it: {
    general: [
      "Norme export per i tuoi prodotti",
      "Crea una lista prospect di 25 aziende",
      "Mappatura prezzi competitor nei mercati target",
      "Strategia canali e modello margini",
      "Piano sell-in domestico 90 giorni"
    ],
    wine: [
      "Shortlist importatori/distributori (25)",
      "Regole etichetta e dazi per mercato",
      "Struttura pitch (buyer, tecnico, finance)",
      "Piano tasting & sampling",
      "Scala prezzi off-trade UK"
    ],
    food: [
      "Checklist etichettatura EU/UK",
      "Mappatura canali gourmet/specialty",
      "Lista prospect (importatori/wholesaler)",
      "Piano Incoterms & lead time",
      "Calendario promo trimestrale"
    ],
    fashion: [
      "Piano canali Wholesale vs DTC",
      "Shortlist showroom & agenti",
      "Policy resi & taglie (EU/US)",
      "Sequenza outreach retailer",
      "Scala prezzi vs competitor"
    ],
    tech: [
      "ICP + 25 account prospect",
      "Script demo & flusso qualificazione",
      "Outline programma partner",
      "Localizzazione: quick wins",
      "Suggerimenti pricing & packaging"
    ],
    spirits: [
      "Mappatura distributori per mercato",
      "Basi excise & etichettatura",
      "Sequenza outreach bartender",
      "Piano degustazioni itineranti",
      "Storyboard posizionamento competitivo"
    ]
  }
};

export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.RUNTIME_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    }
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sectorText = searchParams.get("sector") || searchParams.get("q") || "";
  const lang = (searchParams.get("lang") || "en").toLowerCase();
  const pack = SUGG[lang] || SUGG.en;

  const bucket = pickBucket(sectorText);
  const suggestions = pack[bucket] || pack.general;

  return new Response(JSON.stringify({ suggestions, bucket, lang }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": process.env.RUNTIME_ORIGIN || "*",
      "Vary": "Origin"
    }
  });
}
