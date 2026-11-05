// Tests du module IA avec un faux client (aucun appel réel à l'API).
import { test } from "node:test";
import assert from "node:assert/strict";
import { genererExercice, corrigerRedaction, ErreurIA, MODELE } from "../supabase/functions/_shared/ia.js";

function fauxClient(reponse) {
  const appels = [];
  return {
    appels,
    beta: { messages: { create: async (params) => (appels.push(params), reponse) } },
  };
}

const exercice = { titre: "T", consigne_generale: "", texte_support: "", questions: [] };
const fiche = { id: "addition-posee", titre: "L'addition posée" };

test("genererExercice : paramètres envoyés et JSON relu", async () => {
  const client = fauxClient({ stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify(exercice) }] });
  const r = await genererExercice(client, { niveau: "CE1", matiere: "Mathématiques", fiche, difficulte: "decouverte", nombre: 50 });
  assert.deepEqual(r, exercice);
  const p = client.appels[0];
  assert.equal(p.model, MODELE);
  assert.equal(p.fallbacks, "default");
  assert.deepEqual(p.betas, ["server-side-fallback-2026-07-01"]);
  assert.equal(p.output_config.format.type, "json_schema");
  assert.match(p.messages[0].content, /Nombre de questions : 10/); // plafonné à 10
});

test("genererExercice : refus et coupure signalés clairement", async () => {
  await assert.rejects(
    genererExercice(fauxClient({ stop_reason: "refusal", content: [] }), { fiche, difficulte: "decouverte" }),
    (e) => e instanceof ErreurIA && e.status === 422
  );
  await assert.rejects(
    genererExercice(fauxClient({ stop_reason: "max_tokens", content: [] }), { fiche, difficulte: "decouverte" }),
    (e) => e instanceof ErreurIA && e.status === 502
  );
  await assert.rejects(genererExercice(fauxClient({}), { fiche, difficulte: "inconnue" }), (e) => e.status === 400);
});

test("corrigerRedaction : la photo passe avant le texte", async () => {
  const client = fauxClient({ stop_reason: "end_turn", content: [{ type: "text", text: '{"appreciation":"ok","points_forts":[],"a_ameliorer":[],"note_indicative":"","proposition":""}' }] });
  await corrigerRedaction(client, { niveau: "Terminale", matiere: "Philosophie", fiche, question: { enonce: "Q", reponse_attendue: "A" }, reponse: "", image: { media_type: "image/jpeg", data: "AAAA" } });
  const contenu = client.appels[0].messages[0].content;
  assert.equal(contenu[0].type, "image");
  assert.equal(contenu[1].type, "text");
  assert.equal(client.appels[0].output_config.effort, "high");
});
