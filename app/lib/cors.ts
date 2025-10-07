// app/lib/cors.ts
const ALLOW = (process.env.RUNTIME_ORIGIN || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

/** Build CORS headers reflecting the requesting origin if it's allowed. */
export function corsHeaders(originHeader?: string) {
  // default: open during local testing, but we’ll rely on the allow-list in prod
  if (ALLOW.length === 0) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    };
  }

  const origin = originHeader || "";
  const allowed = ALLOW.some(a => origin === a || origin.endsWith(a.replace(/^\./, "")));
  const allowValue = allowed ? origin : ALLOW[0];

  return {
    "Access-Control-Allow-Origin": allowValue,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}
