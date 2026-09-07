# Fiche Google Workspace Marketplace — SheetToCsv

Textes et ressources à recopier **tels quels** dans le Google Workspace Marketplace SDK
(Google Cloud Console → APIs & Services → Google Workspace Marketplace SDK → onglet
*Store Listing*). Chaque section répond à un point soulevé par l'équipe de revue.

---

## 1. Nom de l'application

```
SheetToCsv
```

> ⚠️ **À vérifier en priorité.** Les courriels de revue désignent l'application sous le nom
> **« SheetToCsc »** (avec un `c`). Si c'est bien la valeur saisie dans le SDK, c'est une faute
> de frappe à corriger : le nom de la fiche doit être identique au nom du module complémentaire
> dans `addon/appsscript.json` (`addOns.common.name` = `SheetToCsv`) et au nom affiché sur
> l'écran de consentement OAuth.

---

## 2. Description courte

À coller dans le champ *Short description* (une seule phrase, sans emoji, sans superlatif) :

```
Exporte toutes les feuilles d'un classeur Google Sheets™ dans un seul fichier CSV.
```

Version anglaise, si la fiche est publiée en anglais :

```
Export every tab of a Google Sheets™ spreadsheet into a single CSV file.
```

---

## 3. Description détaillée

À coller dans le champ *Detailed description*. Elle commence par une phrase qui dit ce que
fait l'application, puis détaille les fonctionnalités, puis les autorisations, et se termine
par la mention légale des marques Google. Aucun témoignage utilisateur, aucun texte
promotionnel non vérifiable.

```
SheetToCsv réunit toutes les feuilles d'un classeur Google Sheets™ dans un seul fichier CSV,
en une seule action, sans copier-coller manuel.

Fonctionnement
1. Ouvrez un classeur dans Google Sheets™.
2. Ouvrez SheetToCsv dans le panneau latéral, puis autorisez l'accès à ce classeur.
3. Cliquez sur « Convertir ce classeur ».
4. SheetToCsv ajoute au classeur une feuille nommée Export_CSV contenant les données
   consolidées de toutes les feuilles, que vous téléchargez ensuite au format CSV via
   Fichier > Télécharger > Valeurs séparées par des virgules (.csv).

Fonctionnalités
• Consolidation de toutes les feuilles d'un classeur dans un seul tableau.
• Colonne « Feuille d'origine » ajoutée automatiquement à chaque ligne, pour savoir de quelle
  feuille provient la donnée.
• Format conforme à la norme CSV RFC 4180 : les cellules contenant un point-virgule, un
  guillemet ou un retour à la ligne sont correctement échappées.
• Encodage UTF-8 : les accents, les caractères non latins et les émojis sont préservés.
• Séparateur point-virgule, compatible avec les tableurs configurés en français.
• Horodatage de l'export inscrit en première ligne de la feuille Export_CSV.
• Les feuilles vides sont ignorées ; jusqu'à 30 feuilles et 10 000 lignes par feuille.

Autorisations demandées
• Accès par fichier (drive.file) : SheetToCsv ne peut lire et modifier que le classeur que
  vous ouvrez explicitement avec l'application. Il n'a aucun accès au reste de votre
  Google Drive™.
• Affichage de l'interface (script.container.ui) : nécessaire pour afficher le panneau
  latéral et le menu de l'application dans Google Sheets™.
• Appels sortants (script.external_request) : nécessaire à l'application web, qui lit et
  écrit le classeur choisi via l'API Google Sheets™. Les appels sortants sont limités à
  cette seule adresse.

Le contenu de vos feuilles est traité pendant la conversion puis écrit dans votre propre
classeur. Aucune donnée de feuille de calcul n'est transmise à un serveur tiers ni conservée
par l'éditeur.

Confidentialité : https://addon.9l9.org/privacy.html
Conditions d'utilisation : https://addon.9l9.org/terms.html
Support : larose75@9l9.org

Google Sheets™, Google Drive™ et Google Workspace™ sont des marques de Google LLC.
SheetToCsv est une application indépendante, non affiliée à Google LLC, ni approuvée ou
sponsorisée par Google LLC.
```

