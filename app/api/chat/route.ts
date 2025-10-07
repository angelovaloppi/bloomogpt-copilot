// @ts-nocheck
// app/api/chat/route.ts
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import OpenAI from "openai";
import { supaAdmin } from "../../lib/supa";
import { corsHeaders } from "../../lib/cors";

// Optional env override (Vercel → Project Settings → Env)
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-turbo";

export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin") || "")
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin") || "";
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "missing_openai_key" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
      });
    }

    const body = await req.json();
    const {
      lang = "en",
      sector = "general",
      prompt = "",
      history = [],
      lead,                 // { name, email, sector }
      conversationId,       // optional string
      model = "auto"        // "turbo" | "mini" | "auto"
    } = body || {};

    const email = lead?.email;
    if (!email) {
      return new Response(JSON.stringify({ error: "missing_email" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
      });
    }

    // Decide which model to use
    const pickModel = () => {
      if (model === "turbo") return "gpt-4.1-turbo";
      if (model === "mini") return "gpt-4.1-mini";
      // auto: returning users / existing conversation => turbo; otherwise mini
      if (conversationId || (lead?.sector && lead?.sector.length > 0)) return "gpt-4.1-turbo";
      return "gpt-4.1-mini";
    };
    const chosenModel = model === "auto" ? pickModel() : (model === "mini" ? "gpt-4.1-mini" : "gpt-4.1-turbo");
    const finalModel = DEFAULT_MODEL || chosenModel;

    // 1) Ensure a conversation exists (or create one)
    let convoId = conversationId || null;
    if (!convoId) {
      const ins = await supaAdmin
        .from("conversations")
        .insert({ email, title: `Chat with ${lead?.name || email}`, sector: lead?.sector || sector })
        .select("id")
        .single();
      if (ins.error) throw ins.error;
      convoId = ins.data.id as string;

      // optional analytics
      await supaAdmin
        .from("analytics_events")
        .insert({ email, kind: "conversation_created", sector, conversation_id: convoId, meta: { lang, model: finalModel } })
        .catch(() => {});
    }

    // 2) Persist the user message
    await supaAdmin
      .from("messages")
      .insert({ conversation_id: convoId, role: "user", content: String(prompt) })
      .catch(() => {});
    await supaAdmin
      .from("analytics_events")
      .insert({ email, kind: "message_user", sector, conversation_id: convoId, meta: { lang, len: String(prompt).length } })
      .catch(() => {});

    // 3) Build system + past messages (last 20)
    const sys =
`You are BloomoGPT — a senior business intelligence & market expansion copilot.
Audience: entrepreneurs, operators, and exporters seeking actionable insights.
Language: Reply in ${String(lang).toUpperCase()} unless the user clearly switches language.
Sector: ${lead?.sector || sector}.
Operating principles:
- Be specific, data-driven, and ROI-oriented like a management consultant.
- Output structure: 2-sentence executive summary, then EXACTLY 3 actionable next steps.
- When region/country is mentioned, include market trends, key players, costs, and practical channels.
- Surface 1 critical missing input to proceed (if any).
- Prefer tables/checklists when useful. Avoid fluff.`;

    const pastRes = await supaAdmin
      .from("messages")
      .select("role,content,created_at")
      .eq("conversation_id", convoId)
      .order("created_at", { ascending: false })
      .limit(20);

    const past = (pastRes.data || []).reverse().map((m: any) => ({
      role: m.role,
      content: m.content
    }));

    const mergedHistory = Array.isArray(history) ? history : [];
    const messages = [
      { role: "system", content: sys },
      ...past,
      ...mergedHistory,
      { role: "user", content: String(prompt) }
    ];

    // 4) OpenAI streaming
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const completion = await client.chat.completions.create({
      model: finalModel,
      temperature: 0.3,
      messages,
      stream: true
    });

    const encoder = new TextEncoder();
    let full = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of completion) {
            const delta = part.choices?.[0]?.delta?.content || "";
            if (delta) {
              full += delta;
              controller.enqueue(encoder.encode(delta));
            }
          }
          // After stream finishes, persist assistant reply & analytics
          try {
            await supaAdmin.from("messages").insert({
              conversation_id: convoId, role: "assistant", content: full
            });
            await supaAdmin.from("conversations")
              .update({ last_active: new Date().toISOString() })
              .eq("id", convoId);
            await supaAdmin.from("analytics_events").insert({
              email, kind: "message_assistant", sector, conversation_id: convoId, meta: { lang, len: full.length, model: finalModel }
            });
          } catch {}
        } finally {
          controller.close();
        }
      }
    });

    // 5) return stream + conversation id (frontend stores it)
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "x-conversation-id": String(convoId),
        ...corsHeaders(origin)
      }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
    });
  }
}
