export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { supaAdmin } from "../../lib/supa";

function cors(origin?: string) {
  return {
    "Access-Control-Allow-Origin": "*", // keep open while testing
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: cors(req.headers.get("origin") || "") });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json(); // { name, email, sector, sessionId, ts }

    // 1) store the lead
    const { data: leadData, error: leadErr } = await supaAdmin
      .from("lead")
      .insert({
        email: body.email,
        name: body.name,
        sector: body.sector
      })
      .select();

    if (leadErr) {
      // bubble up a clear error
      return new Response(JSON.stringify({ ok: false, step: "insert_lead", error: leadErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...cors(req.headers.get("origin") || "") }
      });
    }

    // 2) optional: log the event
    const { error: evtErr } = await supaAdmin
      .from("events")
      .insert({
        email: body.email,
        type: "lead_created",
        payload: body
      });

    if (evtErr) {
      return new Response(JSON.stringify({ ok: false, step: "insert_event", error: evtErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...cors(req.headers.get("origin") || "") }
      });
    }

    return new Response(JSON.stringify({ ok: true, lead: leadData?.[0] || null }), {
      headers: { "Content-Type": "application/json", ...cors(req.headers.get("origin") || "") }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, step: "exception", error: e?.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors(req.headers.get("origin") || "") }
    });
  }
}
