// Révisions — une séance : génération, questions une par une, correction, bilan.

import { h, vider, remplir, paragraphes, lireLocal, ecrireLocal } from "./util.js";
import { demanderExercice, demanderCorrection, preparerPhoto } from "./api.js";
import { corrigerReponse } from "./correction.js";
import { dire, dicterPhrase, dicterMorceaux, paroleDisponible, arreter } from "./parole.js";

const NOMS_DIFFICULTE = { decouverte: "Découverte", entrainement: "Entraînement", approfondissement: "Approfondissement" };

function boutonEcouter(texte, enfant) {
  if (!paroleDisponible() || !texte) return null;
  return h("button.ecouter", { type: "button", onclick: () => dire(texte, { vitesse: enfant ? 0.85 : 1 }), "aria-label": "Écouter" }, "🔊 Écouter");
}

export async function lancerSeance(racine, opts) {
  const { lecon, matiere, niveau, fiche, difficulte, nombre, enfant, retour, page } = opts;
  const attente = h(
    "div.attente",
    {},
    h("div.rond"),
    h("p", {}, enfant ? "Je prépare tes exercices…" : "Préparation du sujet…"),
    h("p.sous", {}, "Cela peut prendre jusqu'à une minute.")
  );
  page(lecon.titre, { retour, enfant }, attente);

  let exercice;
  try {
    exercice = await demanderExercice({ niveau: niveau.nom, matiere: matiere.nom, fiche, difficulte, nombre });
  } catch (e) {
    remplir(attente, 
      h("p.erreur", {}, e.message),
      h("button.principal", { type: "button", onclick: () => lancerSeance(racine, opts) }, "Réessayer")
    );
    return;
  }
  if (!exercice.questions?.length) {
    remplir(attente, h("p.erreur", {}, "L'IA n'a renvoyé aucune question. Réessaie."));
    return;
  }
  afficherSeance(racine, opts, exercice);
}

function afficherSeance(racine, opts, exercice) {
  const { lecon, enfant, retour, page, difficulte } = opts;
  const resultats = exercice.questions.map(() => null);
  let index = 0;

  const zoneQuestion = h("div");
  const progression = h("p.progression");

  page(
    exercice.titre || lecon.titre,
    { retour, enfant },
    exercice._demo ? h("p.bandeau", {}, "Mode démo : exercice d'exemple, l'IA n'est pas appelée.") : null,
    h(
      "section.consigne",
      {},
      h("p.sous", {}, `${lecon.titre} · ${NOMS_DIFFICULTE[difficulte]}`),
      exercice.consigne_generale ? h("p", {}, exercice.consigne_generale, " ", boutonEcouter(exercice.consigne_generale, enfant)) : null,
      exercice.texte_support
        ? h("details.support", { open: true }, h("summary", {}, enfant ? "Le texte" : "Texte et documents"), ...paragraphes(exercice.texte_support), boutonEcouter(enfant ? exercice.texte_support : "", enfant))
        : null
    ),
    progression,
    zoneQuestion
  );

  const montrer = () => {
    arreter();
    progression.textContent = `Question ${index + 1} sur ${exercice.questions.length}`;
    remplir(zoneQuestion, 
      carteQuestion(exercice.questions[index], {
        ...opts,
        exercice,
        resultat: resultats[index],
        onResultat: (r) => (resultats[index] = r),
        dernier: index === exercice.questions.length - 1,
        suivant: () => {
          if (index < exercice.questions.length - 1) {
            index++;
            montrer();
            window.scrollTo({ top: zoneQuestion.offsetTop - 80, behavior: "smooth" });
          } else bilan(racine, opts, exercice, resultats);
        },
      })
    );
    if (enfant && exercice.questions[index].type !== "dictee") dire(exercice.questions[index].enonce, { vitesse: 0.85 });
  };
  montrer();
}

