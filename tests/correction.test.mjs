// Tests de la correction automatique : node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculer, verifierCorrige, comparerDictee, corrigerReponse } from "../app/js/correction.js";

test("calculer : opérations et priorités", () => {
  assert.equal(calculer("346 + 238"), 584);
  assert.equal(calculer("3 × 5 + 2"), 17);
  assert.equal(calculer("(12 - 4) * 2"), 16);
  assert.equal(calculer("10 / 4"), 2.5);
  assert.equal(calculer("alert(1)"), null);
  assert.equal(calculer("2 +"), null);
  assert.equal(calculer(""), null);
});

test("verifierCorrige : un corrigé faux est recalculé", () => {
  assert.deepEqual(verifierCorrige({ reponse_attendue: "584", expression_calcul: "346 + 238" }), { valeur: 584, douteux: false });
  assert.deepEqual(verifierCorrige({ reponse_attendue: "574", expression_calcul: "346 + 238" }), { valeur: 584, douteux: true });
  assert.deepEqual(verifierCorrige({ reponse_attendue: "42", expression_calcul: "" }), { valeur: 42, douteux: false });
});

test("comparerDictee : phrase juste", () => {
  const r = comparerDictee("Aujourd'hui, je joue avec mon ami.", "Aujourd’hui, je joue avec mon ami.");
  assert.equal(r.erreurs, 0);
});

test("comparerDictee : mot faux, oubli, majuscule", () => {
  const r = comparerDictee("Le soir, les enfants rentrent à la maison.", "le soir les enfant rentre à la maison.");
  // « le » au lieu de « Le », virgule oubliée, « enfant », « rentre »
  assert.equal(r.erreurs, 4);
  assert.deepEqual(
    r.morceaux.filter((m) => m.etat !== "ok").map((m) => [m.etat, m.texte, m.attendu]),
    [
      ["faux", "le", "Le"],
      ["manque", ",", ","],
      ["faux", "enfant", "enfants"],
      ["faux", "rentre", "rentrent"],
    ]
  );
});

test("corrigerReponse : nombre, mot, qcm", () => {
  assert.equal(corrigerReponse({ type: "nombre", reponse_attendue: "584", expression_calcul: "346+238" }, " 584 ").juste, true);
  assert.equal(corrigerReponse({ type: "nombre", reponse_attendue: "574", expression_calcul: "346+238" }, "574").juste, false);
  assert.equal(corrigerReponse({ type: "mot", reponse_attendue: "chantons" }, "Chantons.").juste, true);
  assert.equal(corrigerReponse({ type: "mot", reponse_attendue: "chantons" }, "chanton").juste, false);
  assert.equal(corrigerReponse({ type: "qcm", reponse_attendue: "pluriel" }, "pluriel").juste, true);
  assert.equal(corrigerReponse({ type: "redaction", reponse_attendue: "" }, "texte"), null);
});
