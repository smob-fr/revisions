// Révisions — correction automatique des réponses courtes, sans IA.

// Recalcule une expression simple : chiffres, + - * / × ÷ et parenthèses.
// Renvoie null si l'expression n'est pas de cette forme.
export function calculer(expression) {
  const src = String(expression || "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/,/g, ".")
    .replace(/\s+/g, "");
  if (!src || !/^[\d.+\-*/()]+$/.test(src)) return null;
  let i = 0;
  const lireNombre = () => {
    const m = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (!m) throw new Error("nombre attendu");
    i += m[0].length;
    return Number(m[0]);
  };
  const facteur = () => {
    if (src[i] === "(") {
      i++;
      const v = somme();
      if (src[i++] !== ")") throw new Error(") attendue");
      return v;
    }
    if (src[i] === "-") {
      i++;
      return -facteur();
    }
    return lireNombre();
  };
  const produit = () => {
    let v = facteur();
    while (src[i] === "*" || src[i] === "/") {
      const op = src[i++];
      const d = facteur();
      v = op === "*" ? v * d : v / d;
    }
    return v;
  };
  const somme = () => {
    let v = produit();
    while (src[i] === "+" || src[i] === "-") {
      const op = src[i++];
      const d = produit();
      v = op === "+" ? v + d : v - d;
    }
    return v;
  };
  try {
    const v = somme();
    return i === src.length && Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : null;
  } catch {
    return null;
  }
}

export function lireNombre(texte) {
  const t = String(texte || "").replace(/\s/g, "").replace(",", ".");
  return t === "" || Number.isNaN(Number(t)) ? null : Number(t);
}

// Vérifie le corrigé d'une question « nombre » : l'IA peut se tromper de calcul.
// Renvoie { valeur, douteux } : la valeur de référence et si le corrigé était faux.
export function verifierCorrige(question) {
  const annonce = lireNombre(question.reponse_attendue);
  const recalcule = calculer(question.expression_calcul);
  if (recalcule == null) return { valeur: annonce, douteux: annonce == null };
  if (annonce == null || Math.abs(annonce - recalcule) > 1e-9) return { valeur: recalcule, douteux: true };
  return { valeur: annonce, douteux: false };
}

const normaliserApostrophes = (t) => String(t || "").replace(/[’‘`´]/g, "'");

export function normaliserMot(t) {
  return normaliserApostrophes(t)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "");
}

// Découpe en mots et signes de ponctuation (chaque signe est un élément).
function elements(texte) {
  return normaliserApostrophes(texte)
    .replace(/([,.;:!?])/g, " $1 ")
    .split(/\s+/)
    .filter(Boolean);
}

// Compare une dictée mot à mot (alignement par plus longue sous-suite commune).
// Renvoie { erreurs, morceaux: [{ texte, etat: "ok"|"faux"|"manque"|"en-trop", attendu? }] }
export function comparerDictee(attendu, ecrit) {
  const a = elements(attendu);
  const b = elements(ecrit);
  const n = a.length;
  const m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);

  const morceaux = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      morceaux.push({ texte: b[j], etat: "ok" });
      i++;
      j++;
    } else if (i < n && j < m && L[i + 1][j + 1] >= Math.max(L[i + 1][j], L[i][j + 1])) {
      morceaux.push({ texte: b[j], etat: "faux", attendu: a[i] });
      i++;
      j++;
    } else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) {
      morceaux.push({ texte: b[j], etat: "en-trop" });
      j++;
    } else {
      morceaux.push({ texte: a[i], etat: "manque", attendu: a[i] });
      i++;
    }
  }
  return { erreurs: morceaux.filter((x) => x.etat !== "ok").length, morceaux };
}

// Corrige une réponse courte. Renvoie { juste, attendu, douteux } ou null pour une rédaction.
export function corrigerReponse(question, reponse) {
  switch (question.type) {
    case "nombre": {
      const { valeur, douteux } = verifierCorrige(question);
      const r = lireNombre(reponse);
      return { juste: r != null && valeur != null && Math.abs(r - valeur) < 1e-9, attendu: String(valeur ?? question.reponse_attendue), douteux };
    }
    case "mot":
    case "qcm":
      return { juste: normaliserMot(reponse) === normaliserMot(question.reponse_attendue), attendu: question.reponse_attendue, douteux: false };
    case "dictee": {
      const res = comparerDictee(question.reponse_attendue, reponse);
      return { juste: res.erreurs === 0, attendu: question.reponse_attendue, douteux: false, dictee: res };
    }
    default:
      return null;
  }
}
