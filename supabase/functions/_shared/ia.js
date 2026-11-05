// Révisions — logique IA partagée entre le serveur de développement (Node)
// et la fonction Supabase (Deno). Ce module n'importe pas le SDK : il reçoit
// le client Anthropic déjà construit, pour fonctionner dans les deux environnements.

export const MODELE = "claude-opus-5-5";

const DIFFICULTES = {
  decouverte: "Découverte : application directe de la règle, une seule étape, très guidé.",
  entrainement: "Entraînement : niveau d'un contrôle en classe, 2 à 3 étapes, l'élève choisit la méthode.",
  approfondissement:
    "Approfondissement : problème en contexte ou, en Terminale, sujet complet au format du bac 2027.",
};

// Format d'un exercice renvoyé par l'IA (sorties JSON structurées).
// Tous les champs sont obligatoires : une valeur vide ("" ou []) signifie « sans objet ».
export const SCHEMA_EXERCICE = {
  type: "object",
  additionalProperties: false,
  required: ["titre", "consigne_generale", "texte_support", "questions"],
  properties: {
    titre: { type: "string" },
    consigne_generale: { type: "string" },
    texte_support: {
      type: "string",
      description: "Texte ou documents à étudier (HLP, philosophie, SVT). Vide si aucun.",
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "enonce",
          "type",
          "choix",
          "reponse_attendue",
          "expression_calcul",
          "indices",
          "methode",
          "piege",
          "rappel_cours",
        ],
        properties: {
          enonce: { type: "string" },
          type: { type: "string", enum: ["nombre", "mot", "qcm", "dictee", "redaction"] },
          choix: { type: "array", items: { type: "string" } },
          reponse_attendue: {
            type: "string",
            description:
              "nombre : la valeur ; mot : le mot ; qcm : le texte exact du bon choix ; dictee : le texte à dicter ; redaction : les éléments attendus.",
          },
          expression_calcul: {
            type: "string",
            description:
              "Pour une question de type nombre : le calcul qui donne la réponse, avec seulement des chiffres et + - * / ( ). Vide sinon.",
          },
          indices: { type: "array", items: { type: "string" } },
          methode: { type: "array", items: { type: "string" } },
          piege: { type: "string" },
          rappel_cours: { type: "string" },
        },
      },
    },
  },
};

export const SCHEMA_CORRECTION = {
  type: "object",
  additionalProperties: false,
  required: ["appreciation", "points_forts", "a_ameliorer", "note_indicative", "proposition"],
  properties: {
    appreciation: { type: "string" },
    points_forts: { type: "array", items: { type: "string" } },
    a_ameliorer: { type: "array", items: { type: "string" } },
    note_indicative: {
      type: "string",
      description: "Ordre de grandeur sur le barème de la question, ex. « environ 6/10 ». Vide si non pertinent.",
    },
    proposition: {
      type: "string",
      description: "Plan ou corrigé proposé, pour comparer.",
    },
  },
};

const SYSTEME_GENERATION = `Tu crées des exercices de révision pour un élève français, strictement conformes au programme officiel de l'Éducation nationale du niveau indiqué.

Règles :
- Reste dans les notions de la fiche leçon. N'utilise jamais une notion listée comme hors programme.
- Adapte la langue à l'âge : en CE1, consignes de 15 mots maximum, phrases simples, vocabulaire courant, nombres dans les limites de la fiche ; en Terminale, vocabulaire disciplinaire exact.
- Chaque question a un corrigé complet : la réponse, la méthode pas à pas (comme on la rédige en classe), le piège fréquent, et un rappel de cours en une ou deux phrases.
- Donne 3 indices progressifs par question, du plus léger au plus explicite, sans donner la réponse.
- Pour une question de type « nombre », remplis expression_calcul avec le calcul exact : il sera recalculé automatiquement.
- Pour une dictée, la question est de type « dictee » et reponse_attendue contient exactement le texte à dicter, avec les mots de la fiche.
- En Terminale, pour un sujet de type bac, respecte le format d'épreuve décrit dans la fiche. Un texte d'auteur doit être un extrait authentique et court, du domaine public si possible, avec sa référence ; si tu n'es pas sûr du texte exact, choisis un autre extrait que tu connais avec certitude.
- En SVT, si une question s'appuie sur des documents, décris-les dans texte_support de façon simplifiée et indique « document simplifié pour l'entraînement » ; ne présente jamais des chiffres inventés comme des mesures réelles.
- Varie les exercices d'une demande à l'autre (contextes, nombres, textes).
- Réponds en français.`;