Version anglaise :

```
SheetToCsv merges every tab of a Google Sheets™ spreadsheet into a single CSV file in one
click, with no manual copy and paste.

How it works
1. Open a spreadsheet in Google Sheets™.
2. Open SheetToCsv in the side panel and grant access to this spreadsheet.
3. Click "Convert this spreadsheet".
4. SheetToCsv adds an Export_CSV tab holding the consolidated data from every sheet, which
   you then download as CSV from File > Download > Comma-separated values (.csv).

Features
• Consolidates every tab of a spreadsheet into one table.
• Adds a "Source sheet" column to each row so you always know where the data came from.
• RFC 4180 compliant output: cells containing a separator, a quote or a line break are
  escaped correctly.
• UTF-8 encoding: accents, non-Latin characters and emoji are preserved.
• Semicolon separator, compatible with European spreadsheet settings.
• Export timestamp written on the first row of the Export_CSV sheet.
• Empty sheets are skipped; up to 30 sheets and 10,000 rows per sheet.

Permissions requested
• Per-file access (drive.file): SheetToCsv can only read and edit the spreadsheet you
  explicitly open it with. It has no access to the rest of your Google Drive™.
• User interface (script.container.ui): required to display the side panel and the menu
  inside Google Sheets™.
• Outbound requests (script.external_request): required by the companion web app, which
  reads and writes the selected spreadsheet through the Google Sheets™ API. Outbound calls
  are restricted to that single address.

Your spreadsheet content is processed during the conversion and written back into your own
spreadsheet. No spreadsheet data is sent to a third-party server or retained by the developer.

Privacy policy: https://addon.9l9.org/privacy.html
Terms of service: https://addon.9l9.org/terms.html
Support: larose75@9l9.org

Google Sheets™, Google Drive™ and Google Workspace™ are trademarks of Google LLC.
SheetToCsv is an independent application, not affiliated with, endorsed or sponsored by
Google LLC.
```

---

## 4. Icônes

Générées par `tools/make_icons.py`, PNG carrés, fond transparent, publiées sur le domaine du
projet :

| Taille | Fichier | URL publique | Usage |
| :--- | :--- | :--- | :--- |
| 128 × 128 | `assets/icons/sheettocsv-128.png` | https://addon.9l9.org/assets/icons/sheettocsv-128.png | Fiche Marketplace (obligatoire), écran de consentement OAuth, `logoUrl` du manifeste |
| 96 × 96 | `assets/icons/sheettocsv-96.png` | https://addon.9l9.org/assets/icons/sheettocsv-96.png | Obligatoire car l'application inclut une web app |
| 48 × 48 | `assets/icons/sheettocsv-48.png` | https://addon.9l9.org/assets/icons/sheettocsv-48.png | Obligatoire car l'application inclut une web app |
| 32 × 32 | `assets/icons/sheettocsv-32.png` | https://addon.9l9.org/assets/icons/sheettocsv-32.png | Fiche Marketplace (obligatoire) |

La **même** icône doit être propagée à trois endroits, comme demandé par l'équipe de revue :

1. **Fiche Marketplace** — Marketplace SDK → *Store Listing* → *Application icon* : téléverser
   `sheettocsv-128.png` et `sheettocsv-32.png` (plus 96 et 48).
2. **Écran de consentement OAuth** — Cloud Console → *APIs & Services* → *OAuth consent screen*
   → *App logo* : téléverser `sheettocsv-128.png`.
3. **L'application elle-même** — déjà fait :
   - `addon/appsscript.json` → `addOns.common.logoUrl` pointe sur l'URL 128 px ;
   - la carte du panneau latéral affiche cette icône (`ADDON_ICON_URL` dans `addon/Code.js`) ;
   - la web app affiche l'icône 48 px en en-tête (`addon/Index.html`).