function carteQuestion(q, ctx) {
  const { enfant, onResultat, suivant, dernier } = ctx;
  const carte = h("section.question");
  const zoneReponse = h("div.reponse");
  const zoneIndices = h("ol.indices");
  const zoneRetour = h("div");
  let nbIndices = 0;
  let valeur = () => "";
  let photo = null;

  // --- saisie selon le type ---
  if (q.type === "qcm") {
    let choisi = "";
    const boutons = q.choix.map((c) =>
      h(
        "button.option",
        {
          type: "button",
          "aria-pressed": "false",
          onclick: (e) => {
            choisi = c;
            boutons.forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget)));
          },
        },
        c
      )
    );
    zoneReponse.append(h("div.choix.qcm", {}, boutons));
    valeur = () => choisi;
  } else if (q.type === "nombre" || q.type === "mot") {
    const input = h("input.saisie", {
      inputMode: q.type === "nombre" ? "decimal" : "text",
      autocomplete: "off",
      autocapitalize: "off",
      spellcheck: "false",
      placeholder: q.type === "nombre" ? "Ta réponse" : "Écris ta réponse",
      onkeydown: (e) => e.key === "Enter" && valider(),
    });
    zoneReponse.append(input);
    valeur = () => input.value;
  } else if (q.type === "dictee") {
    const zone = h("textarea.saisie", { rows: 3, autocomplete: "off", autocapitalize: "sentences", spellcheck: "false", placeholder: "Écris la phrase ici" });
    zoneReponse.append(
      h(
        "div.boutons-dictee",
        {},
        h("button.secondaire", { type: "button", onclick: () => dicterPhrase(q.reponse_attendue) }, "🔊 Toute la phrase"),
        h("button.secondaire", { type: "button", onclick: () => dicterMorceaux(q.reponse_attendue) }, "🐢 Mot à mot")
      ),
      zone
    );
    valeur = () => zone.value;
  } else {
    const zone = h("textarea.saisie.longue", { rows: 10, placeholder: "Rédige ta réponse ici, ou prends ta copie en photo." });
    const apercu = h("div.apercu");
    const fichier = h("input", {
      type: "file",
      accept: "image/*",
      capture: "environment",
      hidden: true,
      onchange: async () => {
        if (!fichier.files[0]) return;
        photo = await preparerPhoto(fichier.files[0]);
        remplir(apercu, h("img", { src: photo.apercu, alt: "Photo de la copie" }), h("button.lien", { type: "button", onclick: () => ((photo = null), vider(apercu)) }, "Retirer la photo"));
      },
    });
    zoneReponse.append(zone, fichier, h("button.secondaire", { type: "button", onclick: () => fichier.click() }, "📷 Photographier ma copie"), apercu);
    valeur = () => zone.value;
  }

  const boutonIndice = q.indices?.length
    ? h(
        "button.lien",
        {
          type: "button",
          onclick: () => {
            if (nbIndices >= q.indices.length) return;
            zoneIndices.append(h("li", {}, q.indices[nbIndices++]));
            if (nbIndices >= q.indices.length) boutonIndice.disabled = true;
            boutonIndice.textContent = nbIndices >= q.indices.length ? "Plus d'indice" : "Un autre indice";
          },
        },
        enfant ? "💡 Un indice" : "Indice"
      )
    : null;

  const boutonValider = h("button.principal", { type: "button", onclick: () => valider() }, q.type === "redaction" ? "Faire corriger" : enfant ? "J'ai fini" : "Valider");

  carte.append(
    h("p.enonce", {}, q.enonce, " ", q.type !== "dictee" ? boutonEcouter(q.enonce, enfant) : null),
    zoneReponse,
    zoneIndices,
    h("div.actions", {}, boutonIndice, boutonValider),
    zoneRetour
  );

  function blocCorrige() {
    return h(
      "div.corrige",
      {},
      q.methode?.length ? [h("h3", {}, "La méthode"), h("ol", {}, q.methode.map((m) => h("li", {}, m)))] : null,
      q.piege ? [h("h3", {}, "Attention au piège"), h("p", {}, q.piege)] : null,
      q.rappel_cours ? [h("h3", {}, "Rappel de cours"), h("p", {}, q.rappel_cours)] : null
    );
  }

  function boutonSuivant() {
    return h("button.principal", { type: "button", onclick: suivant }, dernier ? "Voir mon bilan" : "Question suivante");
  }

  async function valider() {
    const reponse = valeur();
    if (q.type === "redaction") return corrigerRedactionUI(reponse);
    if (!String(reponse).trim()) return;
    const r = corrigerReponse(q, reponse);
    onResultat({ juste: r.juste, indices: nbIndices });
    boutonValider.remove();
    boutonIndice?.remove();
    zoneReponse.querySelectorAll("input, textarea, button").forEach((el) => (el.disabled = true));
    remplir(zoneRetour, 
      h(`div.verdict.${r.juste ? "juste" : "faux"}`, {}, r.juste ? (enfant ? "Bravo ! 🎉" : "Juste") : enfant ? "Presque ! Regarde la correction." : "Pas tout à fait"),
      r.douteux ? h("p.alerte", {}, "Le corrigé de l'IA semblait faux : le résultat a été recalculé automatiquement.") : null,
      r.dictee ? afficherDictee(r.dictee) : !r.juste ? h("p", {}, "La bonne réponse : ", h("strong", {}, r.attendu)) : null,
      blocCorrige(),
      boutonSuivant()
    );
    if (enfant) dire(r.juste ? "Bravo !" : "Presque ! Regarde la correction.", { vitesse: 0.9 });
  }

  async function corrigerRedactionUI(reponse) {
    if (!reponse.trim() && !photo) return;
    boutonValider.disabled = true;
    boutonValider.textContent = "Correction en cours…";
    try {
      const c = await demanderCorrection({
        niveau: ctx.niveau.nom,
        matiere: ctx.matiere.nom,
        fiche: ctx.fiche,
        exercice: { texte_support: ctx.exercice.texte_support },
        question: q,
        reponse,
        image: photo ? { media_type: photo.media_type, data: photo.data } : null,
      });
      onResultat({ redaction: true });
      boutonValider.remove();
      remplir(zoneRetour, 
        h(
          "div.correction",
          {},
          h("p", {}, c.appreciation),
          c.note_indicative ? h("p.note", {}, `Note indicative : ${c.note_indicative}`) : null,
          c.points_forts?.length ? [h("h3", {}, "Points forts"), h("ul", {}, c.points_forts.map((x) => h("li", {}, x)))] : null,
          c.a_ameliorer?.length ? [h("h3", {}, "À améliorer"), h("ul", {}, c.a_ameliorer.map((x) => h("li", {}, x)))] : null,
          c.proposition ? h("details", {}, h("summary", {}, "Une proposition de corrigé"), ...paragraphes(c.proposition)) : null,
          h("details", {}, h("summary", {}, "Les éléments attendus"), ...paragraphes(q.reponse_attendue), blocCorrige()),
          h("p.aide", {}, "La note est un ordre de grandeur. L'avis de tes professeurs reste la référence.")
        ),
        boutonSuivant()
      );
    } catch (e) {
      boutonValider.disabled = false;
      boutonValider.textContent = "Faire corriger";
      remplir(zoneRetour, h("p.erreur", {}, e.message));
    }
  }

  return carte;
}

