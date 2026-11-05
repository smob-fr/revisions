// Révisions — appels au serveur (génération d'exercices et correction).
//
// En local (npm run dev), le serveur de développement répond sur /api.
// En ligne, l'appli appelle la fonction Supabase « exercices » : renseigner son
// adresse ci-dessous, et le code famille dans les réglages de l'appli.

import { lireLocal } from "./util.js";

const URL_FONCTION = "https://sthhoiuxooayfdisavfv.supabase.co/functions/v1/exercices";

const local = ["localhost", "127.0.0.1"].includes(location.hostname);
const BASE = local ? "/api" : URL_FONCTION;

async function appeler(action, corps) {
  if (!BASE) throw new Error("L'appli n'est pas encore reliée à son serveur.");
  if (!local && !lireLocal("codeFamille", "")) {
    throw new Error("Saisis d'abord le code famille dans les réglages (roue dentée en haut à droite).");
  }
  let rep;
  try {
    rep = await fetch(`${BASE}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-code-famille": lireLocal("codeFamille", "") },
      body: JSON.stringify(corps),
    });
  } catch {
    throw new Error("Pas de connexion. Vérifie le Wi-Fi ou les données mobiles.");
  }
  let donnees = {};
  try {
    donnees = await rep.json();
  } catch {
    /* corps vide ou non JSON */
  }
  if (!rep.ok) throw new Error(donnees.erreur || `Erreur ${rep.status}`);
  return donnees;
}

export const demanderExercice = (demande) => appeler("exercice", demande);
export const demanderCorrection = (demande) => appeler("correction", demande);

// Réduit une photo de copie avant envoi (bord le plus long : 1600 px, JPEG).
export async function preparerPhoto(fichier) {
  const url = URL.createObjectURL(fichier);
  try {
    const img = await new Promise((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = ko;
      i.src = url;
    });
    const echelle = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * echelle);
    c.height = Math.round(img.height * echelle);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL("image/jpeg", 0.85);
    return { media_type: "image/jpeg", data: dataUrl.split(",")[1], apercu: dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}
