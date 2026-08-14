# SheetToCsv — mémoire de reprise

## TÂCHE EN COURS

### 🎯 Prochain point de départ
Déployer le fix Picker origin et tester : `cd ~/projects/sheettocsv && clasp push --force && clasp deploy -i AKfycbwAB9uJ17VdmnIuXV9Fc1ClORI4QWOe-hfYhUvjpGX36CZIrEEvL3-5OnocHtYEB75c -d "Fix Picker origin setOrigin(google.script.host.origin)"`, puis demander à Stéphane de recharger la webapp et tester le Picker. Si ça fonctionne, envoyer la réponse à Google.

### Décisions prises
- Passage de `spreadsheets` (sensible) à `drive.file` (non-sensible) via Picker API — évite l'audit CASA annuel.
- `executeAs: USER_ACCESSING` + `access: ANYONE` — requis pour le consentement Picker par utilisateur, corrige aussi le bug où tout tournait avec les credentials du développeur.
- Picker pré-pointé sur le fichier via `setFileIds(fileId)` — préserve l'UX "coller une URL" avec un seul clic de confirmation supplémentaire.
- Clé Picker API créée dans Cloud Console, restreinte à "Google Picker API" uniquement : `AIzaSyARbDCnqpIaX9wSW22390S5ZVcaXQJV-ZQ`.

### Ce qui vient d'être fait
- `appsscript.json` : `executeAs USER_ACCESSING`, `access ANYONE`, scopes `drive.file` + `script.container.ui`.
- `Code.js` : ajout de `getOAuthToken()`.
- `Index.html` : flux Picker complet (openPicker, pickerCallback, note de confidentialité verte) + fix `.setOrigin(google.script.host.origin)` appliqué **localement** — pas encore déployé.
- `structory.ai` : sections confidentialité (partage + protection) ajoutées 9 langues, vocabulaire AI/ML retiré 9 langues, section apps redesignée, anti-traduction Chrome ajouté — **déployé sur Cloudflare**.

### Ce qui reste à faire (ordre de priorité)
1. `clasp push --force` + `clasp deploy -i <deploymentId>` (voir prochain point de départ) → tester Picker.
2. Envoyer réponse à Google : (1) privacy OK, (2) pas d'IA dans le code, (3) confirmer drive.file via Picker.
3. Soumettre à nouveau dans Cloud Console.
4. MergeSheet OAuth — en attente validation SheetToCsv d'abord.

### Fichiers / contexte clés
- `~/projects/sheettocsv/Index.html` — fix setOrigin appliqué localement, à déployer.
- `~/projects/sheettocsv/appsscript.json` — scopes et executeAs déjà corrects.
- `~/projects/sheettocsv/Code.js` — getOAuthToken() ajouté.
- Deployment ID prod : `AKfycbwAB9uJ17VdmnIuXV9Fc1ClORI4QWOe-hfYhUvjpGX36CZIrEEvL3-5OnocHtYEB75c` (@12).
- Picker API key : `AIzaSyARbDCnqpIaX9wSW22390S5ZVcaXQJV-ZQ` (déjà dans Index.html).
- GCP project : `focused-brand-454315-s8`.
- Token Cloudflare : `~/.config/cloudflare/splaissy.token`.
- `/home/ubuntu/analyzor/org_routing.json` — source unique de vérité dossier→orgId pour `/rep`.
