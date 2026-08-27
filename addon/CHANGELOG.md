# Changelog — SheetToCsv

## [1.1.0] — 2026-08-27

Version préparée pour la resoumission à la Google Workspace Marketplace, en réponse aux points
soulevés par l'équipe de revue.

### Corrigé
- **Erreur d'autorisation dans le panneau latéral** (erreur constatée par la revue Google) : la
  carte tentait d'accéder au classeur actif avant que l'autorisation par fichier du scope
  `drive.file` ait été accordée. La carte propose désormais un bouton « Autoriser ce classeur »
  (`requestFileScopeForActiveDocument`), et le manifeste déclare `onFileScopeGrantedTrigger`.
- `convertCurrentSheet` ne rouvre plus le classeur actif via `SpreadsheetApp.openById()` — appel
  non couvert par `drive.file`. Le classeur actif est utilisé directement.

### Ajouté
- Bouton « Convertir ce classeur » fonctionnel dans le panneau latéral (auparavant la carte se
  contentait d'un texte renvoyant vers le menu).
- Icônes officielles 128/96/48/32 px, carrées, à fond transparent (`assets/icons/`), générées par
  `tools/make_icons.py`. Même icône dans le manifeste, la carte et la web app.
- Attribution des marques Google (™ + note de bas de page) dans l'application, la web app, la
  politique de confidentialité, les conditions d'utilisation et le README.
- Section « Autorisations OAuth demandées » dans la politique de confidentialité.
- `docs/MARKETPLACE_LISTING.md` (textes de la fiche + checklist) et
  `docs/reponse-google-review.md` (brouillon de réponse à la revue).

### Modifié
- `logoUrl` du manifeste : `structory.ai` → `addon.9l9.org/assets/icons/sheettocsv-128.png`.
- Web app : icône réelle à la place de l'emoji, badge « v2.0 » retiré, liens légaux en pied de page.

## [1.0.0] — 2026-07-28

Version de référence. Publiée après validation Google OAuth et audit complet du code.

### Fonctionnalités
- Conversion de toutes les feuilles d'un Google Sheet en un seul fichier CSV (séparateur `;`, encodage UTF-8 avec BOM).
- Colonne `Feuille d'origine` ajoutée automatiquement pour identifier la source de chaque ligne.
- Feuille `Export_CSV` créée dans le classeur avec horodatage en-tête, ligne d'en-tête figée et colonnes redimensionnées.
- Sélection du fichier via Google Picker (scope `drive.file`, non-sensible) — pas d'accès au Drive entier.
- Compatible WebApp standalone et add-on Google Sheets.

### Corrections apportées lors de l'audit v1.0
- **Bug cellules multi-lignes** : suppression de `parseCsvToArray` qui cassait les cellules contenant `\n` (découpage naïf sur `\n` avant parsing des guillemets). Remplacement par passage direct du tableau `rows` à `writeExportSheet`.
- **Bug heure UTC** : `getFrenchDateTime` utilisait `getHours()` (UTC). Remplacé par `Utilities.formatDate` + `Session.getScriptTimeZone()`.
- **Bug `isSheetEmpty` incomplet** : l'ancienne version ne détectait pas les feuilles à plusieurs lignes toutes vides. Corrigé avec `.every(row => row.every(...))`.
- **Conseil dangereux dans `buildPermissionError`** : le message invitait à partager le fichier publiquement. Remplacé par un message neutre.
- **Crash `doPost` sur `url` absent** : aucune garde sur `e.parameter.url`. Guard ajouté.
- **`onInstall` manquant** : le menu n'apparaissait pas après la première installation. `onInstall` ajouté.
- **Picker bloqué sur action inattendue** : `pickerCallback` ne réinitialisait pas le bouton pour les actions hors `PICKED`/`CANCEL`. `else { setLoading(false); }` ajouté.
- **Fuite mémoire `URL.createObjectURL`** : l'URL objet du blob CSV n'était jamais révoquée. Révocation ajoutée dans `setStatus` et 2 s après le clic de téléchargement.
- **Régression lignes vides** : l'audit avait uniformément filtré les lignes vides sur toutes les feuilles. Comportement corrigé : la première feuille conserve ses lignes vides (lignes séparatrices intentionnelles) ; les feuilles suivantes filtrent les lignes entièrement vides.

### Périmètre de validation
- Vérification Google OAuth approuvée (scopes `drive.file`, `script.container.ui`).
- Suite de tests manuels (`Tests.js`) couvrant : RFC 4180, Unicode, émojis, feuilles vides, colonnes inégales, MAX_SHEETS, padding, horodatage, erreurs de permission.
