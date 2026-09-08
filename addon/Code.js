// ================================================================
// SheetToCsv — Convertisseur Google Sheets → CSV
// ================================================================

const CSV_SEPARATOR    = ';';
const MAX_SHEETS       = 30;
const MAX_ROWS_PER_SHEET = 10000;
const EXPORT_SHEET_NAME  = 'Export_CSV';

// Icône officielle : identique à la fiche Marketplace, à l'écran de consentement
// OAuth et à l'interface de l'application.
const ADDON_ICON_URL = 'https://addon.9l9.org/assets/icons/sheettocsv-128.png';

// ── Points d'entrée ───────────────────────────────────────────────

function doGet() {
  // La clé Picker API n'est PAS codée en dur dans le dépôt : elle est stockée
  // dans les Script Properties et injectée dans le template au moment du rendu.
  // Configuration (une seule fois) :
  //   Éditeur Apps Script → Paramètres du projet → Propriétés du script
  //   → ajouter PICKER_API_KEY = <clé restreinte à Google Picker API>
  const template = HtmlService.createTemplateFromFile('Index');
  template.pickerApiKey =
    PropertiesService.getScriptProperties().getProperty('PICKER_API_KEY') || '';

  return template
    .evaluate()
    .setTitle('SheetToCsv')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

function doPost(e) {
  const url = e && e.parameter && e.parameter.url;
  if (!url) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Paramètre url manquant.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService
    .createTextOutput(JSON.stringify(processSheet(url)))
    .setMimeType(ContentService.MimeType.JSON);
}

// OAuth token pour le Picker (scope drive.file)
function getOAuthToken() {
  return ScriptApp.getOAuthToken();
}

// ── Add-on : menu et cartes ──────────────────────────────────────

function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('SheetToCsv')
    .addItem('Convertir ce classeur en CSV', 'convertCurrentSheet')
    .addToUi();
}

// Sans onInstall, le menu n'apparaît pas lors de la première installation
// (il faudrait rouvrir le classeur).
function onInstall(e) {
  onOpen(e);
}

// ── Carte du panneau latéral (Google Workspace Add-on) ───────────
//
// Avec le scope drive.file, le module complémentaire n'a accès au classeur
// ouvert qu'après une autorisation par fichier accordée par l'utilisateur.
// Tant que cette autorisation n'est pas donnée, toute lecture du classeur
// échoue : la carte doit donc proposer le bouton d'autorisation, et non
// tenter la conversion directement.

function onHomepage(e) {
  const hasFileAccess = !!(e && e.sheets && e.sheets.addonHasFileScopePermission);
  return hasFileAccess ? buildReadyCard() : buildAuthorizationCard();
}

// Déclenché par Google une fois que l'utilisateur a autorisé le fichier courant.
// Ce trigger doit renvoyer un Card, pas un Navigation : c'est un déclencheur
// contextuel, pas la réponse à un clic. Renvoyer un Navigation laissait la
// carte bloquée sur l'écran d'autorisation apres que l'utilisateur ait
// pourtant accorde l'acces — le symptome meme signale par la revue Google.
function onFileScopeGranted(e) {
  return buildReadyCard();
}

// Demande l'accès au seul classeur actuellement ouvert (scope drive.file).
function requestFileScope(e) {
  return CardService.newEditorFileScopeActionResponseBuilder()
    .requestFileScopeForActiveDocument()
    .build();
}

function buildCardHeader() {
  return CardService.newCardHeader()
    .setTitle('SheetToCsv')
    .setSubtitle('Toutes les feuilles en un seul fichier CSV')
    .setImageUrl(ADDON_ICON_URL);
}

function buildAuthorizationCard() {
  return CardService.newCardBuilder()
    .setHeader(buildCardHeader())
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newTextParagraph().setText(
            'SheetToCsv rassemble toutes les feuilles de ce classeur dans un ' +
            'seul fichier CSV, avec une colonne indiquant la feuille d\'origine.'
          )
        )
        .addWidget(
          CardService.newTextParagraph().setText(
            '<b>Accès requis :</b> autorisez SheetToCsv à accéder à <b>ce classeur ' +
            'uniquement</b>. Aucun autre fichier de votre Google Drive\u2122 n\'est lu.'
          )
        )
        .addWidget(
          CardService.newTextButton()
            .setText('Autoriser ce classeur')
            .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
            .setOnClickAction(CardService.newAction().setFunctionName('requestFileScope'))
        )
    )
    .addSection(buildTrademarkSection())
    .build();
}

