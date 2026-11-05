// Révisions — lecture à voix haute (synthèse vocale de l'appareil, gratuite)

let voix = null;

function choisirVoix() {
  const toutes = window.speechSynthesis?.getVoices() || [];
  voix = toutes.find((v) => v.lang === "fr-FR" && v.localService) || toutes.find((v) => v.lang?.startsWith("fr")) || null;
}

if ("speechSynthesis" in window) {
  choisirVoix();
  window.speechSynthesis.addEventListener?.("voiceschanged", choisirVoix);
}

export const paroleDisponible = () => "speechSynthesis" in window;

export function arreter() {
  window.speechSynthesis?.cancel();
}

// Lit un ou plusieurs morceaux de texte à la suite.
export function dire(textes, { vitesse = 0.9 } = {}) {
  if (!paroleDisponible()) return;
  arreter();
  for (const t of [].concat(textes)) {
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "fr-FR";
    if (voix) u.voice = voix;
    u.rate = vitesse;
    window.speechSynthesis.speak(u);
  }
}

// Dictée : la phrase entière, lentement.
export function dicterPhrase(phrase) {
  dire(phrase, { vitesse: 0.75 });
}

// Dictée mot à mot : groupes de 3 mots, ponctuation dite comme en classe.
export function dicterMorceaux(phrase) {
  const avecPonctuation = phrase
    .replace(/,/g, " virgule")
    .replace(/\./g, " point")
    .replace(/\?/g, " point d'interrogation")
    .replace(/!/g, " point d'exclamation");
  const mots = avecPonctuation.split(/\s+/).filter(Boolean);
  const groupes = [];
  for (let i = 0; i < mots.length; i += 3) groupes.push(mots.slice(i, i + 3).join(" "));
  dire(groupes, { vitesse: 0.6 });
}
