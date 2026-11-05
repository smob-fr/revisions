# Révisions

Application web installable (PWA) qui génère des exercices de révision conformes aux
programmes officiels, avec corrigés expliqués. Première version pour la famille :
**CE1** (français, maths) et **Terminale** (philosophie, HLP, SVT, formats du bac 2027).

- **Exercices** : créés par l'IA (Claude) à partir des fiches leçons du dossier `app/referentiel/`.
- **Correction** : automatique pour les nombres, mots, QCM et dictées (le calcul est recalculé
  pour détecter un corrigé faux) ; commentée par l'IA pour les rédactions de Terminale,
  y compris à partir d'une photo de la copie.
- **Données** : profils (prénom + classe) et historique stockés uniquement sur l'appareil.
- **Installation** : iPhone → Safari, « Ajouter à l'écran d'accueil » ; Android → Chrome,
  « Installer l'application ».

## Lancer en local

```bash
npm install
npm run demo      # sans clé API : exercices d'exemple, pour tester l'interface
```

Avec l'IA (une clé API Anthropic est nécessaire) :

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # PowerShell : $env:ANTHROPIC_API_KEY="sk-ant-..."
npm run dev
```

puis ouvrir http://localhost:8000. Pour tester depuis un téléphone sur le même Wi-Fi,
ouvrir `http://<adresse-du-PC>:8000` (la synthèse vocale et l'appareil photo demandent
HTTPS hors `localhost` : à tester plutôt sur la version en ligne).

Tests : `npm test`.

## Organisation

- `app/` — l'appli statique (sans étape de build), servie telle quelle
  - `js/app.js` — écrans profil → matière → leçon → réglages
  - `js/seance.js` — séance : questions, indices, correction, bilan
  - `js/correction.js` — correction automatique (calcul, dictée mot à mot)
  - `js/parole.js` — lecture à voix haute et dictée (voix de l'appareil)
  - `js/api.js` — appels au serveur ; **renseigner `URL_FONCTION` pour la mise en ligne**
  - `referentiel/` — fiches leçons par niveau et matière (**brouillon à relire**)
- `supabase/functions/_shared/ia.js` — consignes données à l'IA, format des exercices, appels à l'API
- `supabase/functions/exercices/` — fonction Supabase qui garde la clé API côté serveur
- `dev-server.mjs` — serveur local (appli + mêmes routes que la fonction Supabase)

## Mise en ligne

1. **Fonction Supabase** (garde la clé API hors de l'appli) :
   ```bash
   supabase functions deploy exercices --no-verify-jwt
   ```
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-... CODE_FAMILLE=<un-code-a-choisir>
   ```
2. Mettre l'adresse de la fonction dans `URL_FONCTION` (`app/js/api.js`).
3. Publier le dossier `app/` sur GitHub Pages, comme suivi-piano.
4. Sur chaque appareil : Réglages (roue dentée) → saisir le code famille.

Prévoir un plafond de dépense mensuel sur la clé API dans la console Anthropic.

## Modèle et coût

Modèle : `claude-opus-5-5` (4 $ / 20 $ par million de jetons en entrée / sortie), avec
repli automatique sur un autre modèle en cas de refus. Effort `medium` pour la génération,
`high` pour la correction des rédactions. Le coût réel par exercice reste à mesurer.

## À faire ensuite

- Relire les fiches du référentiel (CE1 avec les repères annuels Éduscol, Terminale avec les programmes).
- Tester la génération réelle sur chaque matière et noter les erreurs.
- Garder les exercices validés dans une banque pour les réutiliser sans appeler l'IA.
- Lot 2 : Grand oral, CE2 pour la rentrée 2027.