function buildReadyCard(message) {
  const section = CardService.newCardSection();

  if (message) {
    section.addWidget(CardService.newTextParagraph().setText(message));
  } else {
    section.addWidget(
      CardService.newTextParagraph().setText(
        'Cliquez sur Convertir : une feuille <b>Export_CSV</b> est ajoutée à ce ' +
        'classeur avec toutes les données consolidées, prête à être téléchargée ' +
        'en CSV depuis Fichier &gt; Télécharger.'
      )
    );
  }

  section.addWidget(
    CardService.newTextButton()
      .setText('Convertir ce classeur')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(CardService.newAction().setFunctionName('convertFromCard'))
  );

  return CardService.newCardBuilder()
    .setHeader(buildCardHeader())
    .addSection(section)
    .addSection(buildTrademarkSection())
    .build();
}

// Attribution des marques Google exigée par les règles de la Marketplace.
function buildTrademarkSection() {
  return CardService.newCardSection().addWidget(
    CardService.newTextParagraph().setText(
      '<font color="#94a3b8"><i>Google Sheets\u2122, Google Drive\u2122 et Google ' +
      'Workspace\u2122 sont des marques de Google LLC. SheetToCsv est une ' +
      'application indépendante, non affiliée à Google LLC.</i></font>'
    )
  );
}

// Conversion depuis la carte du panneau latéral.
function convertFromCard(e) {
  const result = convertActiveSpreadsheet(e);

  if (!result.success) {
    // Sans autorisation par fichier, on renvoie la carte d'autorisation, pas
    // la carte de conversion : cette derniere ne porte aucun bouton
    // « Autoriser ce classeur », et l'utilisateur restait bloque devant un
    // message lui demandant de cliquer sur un bouton absent de l'ecran.
    const card = result.needsFileScope
      ? buildAuthorizationCard()
      : buildReadyCard('<b>Échec de la conversion.</b><br>' + result.error);

    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(result.error))
      .setNavigation(CardService.newNavigation().updateCard(card))
      .build();
  }

  const summary =
    '<b>Conversion réussie.</b><br>' +
    'Feuilles traitées : ' + result.sheetCount + '<br>' +
    'Lignes exportées : ' + result.rowCount + '<br>' +
    'Feuille ajoutée : « ' + result.sheetName + ' »<br><br>' +
    'Téléchargez le CSV via Fichier &gt; Télécharger &gt; Valeurs séparées par des virgules.';

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Conversion réussie.'))
    .setNavigation(CardService.newNavigation().updateCard(buildReadyCard(summary)))
    .build();
}

// Conversion depuis le menu de la feuille de calcul.
function convertCurrentSheet() {
  const result = convertActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  if (result.success) {
    ui.alert(
      'Conversion réussie',
      result.sheetCount + ' feuille(s) exportée(s)\n' +
      result.rowCount + ' ligne(s) traitée(s)\n' +
      'Feuille créée : "' + result.sheetName + '"',
      ui.ButtonSet.OK
    );
  } else {
    ui.alert('Erreur', result.error || 'Erreur inconnue', ui.ButtonSet.OK);
  }
}

// Point d'entrée commun aux deux interfaces du module complémentaire.
//
// Le classeur actif est utilisé directement : le scope drive.file autorise
// SheetToCsv sur le fichier ouvert, mais PAS sur une réouverture par
// identifiant via SpreadsheetApp.openById(), qui échouait avec une erreur
// d'autorisation.
function convertActiveSpreadsheet(e) {
  let spreadsheet;

  // Deux contextes d'execution, deux facons d'atteindre le classeur.
  //
  // 1. Panneau lateral (module Workspace) : le script n'est lie a aucun
  //    document, SpreadsheetApp.getActiveSpreadsheet() ne renvoie rien. Google
  //    transmet l'identifiant du document ouvert dans l'objet d'evenement, et
  //    c'est par la qu'il faut passer. L'autorisation par fichier accordee via
  //    requestFileScopeForActiveDocument() couvre l'ouverture de ce seul
  //    fichier : aucun scope large n'est necessaire.
  //
  // 2. Menu SheetToCsv de la feuille : la, le script s'execute bien dans le
  //    contexte du classeur, et getActiveSpreadsheet() est la bonne methode.
  const sheetsEvent = e && e.sheets;

  if (sheetsEvent && sheetsEvent.id) {
    if (sheetsEvent.addonHasFileScopePermission === false) {
      return buildFileScopeError();
    }
    try {
      spreadsheet = SpreadsheetApp.openById(sheetsEvent.id);
    } catch (err) {
      console.error('Ouverture par identifiant refusee :', err.message);
      return buildFileScopeError();
    }
  } else {
    try {
      spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    } catch (err) {
      return buildFileScopeError();
    }
  }

  if (!spreadsheet) return buildFileScopeError();

  return processSpreadsheet(spreadsheet);
}

