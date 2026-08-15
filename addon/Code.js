// ================================================================
// SheetToCsv — Convertisseur Google Sheets → CSV
// ================================================================

const CSV_SEPARATOR    = ';';
const MAX_SHEETS       = 30;
const MAX_ROWS_PER_SHEET = 10000;
const EXPORT_SHEET_NAME  = 'Export_CSV';

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

// ── Add-on : menu et carte ────────────────────────────────────────

function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('SheetToCsv')
    .addItem('🔄 Convertir ce classeur', 'convertCurrentSheet')
    .addToUi();
}

// Sans onInstall, le menu n'apparaît pas lors de la première installation
// (il faudrait rouvrir le classeur).
function onInstall(e) {
  onOpen(e);
}

function onHomepage(e) {
  return CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('SheetToCsv')
        .setSubtitle('Convertit toutes les feuilles en un seul CSV')
    )
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newTextParagraph()
            .setText('Ouvrez un classeur Google Sheets et utilisez le menu SheetToCsv pour convertir toutes les feuilles en un seul fichier CSV.')
        )
    )
    .build();
}

function convertCurrentSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const url = 'https://docs.google.com/spreadsheets/d/' + spreadsheet.getId();
  const result = processSheet(url);
  const ui = SpreadsheetApp.getUi();
  if (result.success) {
    ui.alert(
      '✅ Conversion réussie !',
      `📊 ${result.sheetCount} feuilles exportées\n📝 ${result.rowCount} lignes traitées\n📁 Feuille créée : "${result.sheetName}"`,
      ui.ButtonSet.OK
    );
  } else {
    ui.alert('❌ Erreur', result.error || 'Erreur inconnue', ui.ButtonSet.OK);
  }
}

// ── Traitement principal ──────────────────────────────────────────

function processSheet(url) {
  try {
    if (!url || !url.includes('docs.google.com/spreadsheets/d/')) {
      throw new Error('URL invalide. Veuillez fournir une URL de Google Sheet valide.');
    }

    const sheetId = extractSheetId(url);
    if (!sheetId) throw new Error('Impossible d\'extraire l\'identifiant du classeur.');

    let spreadsheet;
    try {
      spreadsheet = SpreadsheetApp.openById(sheetId);
    } catch (e) {
      return buildPermissionError(e);
    }

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
    console.error('Erreur processSheet:', error.message);
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

function buildPermissionError(error) {
  const msg = (error && error.message) || '';
  const isAccessDenied = msg.includes('You do not have permission') ||
                         msg.includes('403') ||
                         msg.includes('PERMISSION_DENIED') ||
                         msg.includes('not found');
  if (isAccessDenied) {
    return {
      success: false,
      error: 'Accès refusé au classeur.\n\nVérifiez que vous êtes connecté au bon compte Google et que vous avez bien accès à ce fichier.'
    };
  }
  return { success: false, error: 'Erreur d\'ouverture : ' + msg };
}