const SYSTEME_CORRECTION = `Tu es un professeur bienveillant et exigeant qui commente la réponse rédigée d'un élève de Terminale, selon les attendus du bac 2027 indiqués dans la fiche.

Règles :
- Commence par ce qui est réussi, puis 2 à 4 pistes d'amélioration précises et applicables (problématique, plan, arguments, références, exemples, langue).
- La note est indicative : donne seulement un ordre de grandeur sur le barème de la question.
- Propose ensuite un plan ou un corrigé possible, sans prétendre qu'il est le seul valable.
- Si la réponse est une photo de copie manuscrite, lis-la ; si un passage est illisible, dis-le plutôt que de deviner.
- Réponds en français.`;

function texteFiche(fiche) {
  return JSON.stringify(fiche, null, 2);
}

// Extrait le JSON de la réponse et signale les cas où il n'y en a pas.
function lireJSON(message) {
  if (message.stop_reason === "refusal") {
    throw new ErreurIA("L'IA a refusé cette demande. Essaie une autre leçon ou une autre difficulté.", 422);
  }
  if (message.stop_reason === "max_tokens") {
    throw new ErreurIA("La réponse de l'IA a été coupée. Réessaie avec moins de questions.", 502);
  }
  const texte = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return JSON.parse(texte);
  } catch {
    throw new ErreurIA("Réponse de l'IA illisible. Réessaie.", 502);
  }
}

export class ErreurIA extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

async function appeler(client, { systeme, contenu, schema, effort }) {
  const message = await client.beta.messages.create({
    model: MODELE,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: { type: "json_schema", schema } },
    system: systeme,
    messages: [{ role: "user", content: contenu }],
  });
  return lireJSON(message);
}

// demande = { niveau, matiere, fiche, difficulte, nombre }
export async function genererExercice(client, demande) {
  const { niveau, matiere, fiche, difficulte, nombre } = demande;
  if (!fiche || !DIFFICULTES[difficulte]) throw new ErreurIA("Demande incomplète.", 400);
  const n = Math.min(Math.max(Number(nombre) || 5, 1), 10);
  const contenu = `Niveau : ${niveau}
Matière : ${matiere}
Difficulté : ${DIFFICULTES[difficulte]}
Nombre de questions : ${n} (pour un sujet type bac, le nombre de questions du format d'épreuve)

Fiche leçon (issue du programme officiel) :
${texteFiche(fiche)}`;
  return appeler(client, {
    systeme: SYSTEME_GENERATION,
    contenu,
    schema: SCHEMA_EXERCICE,
    effort: "medium",
  });
}

// demande = { niveau, matiere, fiche, exercice, question, reponse, image }
// image (facultatif) = { media_type: "image/jpeg", data: "<base64>" }
export async function corrigerRedaction(client, demande) {
  const { niveau, matiere, fiche, exercice, question, reponse, image } = demande;
  if (!question || (!reponse && !image)) throw new ErreurIA("Réponse vide.", 400);
  const contenu = [];
  if (image?.data) {
    contenu.push({
      type: "image",
      source: { type: "base64", media_type: image.media_type || "image/jpeg", data: image.data },
    });
  }
  contenu.push({
    type: "text",
    text: `Niveau : ${niveau}
Matière : ${matiere}

Fiche leçon :
${texteFiche(fiche)}

Sujet :
${exercice?.texte_support ? `Texte / documents :\n${exercice.texte_support}\n\n` : ""}Question : ${question.enonce}
Éléments attendus : ${question.reponse_attendue}

Réponse de l'élève :
${reponse || "(voir la photo de la copie ci-dessus)"}`,
  });
  return appeler(client, {
    systeme: SYSTEME_CORRECTION,
    contenu,
    schema: SCHEMA_CORRECTION,
    effort: "high",
  });
}
