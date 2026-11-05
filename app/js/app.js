// Révisions — écrans de navigation : profil → matière → leçon → réglages.

import { h, vider, remplir, lireLocal, ecrireLocal } from "./util.js";
import { lancerSeance } from "./seance.js";
import { arreter } from "./parole.js";

export const VERSION = "0.1.1";
const racine = document.getElementById("app");

// ---------- Données ----------

let index = null;
const cacheMatieres = {};

async function chargerIndex() {
  if (!index) index = await (await fetch("referentiel/index.json")).json();
  return index;
}

async function chargerMatiere(niveau, matiere) {
  const cle = `${niveau.id}/${matiere.id}`;
  if (!cacheMatieres[cle]) cacheMatieres[cle] = await (await fetch(`referentiel/${matiere.fichier}`)).json();
  return cacheMatieres[cle];
}

// Fiche envoyée à l'IA : la leçon + le format d'épreuve et les consignes communes de la matière.
export function ficheComplete(donnees, lecon) {
  return {
    programme: donnees.programme,
    format_epreuve: donnees.format_epreuve,
    consignes_specifiques: [donnees.consignes_specifiques, lecon.consignes_specifiques].filter(Boolean).join(" "),
    ...lecon,
  };
}

const profils = () => lireLocal("profils", []);
const enregistrerProfils = (p) => ecrireLocal("profils", p);
export const historique = (idProfil) => lireLocal(`historique-${idProfil}`, []);

// ---------- Mise en page ----------

function page(titre, { retour, enfant = false } = {}, ...contenu) {
  arreter();
  document.body.classList.toggle("enfant", enfant);
  remplir(racine, 
    h(
      "header.barre",
      {},
      retour ? h("a.retour", { href: retour, "aria-label": "Retour" }, "‹") : h("span.retour"),
      h("h1", {}, titre),
      h("a.reglages", { href: "#/reglages", "aria-label": "Réglages" }, "⚙")
    ),
    h("main", {}, ...contenu)
  );
  window.scrollTo(0, 0);
}

const estEnfant = (profil) => profil?.niveau === "ce1";

// ---------- Écrans ----------

async function ecranAccueil() {
  const idx = await chargerIndex();
  const liste = profils();
  const nomNiveau = (id) => idx.niveaux.find((n) => n.id === id)?.nom || id;
  page(
    "Révisions",
    {},
    h("p.intro", {}, "Qui révise aujourd'hui ?"),
    h(
      "div.grille",
      {},
      liste.map((p) =>
        h("a.carte.profil", { href: `#/p/${p.id}` }, h("span.avatar", { style: `background:${p.couleur}` }, p.prenom[0]?.toUpperCase()), h("strong", {}, p.prenom), h("span.sous", {}, nomNiveau(p.niveau)))
      ),
      h("a.carte.ajout", { href: "#/nouveau-profil" }, h("span.avatar", {}, "+"), h("strong", {}, "Ajouter un profil"))
    )
  );
}

async function ecranNouveauProfil() {
  const idx = await chargerIndex();
  const couleurs = ["#4f46e5", "#0891b2", "#16a34a", "#ea580c", "#db2777"];
  const prenom = h("input", { name: "prenom", required: true, maxLength: 20, autocomplete: "off", placeholder: "Prénom ou pseudo" });
  const niveau = h("select", { name: "niveau" }, idx.niveaux.map((n) => h("option", { value: n.id }, n.nom)));
  const form = h(
    "form.formulaire",
    {
      onsubmit: (e) => {
        e.preventDefault();
        const liste = profils();
        const id = Date.now().toString(36);
        liste.push({ id, prenom: prenom.value.trim(), niveau: niveau.value, couleur: couleurs[liste.length % couleurs.length] });
        enregistrerProfils(liste);
        location.hash = `#/p/${id}`;
      },
    },
    h("label", {}, "Prénom", prenom),
    h("label", {}, "Classe", niveau),
    h("p.aide", {}, "Seuls le prénom et la classe sont enregistrés, et uniquement sur cet appareil."),
    h("button.principal", { type: "submit" }, "Créer le profil")
  );
  page("Nouveau profil", { retour: "#/" }, form);
  prenom.focus();
}

