// app/api/chat/route.ts
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import OpenAI from "openai";

// CORS preflight
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
    const { lang = "en", sector = "general", prompt = "", history = [] } =
      await req.json();

    const system = `You are BloomoGPT Business Copilot.
Audience: companies optimizing domestic operations and export growth.
Language: ${lang}. If unclear, ask once then proceed.
Sector: ${sector}.
Guidelines:
- Start with 2–3 concise sentences, then provide exactly 3 actionable next steps.
- Prefer structured outputs (bullets/tables/checklists) when useful.
- Always surface 1 missing critical input to proceed.`;

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: system },
      ...(history as any[]),
      { role: "user", content: prompt }
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages,
      temperature: 0.2,
      stream: true
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for await (const part of completion) {
          const delta = part.choices?.[0]?.delta?.content || "";
          if (delta) controller.enqueue(encoder.encode(delta));
        }
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": process.env.RUNTIME_ORIGIN || "*"
      }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": process.env.RUNTIME_ORIGIN || "*"
      }
    });
  }
}

