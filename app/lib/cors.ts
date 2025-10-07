// app/lib/cors.ts
const ALLOW = (process.env.RUNTIME_ORIGIN || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

/**
 * Build CORS headers reflecting the requesting origin if it's allowed.
 * If no allow-list is set, default to "*".
 */
export function corsHeaders(originHeader?: string) {
  let allow = "*";

  if (ALLOW.length > 0) {
    const origin = originHeader || "";
    const ok = ALLOW.some(a =>
      origin === a ||
      // allow subdomain match if you ever add bare domains (e.g., squarespace.com)
      (a && origin.endsWith(a.replace(/^\./, "")))
    );
    allow = ok ? origin : ALLOW[0]; // fall back to first allowed origin
  }

  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}