function buildFileScopeError() {
  return {
    success: false,
    // Distingue ce cas des autres echecs : lui seul se resout par le bouton
    // d'autorisation, et la carte renvoyee doit donc etre celle qui le porte.
    needsFileScope: true,
    error: 'SheetToCsv n\'a pas encore accès à ce classeur. ' +
           'Cliquez sur « Autoriser ce classeur » ci-dessous.'
  };
}

// ── Traitement principal ──────────────────────────────────────────

function processSheet(url) {
  try {
    if (!url || !url.includes('docs.google.com/spreadsheets/d/')) {
      throw new Error('URL invalide. Veuillez fournir une URL de Google Sheet valide.');
    }

    const sheetId = extractSheetId(url);
    if (!sheetId) throw new Error('Impossible d\'extraire l\'identifiant du classeur.');

    // Conversion par URL desactivee. Elle rouvrait le classeur choisi dans le
    // Picker, ce qui exige soit le scope large .../auth/spreadsheets, soit un
    // appel sortant vers l'API Sheets (scope script.external_request). La
    // console Marketplace refuse de valider le second et le premier est celui
    // que la revue Google a demande de retirer. Le module complementaire, lui,
    // travaille sur le classeur actif : il n'a besoin ni de l'un ni de l'autre.
    return {
      success: false,
      error: 'La conversion par URL est momentanement indisponible.\n\n' +
             'Ouvrez votre classeur dans Google Sheets\u2122, puis SheetToCsv ' +
             'dans le panneau lateral : la conversion y fonctionne normalement.'
    };

  } catch (error) {
    console.error('Erreur processSheet:', error.message);
    return { success: false, error: error.message || 'Une erreur inconnue est survenue.' };
  }
}

// Conversion d'un classeur déjà ouvert (add-on) ou résolu depuis une URL (web app).
function processSpreadsheet(spreadsheet) {
  try {
    const { rows, sheetCount } = readAllSheets(spreadsheet);
    if (!rows.length) throw new Error('Aucune donnée trouvée dans les feuilles.');

    const csvContent = generateCsv(rows);
    const sheetName  = writeExportSheet(spreadsheet, rows);

    return {
      success: true,
      sheetCount,
      rowCount: rows.length - 1, // en-tête exclu
      sheetName,
      csvContent
    };

  } catch (error) {
    console.error('Erreur processSpreadsheet:', error.message);
    return { success: false, error: error.message || 'Une erreur inconnue est survenue.' };
  }
}

// ── Extraction de l'ID ────────────────────────────────────────────