async function ecranMatieres(idProfil) {
  const profil = profils().find((p) => p.id === idProfil);
  if (!profil) return (location.hash = "#/");
  const idx = await chargerIndex();
  const niveau = idx.niveaux.find((n) => n.id === profil.niveau);
  const recents = historique(profil.id).slice(-5).reverse();
  page(
    `Bonjour ${profil.prenom}`,
    { retour: "#/", enfant: estEnfant(profil) },
    h("p.intro", {}, `${niveau.nom} : que veux-tu réviser ?`),
    h("div.grille", {}, niveau.matieres.map((m) => h("a.carte.matiere", { href: `#/p/${profil.id}/${m.id}` }, h("strong", {}, m.nom)))),
    recents.length
      ? h(
          "section.recents",
          {},
          h("h2", {}, "Dernières séances"),
          h(
            "ul",
            {},
            recents.map((r) =>
              h("li", {}, h("span", {}, `${r.lecon}`), h("span.sous", {}, `${new Date(r.date).toLocaleDateString("fr-FR")} · ${r.score != null ? `${r.score}/${r.total}` : "rédaction"}`))
            )
          )
        )
      : null
  );
}

async function ecranLecons(idProfil, idMatiere) {
  const profil = profils().find((p) => p.id === idProfil);
  if (!profil) return (location.hash = "#/");
  const idx = await chargerIndex();
  const niveau = idx.niveaux.find((n) => n.id === profil.niveau);
  const matiere = niveau.matieres.find((m) => m.id === idMatiere);
  const donnees = await chargerMatiere(niveau, matiere);
  const parTheme = new Map();
  for (const l of donnees.lecons) {
    const t = l.theme || "";
    if (!parTheme.has(t)) parTheme.set(t, []);
    parTheme.get(t).push(l);
  }
  page(
    matiere.nom,
    { retour: `#/p/${profil.id}`, enfant: estEnfant(profil) },
    donnees.format_epreuve ? h("details.epreuve", {}, h("summary", {}, "L'épreuve du bac 2027"), h("p", {}, donnees.format_epreuve)) : null,
    [...parTheme].map(([theme, lecons]) =>
      h(
        "section",
        {},
        theme ? h("h2", {}, theme) : null,
        h("div.liste", {}, lecons.map((l) => h("a.ligne", { href: `#/p/${profil.id}/${matiere.id}/${l.id}` }, l.titre, h("span.fleche", {}, "›"))))
      )
    )
  );
}

