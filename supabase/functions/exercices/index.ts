// Révisions — fonction Supabase (Deno) : génération d'exercices et correction.
// Déploiement : supabase functions deploy exercices
// Secrets     : supabase secrets set ANTHROPIC_API_KEY=... CODE_FAMILLE=...
//
// Appels : POST <url>/exercices/exercice  ou  POST <url>/exercices/correction
// L'en-tête x-code-famille doit correspondre au secret CODE_FAMILLE, pour que
// seule la famille puisse consommer le crédit API.

import Anthropic from "npm:@anthropic-ai/sdk@1.5.0";
import { genererExercice, corrigerRedaction, ErreurIA } from "../_shared/ia.js";

const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
const CODE_FAMILLE = Deno.env.get("CODE_FAMILLE") ?? "";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-code-famille, authorization, apikey",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(status: number, corps: unknown) {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json(405, { erreur: "POST attendu." });
  if (!CODE_FAMILLE || req.headers.get("x-code-famille") !== CODE_FAMILLE) {
    return json(401, { erreur: "Code famille manquant ou incorrect." });
  }

  const action = new URL(req.url).pathname.split("/").pop();
  try {
    const demande = await req.json();
    if (action === "exercice") return json(200, await genererExercice(client, demande));
    if (action === "correction") return json(200, await corrigerRedaction(client, demande));
    return json(404, { erreur: "Route inconnue." });
  } catch (e) {
    console.error(e);
    if (e instanceof ErreurIA) return json(e.status, { erreur: e.message });
    if (e instanceof Anthropic.RateLimitError) return json(429, { erreur: "Trop de demandes d'un coup. Attends une minute." });
    if (e instanceof Anthropic.APIConnectionError) return json(503, { erreur: "Impossible de joindre l'IA." });
    if (e instanceof Anthropic.APIError) return json(502, { erreur: `Erreur de l'IA (${e.status ?? "?"}).` });
    if (e instanceof SyntaxError) return json(400, { erreur: "Requête invalide." });
    return json(500, { erreur: "Erreur inattendue." });
  }
});