> ⚠️ L'ancienne valeur de `logoUrl` était `https://structory.ai/logo-sheettocsv.png`, un domaine
> différent de celui de la fiche. Vérifiez que les fichiers ci-dessus sont bien servis par
> `addon.9l9.org` (GitHub Pages du dépôt, cf. `CNAME`) avant de resoumettre : une icône en 404
> apparaît comme une icône manquante à la revue.

---

## 5. Attribution des marques Google

Règle appliquée : chaque mention d'un produit Google porte le symbole ™ à sa **première
occurrence dans le texte visible**, et une note de bas de page rappelle la propriété des marques.

Note de bas de page (déjà en place dans la description détaillée, la politique de
confidentialité, les conditions d'utilisation, la carte du panneau latéral et la web app) :

```
Google Sheets™, Google Drive™ et Google Workspace™ sont des marques de Google LLC.
SheetToCsv est une application indépendante, non affiliée à Google LLC, ni approuvée ou
sponsorisée par Google LLC.
```

Référence : https://developers.google.com/workspace/marketplace/terms/branding#giving_proper_attribution

---

## 6. Points restants côté console (hors dépôt)

État au 7 septembre 2026. Le code est déployé en **version 26** sur le déploiement
`AKfycbwAB9uJ17VdmnIuXV9Fc1ClORI4QWOe-hfYhUvjpGX36CZIrEEvL3-5OnocHtYEB75c`.

### Fait

- [x] **Déploiement du script.** `clasp push` + nouveau déploiement, version 26.
      L'ancienne version en ligne datait de juillet et ne contenait aucun des correctifs.
- [x] **Icônes servies publiquement.** `https://addon.9l9.org/assets/icons/` répond ; le
      `logoUrl` du manifeste pointait auparavant vers une URL en 404.
- [x] **Cohérence « Premium ».** `privacy.html` et `terms.html` ne décrivent plus d'abonnement
      payant, de paiement Stripe ni de collecte d'adresse email — l'application n'en comporte
      aucun. Les deux pages sont publiées.
- [x] **Autorisation par fichier de bout en bout.** Panneau latéral et web app fonctionnent
      sans jamais demander le scope large `.../auth/spreadsheets`.

### À faire dans la console

- [ ] Corriger le nom de l'application si la fiche indique « SheetToCsc ».
- [ ] Coller la description courte et la description détaillée (section 2 de ce document).
- [ ] Téléverser les quatre icônes, et la même icône sur l'écran de consentement OAuth.
- [ ] Vérifier les captures d'écran de la fiche : elles doivent montrer l'interface réelle
      (panneau latéral avec le bouton « Autoriser ce classeur » puis « Convertir ce classeur »).
- [x] **Numéro de version de la fiche : 26.** Il indiquait 15, c'est-à-dire la version de juillet :
      tous les correctifs suivants étaient invisibles pour la revue.
- [x] **Autorisations OAuth de la fiche corrigées.** Le SDK Marketplace déclarait
      `.../auth/spreadsheets`, l'accès à tous les classeurs de l'utilisateur — la cause du refus.
      Remplacé par `.../auth/drive.file`. `userinfo.email` et `userinfo.profile` restent : Google
      les impose par défaut et ils ne peuvent pas être retirés.
- [ ] Enregistrer la vidéo de démonstration et remplacer `[LIEN VIDÉO À METTRE À JOUR]` dans
      `docs/reponse-google-review.md`.
- [ ] Envoyer la réponse à `gwm-review@google.com` (brouillon dans
      `docs/reponse-google-review.md`), **après** les points ci-dessus.

### Sécurité, indépendant de la revue

- [ ] **Faire tourner la clé Picker.** L'ancienne valeur a été committée puis retirée du code,
      mais reste lisible dans l'historique Git. Créer une nouvelle clé API restreinte à
      Google Picker API, la placer dans les propriétés du script sous `PICKER_API_KEY`,
      vérifier le fonctionnement, **puis supprimer l'ancienne clé** dans Cloud Console.
      Tant que l'ancienne n'est pas supprimée, la fuite reste exploitable.