function extractSheetId(url) {
  const patterns = [
    /\/d\/([a-zA-Z0-9-_]+)/,
    /spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /key=([a-zA-Z0-9-_]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ── Lecture des feuilles ──────────────────────────────────────────

function readAllSheets(spreadsheet) {
  const sheets = spreadsheet.getSheets().slice(0, MAX_SHEETS);
  const rows = [];
  let sheetCount = 0;
  let headerAdded = false;

  for (const sheet of sheets) {
    const name = sheet.getName();
    if (name === EXPORT_SHEET_NAME) continue;

    const values = sheet.getDataRange().getDisplayValues();
    if (isSheetEmpty(values)) continue;

    sheetCount++;

    if (!headerAdded) {
      // La ligne d'en-tête de la première feuille devient l'en-tête global,
      // précédée d'une colonne "Feuille d'origine".
      rows.push(['Feuille d\'origine', ...(values[0] || [])]);
      headerAdded = true;

      // Première feuille : toutes les lignes de données sont conservées telles quelles,
      // y compris les lignes vides intentionnelles (lignes séparatrices).
      const dataRows = values.slice(1, MAX_ROWS_PER_SHEET + 1);
      for (const row of dataRows) {
        rows.push([name, ...row]);
      }
    } else {
      // Feuilles suivantes : les lignes entièrement vides sont ignorées
      // (évite de polluer le CSV consolidé avec des blocs vides inter-feuilles).
      const dataRows = values.slice(1, MAX_ROWS_PER_SHEET + 1)
                             .filter(row => row.some(cell => cell !== ''));
      for (const row of dataRows) {
        rows.push([name, ...row]);
      }
    }
  }

  if (!headerAdded) throw new Error('Aucune feuille valide trouvée.');
  return { rows, sheetCount };
}

function isSheetEmpty(values) {
  return !values || values.length === 0 ||
         values.every(row => row.every(cell => cell === ''));
}

// ── Génération CSV ────────────────────────────────────────────────

function generateCsv(rows) {
  return rows.map(row =>
    row.map(cell => {
      const s = (cell === null || cell === undefined) ? '' : String(cell);
      // Guillemets obligatoires si la cellule contient le séparateur, des guillemets
      // ou un retour à la ligne (RFC 4180).
      if (s.includes('"') || s.includes(CSV_SEPARATOR) || s.includes('\n') || s.includes('\r')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }).join(CSV_SEPARATOR)
  ).join('\n');
}

// ── Écriture de la feuille d'export ──────────────────────────────

function writeExportSheet(spreadsheet, rows) {
  const existing = spreadsheet.getSheetByName(EXPORT_SHEET_NAME);
  if (existing) {
    try { spreadsheet.deleteSheet(existing); } catch (e) {
      console.warn('Suppression feuille existante : ' + e.message);
    }
  }

  const numCols = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (numCols === 0) throw new Error('Les données sont vides.');

  const sheet = spreadsheet.insertSheet(EXPORT_SHEET_NAME);
  const dateTime = getFrenchDateTime();

  // Ligne 1 : horodatage de l'export
  const dateRow = new Array(numCols).fill('');
  dateRow[0] = 'Export généré le ' + dateTime;

  // Lignes suivantes : données (padder les lignes plus courtes que numCols)
  const allData = [dateRow, ...rows.map(row => {
    const padded = row.slice();
    while (padded.length < numCols) padded.push('');
    return padded;
  })];

  sheet.getRange(1, 1, allData.length, numCols).setValues(allData);

  // Ligne de titre : fond bleu clair, gras, centrée, fusionnée
  const titleRange = sheet.getRange(1, 1, 1, numCols);
  titleRange.setFontWeight('bold')
            .setBackground('#e8f4fd')
            .setFontColor('#1a5a8a')
            .setHorizontalAlignment('center');
  if (numCols > 1) titleRange.merge();

  // Ligne d'en-tête : fond gris clair, gras
  sheet.getRange(2, 1, 1, numCols).setFontWeight('bold').setBackground('#f0f4f8');

  // Auto-resize limité à 20 colonnes (quota Apps Script)
  const colsToResize = Math.min(numCols, 20);
  for (let col = 1; col <= colsToResize; col++) {
    sheet.autoResizeColumn(col);
  }

  sheet.setFrozenRows(2);
  return EXPORT_SHEET_NAME;
}

// ── Utilitaires ───────────────────────────────────────────────────

function getFrenchDateTime() {
  const tz   = Session.getScriptTimeZone();
  const now  = new Date();
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const mois  = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  // Valeurs numériques dans le bon fuseau horaire
  const s = Utilities.formatDate(now, tz, 'yyyy-MM-dd-HH-mm-ss');
  const [annee, mm, dd, HH, min, sec] = s.split('-');

  // Jour de la semaine déduit de la date locale (getDay() sur l'objet Date ne dépend
  // que de la date calendaire, pas du fuseau horaire de l'heure courante).
  const dayIdx = new Date(parseInt(annee), parseInt(mm) - 1, parseInt(dd)).getDay();

  return `${jours[dayIdx]} ${dd} ${mois[parseInt(mm) - 1]} ${annee} à ${HH}h${min}m${sec}s`;
}
