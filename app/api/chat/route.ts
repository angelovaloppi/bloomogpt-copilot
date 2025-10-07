export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import OpenAI from "openai";
import { supaAdmin } from "../../lib/supa";
import { corsHeaders } from "../../lib/cors";

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin") || "") });
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
      conversationId        // optional
    } = body || {};

    const email = lead?.email;
    if (!email) {
      return new Response(JSON.stringify({ error: "missing_email" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
      });
    }

    // 1) Ensure a conversation row exists (or create one)
    let convoId = conversationId as string | undefined;
    if (!convoId) {
      const { data: convo, error: cErr } = await supaAdmin
        .from("conversations")
        .insert({ email, title: `Chat with ${lead?.name || email}` })
        .select("id")
        .single();
      if (cErr) throw cErr;
      convoId = convo.id;
      // analytics
      await supaAdmin.from("analytics_events").insert({
        email, kind: "conversation_created", sector, conversation_id: convoId, meta: { lang }
      });
    }

    // 2) Persist the incoming user message
    await supaAdmin.from("messages").insert({
      conversation_id: convoId, role: "user", content: prompt
    });
    await supaAdmin.from("analytics_events").insert({
      email, kind: "message_user", sector, conversation_id: convoId, meta: { lang, len: prompt.length }
    });

    // 3) Build system + past messages (load last 20 for context)
    const sys = `You are BloomoGPT Business Copilot.
Audience: companies optimizing domestic operations and export growth.
Language: Reply in ${lang.toUpperCase()} unless the user clearly switches language.
Sector: ${lead?.sector || sector}.
Guidelines:
- Start with 2–3 concise sentences, then provide exactly 3 actionable next steps.
- Prefer structured outputs (bullets/tables/checklists) when useful.
- Always surface 1 missing critical input to proceed.
- If compliance/regulatory topics arise, ask for target market(s) and outline the checklist succinctly.`;

    const { data: lastMsgs } = await supaAdmin
      .from("messages")
      .select("role,content,created_at")
      .eq("conversation_id", convoId)
      .order("created_at", { ascending: false })
      .limit(20);

    const past = (lastMsgs || []).reverse().map(m => ({ role: m.role as "user"|"assistant"|"system", content: m.content }));

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      stream: true,
      messages: [
        { role: "system", content: sys },
        ...past,
        { role: "user", content: prompt }
      ]
    });

    // 4) Stream out, while buffering full text to save after
    const encoder = new TextEncoder();
    let full = "";

    const stream = new ReadableStream({
      async start(controller) {
        for await (const part of completion) {
          const delta = part.choices?.[0]?.delta?.content || "";
          if (delta) {
            full += delta;
            controller.enqueue(encoder.encode(delta));
          }
        }
        controller.close();
      }
    });

    // 5) After stream completes, persist the assistant message (fire-and-forget)
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
        } catch { /* ignore */ }
      })
      .catch(() => { /* ignore */ });

    // 6) Return stream + conversationId so the frontend can keep it
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "x-conversation-id": convoId!,
        ...corsHeaders(origin)
      }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
    });
  }
}
