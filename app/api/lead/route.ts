// app/api/lead/route.ts
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

// NOTE: MVP storage = logs. Later we'll plug Supabase/CRM.
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.RUNTIME_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Lead captured:", body); // view in Vercel logs
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": process.env.RUNTIME_ORIGIN || "*"
      }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": process.env.RUNTIME_ORIGIN || "*"
      }
    });
  }
}
