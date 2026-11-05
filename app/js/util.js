// Révisions — petits utilitaires d'interface

// h("div.carte", { onclick }, enfant1, enfant2...) : crée un élément.
export function h(sel, attrs = {}, ...enfants) {
  const [tag, ...classes] = sel.split(".");
  const el = document.createElement(tag || "div");
  if (classes.length) el.className = classes.join(" ");
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else if (k in el && k !== "list") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const e of enfants.flat()) {
    if (e == null || e === false) continue;
    el.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
  return el;
}

export function vider(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

// Remplace le contenu d'un élément, en ignorant les valeurs vides (null, false).
export function remplir(el, ...enfants) {
  vider(el).append(...enfants.flat().filter((e) => e != null && e !== false));
  return el;
}

// Texte multi-lignes : les retours à la ligne deviennent des paragraphes.
export function paragraphes(texte) {
  return String(texte || "")
    .split(/\n{2,}/)
    .map((p) => h("p", {}, ...p.split("\n").flatMap((l, i) => (i ? [h("br"), l] : [l]))));
}

export function lireLocal(cle, defaut) {
  try {
    const v = localStorage.getItem(cle);
    return v == null ? defaut : JSON.parse(v);
  } catch {
    return defaut;
  }
}

export function ecrireLocal(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* stockage indisponible : on continue sans */
  }
}
