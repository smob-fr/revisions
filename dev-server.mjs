// Révisions — serveur de développement local.
// Sert l'appli (dossier app/) et les routes /api/exercice et /api/correction.
// Sans clé API (ANTHROPIC_API_KEY ou profil `ant auth login`), il passe en mode démo
// et renvoie l'exercice d'exemple de la fiche.
//
//   npm run dev        puis ouvrir http://localhost:8000

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { genererExercice, corrigerRedaction, ErreurIA } from "./supabase/functions/_shared/ia.js";

const PORT = Number(process.env.PORT) || 8000;
const RACINE = fileURLToPath(new URL("./app/", import.meta.url));
const DEMO = process.argv.includes("--demo");

let client = null;
if (!DEMO) {
  try {
    client = new Anthropic();
  } catch {
    client = null;
  }
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function envoyerJSON(res, status, objet) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(objet));
}

async function lireCorps(req) {
  const morceaux = [];
  let taille = 0;
  for await (const m of req) {
    taille += m.length;
    if (taille > 12 * 1024 * 1024) throw new ErreurIA("Requête trop volumineuse.", 413);
    morceaux.push(m);
  }
  return JSON.parse(Buffer.concat(morceaux).toString("utf8") || "{}");
}

function exerciceDemo(demande) {
  const exemple = demande.fiche?.exemple;
  if (exemple) return { ...exemple, titre: `${exemple.titre} (démo)` };
  if (demande.niveau === "Terminale") {
    return {
      titre: "Analyse de sujet (démo)",
      consigne_generale: "Mode démo : aucune clé API n'est configurée, l'IA n'a pas été appelée.",
      texte_support: "",
      questions: [
        {
          enonce: "Sujet : « Peut-on être libre sans le savoir ? » Dégage les termes du sujet, le problème et une problématique.",
          type: "redaction",
          choix: [],
          reponse_attendue: "Définition de « libre » et de « savoir » ; tension entre liberté vécue et conscience de sa liberté ; problématique formulée en question.",
          expression_calcul: "",
          indices: ["Que veut dire « être libre » ?", "Peut-on se croire libre sans l'être ?", "Inverse la question : peut-on savoir qu'on est libre ?"],
          methode: ["Définir chaque terme.", "Repérer la tension.", "Formuler la problématique."],
          piege: "Réciter un cours sur la liberté sans traiter la question posée.",
          rappel_cours: "Une problématique transforme le sujet en un problème précis à résoudre.",
        },
      ],
    };
  }
  return {
    titre: "Exercice de démonstration",
    consigne_generale: "Mode démo : aucune clé API n'est configurée, l'IA n'a pas été appelée.",
    texte_support: "",
    questions: [
      {
        enonce: "Combien font 27 + 15 ?",
        type: "nombre",
        choix: [],
        reponse_attendue: "42",
        expression_calcul: "27 + 15",
        indices: ["Commence par les unités.", "7 + 5 = 12 : il y a une retenue.", "20 + 10 + 12"],
        methode: ["Unités : 7 + 5 = 12, je pose 2 et je retiens 1.", "Dizaines : 2 + 1 + 1 = 4.", "Résultat : 42."],
        piege: "Oublier la retenue.",
        rappel_cours: "On additionne d'abord les unités, puis les dizaines avec la retenue.",
      },
    ],
  };
}

function correctionDemo() {
  return {
    appreciation: "Mode démo : aucune clé API n'est configurée, la réponse n'a pas été lue.",
    points_forts: ["La réponse a bien été envoyée."],
    a_ameliorer: ["Configurer ANTHROPIC_API_KEY pour une vraie correction."],
    note_indicative: "",
    proposition: "",
  };
}

async function api(req, res, chemin) {
  try {
    const demande = await lireCorps(req);
    let resultat;
    if (chemin === "/api/exercice") {
      resultat = client ? await genererExercice(client, demande) : exerciceDemo(demande);
    } else if (chemin === "/api/correction") {
      resultat = client ? await corrigerRedaction(client, demande) : correctionDemo();
    } else {
      return envoyerJSON(res, 404, { erreur: "Route inconnue." });
    }
    envoyerJSON(res, 200, { ...resultat, _demo: !client });
  } catch (e) {
    console.error(e);
    if (e instanceof ErreurIA) return envoyerJSON(res, e.status, { erreur: e.message });
    if (e instanceof Anthropic.AuthenticationError)
      return envoyerJSON(res, 500, { erreur: "Clé API refusée : vérifie ANTHROPIC_API_KEY." });
    if (e instanceof Anthropic.RateLimitError)
      return envoyerJSON(res, 429, { erreur: "Trop de demandes d'un coup. Attends une minute." });
    if (e instanceof Anthropic.APIConnectionError)
      return envoyerJSON(res, 503, { erreur: "Impossible de joindre l'IA. Vérifie la connexion." });
    if (e instanceof Anthropic.APIError)
      return envoyerJSON(res, 502, { erreur: `Erreur de l'IA (${e.status ?? "?"}).` });
    if (e instanceof SyntaxError) return envoyerJSON(res, 400, { erreur: "Requête invalide." });
    envoyerJSON(res, 500, { erreur: "Erreur inattendue." });
  }
}

async function fichier(res, chemin) {
  const relatif = normalize(decodeURIComponent(chemin)).replace(/^([/\\])+/, "");
  const complet = join(RACINE, relatif || "index.html");
  if (!complet.startsWith(RACINE)) {
    res.writeHead(403);
    return res.end();
  }
  try {
    const contenu = await readFile(complet.endsWith("\\") || complet.endsWith("/") ? join(complet, "index.html") : complet);
    res.writeHead(200, { "content-type": TYPES[extname(complet)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(contenu);
  } catch {
    res.writeHead(404);
    res.end("Introuvable");
  }
}

http
  .createServer((req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname.startsWith("/api/")) {
      if (req.method !== "POST") return envoyerJSON(res, 405, { erreur: "POST attendu." });
      return api(req, res, pathname);
    }
    return fichier(res, pathname === "/" ? "/index.html" : pathname);
  })
  .listen(PORT, () => {
    console.log(`Révisions : http://localhost:${PORT}  (${client ? "IA active" : "mode démo"})`);
  });