function afficherDictee({ erreurs, morceaux }) {
  return h(
    "div.dictee",
    {},
    h("p", {}, erreurs === 0 ? "Aucune erreur !" : `${erreurs} erreur${erreurs > 1 ? "s" : ""} :`),
    h(
      "p.mots",
      {},
      morceaux.map((m) =>
        m.etat === "ok"
          ? h("span.ok", {}, m.texte)
          : m.etat === "faux"
            ? h("span.faux", { title: `Il fallait : ${m.attendu}` }, h("s", {}, m.texte), " ", h("strong", {}, m.attendu))
            : m.etat === "manque"
              ? h("span.manque", { title: "Mot oublié" }, h("strong", {}, m.texte))
              : h("span.en-trop", { title: "Mot en trop" }, h("s", {}, m.texte))
      )
    )
  );
}

function bilan(racine, opts, exercice, resultats) {
  const { profil, lecon, enfant, retour, page, matiere } = opts;
  const corriges = resultats.filter((r) => r && !r.redaction);
  const justes = corriges.filter((r) => r.juste).length;
  const total = corriges.length;
  const hist = lireLocal(`historique-${profil.id}`, []);
  hist.push({ date: new Date().toISOString(), matiere: matiere.nom, lecon: lecon.titre, difficulte: opts.difficulte, score: total ? justes : null, total: total || null });
  ecrireLocal(`historique-${profil.id}`, hist.slice(-200));

  const message = !total
    ? "Séance terminée. Relis les commentaires et retravaille un point à la fois."
    : justes === total
      ? enfant
        ? "Tout est juste, bravo champion !"
        : "Tout est juste."
      : justes >= total / 2
        ? enfant
          ? "Bien joué ! Encore un petit effort."
          : "Bon travail : revois les questions manquées."
        : enfant
          ? "Ce n'est pas grave, on recommence ensemble !"
          : "Notion à retravailler : relance une série en Découverte.";

  page(
    "Bilan",
    { retour, enfant },
    h("section.bilan", {}, total ? h("p.score", {}, `${justes} / ${total}`) : null, h("p", {}, message)),
    h(
      "div.actions.colonne",
      {},
      h("button.principal.grand", { type: "button", onclick: () => lancerSeance(racine, opts) }, enfant ? "Encore !" : "Nouvelle série"),
      h("a.secondaire", { href: retour }, "Choisir une autre leçon")
    )
  );
  if (enfant) dire(message, { vitesse: 0.9 });
}
