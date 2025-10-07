export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { supaAdmin } from "../../../lib/supa";   // up to app/lib/supa.ts
import { corsHeaders } from "../../../lib/cors";  // up to app/lib/cors.ts

export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin") || "")
  });
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ ok: false, error: "missing_email" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(req.headers.get("origin") || "") }
      });
    }

    const { data: leadRow, error } = await supaAdmin
      .from("lead")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, lead: leadRow || null }), {
      headers: { "Content-Type": "application/json", ...corsHeaders(req.headers.get("origin") || "") }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(req.headers.get("origin") || "") }
    });
  }
}
