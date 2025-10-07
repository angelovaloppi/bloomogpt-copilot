// app/api/chat/route.ts
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import OpenAI from "openai";
import { supaAdmin } from "../../lib/supa";
import { corsHeaders } from "../../lib/cors";

export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin") || "")
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin") || "";
  try {
    const body = await req.json();
    const {
      lang = "en",
      sector = "general",
      prompt = "",
      history = [],
      lead,                 // { name, email, sector }
      conversationId        // optional string
    } = body || {};

    const email: string | undefined = lead?.email;
    if (!email) {
      return new Response(JSON.stringify({ error: "missing_email" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
      });
    }

    // 1) ensure a conversation exists (or create one)
    let convoId: string | null = conversationId || null;
    if (!convoId) {
      const ins = await supaAdmin
        .from("conversations")
        .insert({ email, title: `Chat with ${lead?.name || email}` })
        .select("id")
        .single();
      if (ins.error) throw ins.error;
      convoId = ins.data.id as string;

      await supaAdmin
        .from("analytics_events")
        .insert({ email, kind: "conversation_created", sector, conversation_id: convoId, meta: { lang } });
    }

    // 2) persist the user message
    await supaAdmin
      .from("messages")
      .insert({ conversation_id: convoId, role: "user", content: String(prompt) });

    await supaAdmin
      .from("analytics_events")
      .insert({ email, kind: "message_user", sector, conversation_id: convoId, meta: { lang, len: String(prompt).length } });

    // 3) build system + past messages (load last 20)
    const sys =
`You are BloomoGPT Business Copilot.
Audience: companies optimizing domestic operations and export growth.
Language: Reply in ${String(lang).toUpperCase()} unless the user clearly switches language.
Sector: ${lead?.sector || sector}.
Guidelines:
- Start with 2–3 concise sentences, then provide exactly 3 actionable next steps.
- Prefer structured outputs (bullets/tables/checklists) when useful.
- Always surface 1 missing critical input to proceed.
- If compliance/regulatory topics arise, ask for target market(s) and outline the checklist succinctly.`;

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

    // include any client-provided recent history (optional)
    const mergedHistory = Array.isArray(history) ? history : [];
    const messages = [
      { role: "system", content: sys },
      ...past,
      ...mergedHistory,
      { role: "user", content: String(prompt) }
    ];

    // 4) call OpenAI with streaming
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      stream: true,
      messages
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
        } catch (err) {
          // If streaming fails, close gracefully
        } finally {
          controller.close();
        }
      }
    });

    // 5) after stream closes, persist assistant reply (fire-and-forget)
    stream.closed
      .then(async () => {
        try {
          await supaAdmin.from("messages").insert({
            conversation_id: convoId, role: "assistant", content: full
          });
          await supaAdmin.from("conversations").update({ last_active: new Date().toISOString() }).eq("id", convoId);
          await supaAdmin.from("analytics_events").insert({
            email, kind: "message_assistant", sector, conversation_id: convoId, meta: { lang, len: full.length }
          });
        } catch {
          // ignore
        }
      })
      .catch(() => {});

    // 6) return stream + conversation id (frontend should store it)
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "x-conversation-id": convoId!,
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