async function ecranReglages(idProfil, idMatiere, idLecon) {
  const profil = profils().find((p) => p.id === idProfil);
  if (!profil) return (location.hash = "#/");
  const idx = await chargerIndex();
  const niveau = idx.niveaux.find((n) => n.id === profil.niveau);
  const matiere = niveau.matieres.find((m) => m.id === idMatiere);
  const donnees = await chargerMatiere(niveau, matiere);
  const lecon = donnees.lecons.find((l) => l.id === idLecon);
  const enfant = estEnfant(profil);

  const choix = lireLocal(`choix-${profil.id}`, { difficulte: "decouverte", nombre: 5 });
  const difficultes = [
    ["decouverte", "Découverte", enfant ? "Facile" : "Application directe"],
    ["entrainement", "Entraînement", enfant ? "Comme en classe" : "Niveau contrôle"],
    ["approfondissement", "Approfondissement", enfant ? "Pour les champions" : "Sujet type bac"],
  ];
  const zoneDiff = h(
    "div.choix",
    {},
    difficultes.map(([id, nom, sous]) =>
      h(
        "button.option",
        {
          type: "button",
          "aria-pressed": String(choix.difficulte === id),
          onclick: (e) => {
            choix.difficulte = id;
            zoneDiff.querySelectorAll(".option").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget)));
          },
        },
        h("strong", {}, nom),
        h("span.sous", {}, sous)
      )
    )
  );
  const nombres = enfant ? [3, 5, 8] : [1, 3, 5];
  if (!nombres.includes(choix.nombre)) choix.nombre = nombres[1];
  const zoneNombre = h(
    "div.choix.compact",
    {},
    nombres.map((n) =>
      h(
        "button.option",
        {
          type: "button",
          "aria-pressed": String(choix.nombre === n),
          onclick: (e) => {
            choix.nombre = n;
            zoneNombre.querySelectorAll(".option").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget)));
          },
        },
        h("strong", {}, String(n))
      )
    )
  );

  page(
    lecon.titre,
    { retour: `#/p/${profil.id}/${matiere.id}`, enfant },
    h("h2", {}, "Difficulté"),
    zoneDiff,
    h("h2", {}, enfant ? "Combien d'exercices ?" : "Nombre de questions"),
    zoneNombre,
    h("p.aide", {}, enfant ? "" : "En « Sujet type bac », le nombre de questions suit le format de l'épreuve."),
    h(
      "button.principal.grand",
      {
        type: "button",
        onclick: () => {
          ecrireLocal(`choix-${profil.id}`, choix);
          lancerSeance(racine, {
            profil,
            niveau,
            matiere,
            lecon,
            fiche: ficheComplete(donnees, lecon),
            difficulte: choix.difficulte,
            nombre: choix.nombre,
            enfant,
            retour: `#/p/${profil.id}/${matiere.id}`,
            page,
          });
        },
      },
      "C'est parti !"
    )
  );
}

function ecranParametres() {
  const code = h("input", { value: lireLocal("codeFamille", ""), autocomplete: "off", placeholder: "Code donné par le parent" });
  const liste = profils();
  page(
    "Réglages",
    { retour: "#/" },
    h(
      "form.formulaire",
      {
        onsubmit: (e) => {
          e.preventDefault();
          ecrireLocal("codeFamille", code.value.trim());
          location.hash = "#/";
        },
      },
      h("label", {}, "Code famille", code),
      h("p.aide", {}, "Nécessaire pour la version en ligne : il protège le crédit de l'IA."),
      h("button.principal", { type: "submit" }, "Enregistrer")
    ),
    h("h2", {}, "Profils"),
    h(
      "div.liste",
      {},
      liste.map((p) =>
        h(
          "div.ligne",
          {},
          `${p.prenom}`,
          h(
            "button.lien",
            {
              type: "button",
              onclick: () => {
                if (!confirm(`Supprimer le profil ${p.prenom} et son historique ?`)) return;
                enregistrerProfils(profils().filter((x) => x.id !== p.id));
                localStorage.removeItem(`historique-${p.id}`);
                ecranParametres();
              },
            },
            "Supprimer"
          )
        )
      )
    ),
    h("p.aide", {}, `Version ${VERSION}`)
  );
}

// ---------- Routeur ----------

async function router() {
  const morceaux = (location.hash.slice(1) || "/").split("/").filter(Boolean);
  try {
    if (morceaux[0] === "nouveau-profil") return await ecranNouveauProfil();
    if (morceaux[0] === "reglages") return ecranParametres();
    if (morceaux[0] === "p") {
      const [, p, m, l] = morceaux;
      if (l) return await ecranReglages(p, m, l);
      if (m) return await ecranLecons(p, m);
      return await ecranMatieres(p);
    }
    return await ecranAccueil();
  } catch (e) {
    console.error(e);
    page("Oups", { retour: "#/" }, h("p.erreur", {}, "Impossible d'afficher cet écran."));
  }
}

window.addEventListener("hashchange", router);
router();

if ("serviceWorker" in navigator && !["localhost", "127.0.0.1"].includes(location.hostname)) {
  navigator.serviceWorker.register("sw.js");
}
