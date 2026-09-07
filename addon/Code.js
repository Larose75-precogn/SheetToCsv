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
  const result = convertActiveSpreadsheet();

  if (!result.success) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(result.error))
      .setNavigation(CardService.newNavigation().updateCard(
        buildReadyCard('<b>Échec de la conversion.</b><br>' + result.error)
      ))
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
function convertActiveSpreadsheet() {
  let spreadsheet;
  try {
    spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    return buildFileScopeError();
  }
  if (!spreadsheet) return buildFileScopeError();

  return processSpreadsheet(spreadsheet);
}

function buildFileScopeError() {
  return {
    success: false,
    error: 'SheetToCsv n\'a pas encore accès à ce classeur. Ouvrez le panneau ' +
           'SheetToCsv puis cliquez sur « Autoriser ce classeur ».'
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

    let spreadsheet;
    try {
      // Pas de SpreadsheetApp.openById() ici : cet appel exige le scope large
      // .../auth/spreadsheets, celui que la revue Marketplace nous a demande de
      // retirer. L'API Sheets accepte drive.file, donc uniquement le fichier que
      // l'utilisateur a designe dans le Picker.
      spreadsheet = openSpreadsheetByIdRest_(sheetId);
    } catch (e) {
      return buildSheetsApiError_(e);
    }

    const result = processSpreadsheet(spreadsheet);
    try {
      spreadsheet.flushPending();
    } catch (e) {
      console.error('Erreur mise en forme de la feuille export :', e.message);
    }
    return result;

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

// Echec d'ouverture cote API Sheets. Le message clair est conserve pour
// l'utilisateur, mais la reponse brute de Google est jointe : sans elle,
// impossible de distinguer "API Sheets desactivee sur le projet Cloud" de
// "fichier non accorde par le Picker" - les deux remontent en 403/404.
function buildSheetsApiError_(error) {
  const raw      = (error && error.message) || '';
  const friendly = buildPermissionError(error);
  if (!raw) return friendly;
  // La reponse brute de Google est conservee, tronquee : c'est elle qui permet
  // de distinguer un fichier non autorise d'une API desactivee.
  return {
    success: false,
    error: friendly.error + '\n\nDetail technique :\n' + raw.slice(0, 300)
  };
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


// ================================================================
// Acces au classeur via l'API Sheets (autorisation par fichier)
// ================================================================
//
// Pourquoi ce module existe :
// la web app rouvre un classeur que l'utilisateur vient de designer dans le
// Google Picker(TM). SpreadsheetApp.openById() exige pour cela le scope
// https://www.googleapis.com/auth/spreadsheets - l'acces a *tous* les classeurs
// de l'utilisateur, precisement ce que la revue Google Workspace Marketplace
// nous a demande de retirer. L'API Sheets, elle, accepte drive.file : elle
// n'ouvre que les fichiers explicitement accordes via le Picker.
//
// Ce module reimplemente la petite partie de l'interface SpreadsheetApp
// reellement utilisee par readAllSheets() et writeExportSheet(), afin que ces
// deux fonctions restent communes au panneau lateral et a la web app.

const SHEETS_API_BASE   = 'https://sheets.googleapis.com/v4/spreadsheets';
const VALUES_CHUNK_ROWS = 5000; // decoupage des ecritures volumineuses

function sheetsApiFetch_(method, path, payload) {
  const options = {
    method: method,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  };
  if (payload) {
    options.contentType = 'application/json';
    options.payload     = JSON.stringify(payload);
  }

  const response = UrlFetchApp.fetch(SHEETS_API_BASE + path, options);
  const code     = response.getResponseCode();
  const body     = response.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error('Sheets API ' + code + ' : ' + body);
  }
  return body ? JSON.parse(body) : {};
}

// Titre de feuille en notation A1 : les apostrophes internes se doublent.
function quoteSheetTitle_(title) {
  return "'" + String(title).replace(/'/g, "''") + "'";
}

function columnToLetter_(column) {
  let letter = '';
  let n = column;
  while (n > 0) {
    const rest = (n - 1) % 26;
    letter = String.fromCharCode(65 + rest) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

function hexToRgbColor_(hex) {
  const clean = String(hex).replace('#', '');
  return {
    red:   parseInt(clean.substring(0, 2), 16) / 255,
    green: parseInt(clean.substring(2, 4), 16) / 255,
    blue:  parseInt(clean.substring(4, 6), 16) / 255
  };
}

// L'API renvoie des lignes de longueurs inegales (cellules vides de fin
// tronquees) alors que getDisplayValues() renvoie un rectangle plein.
// On retablit le rectangle pour que readAllSheets() se comporte a l'identique.
function padRowsToRectangle_(values) {
  let width = 0;
  for (const row of values) {
    if (row.length > width) width = row.length;
  }
  return values.map(function (row) {
    const padded = row.map(function (cell) {
      return (cell === null || cell === undefined) ? '' : String(cell);
    });
    while (padded.length < width) padded.push('');
    return padded;
  });
}

function openSpreadsheetByIdRest_(spreadsheetId) {
  const encodedId = encodeURIComponent(spreadsheetId);

  const meta = sheetsApiFetch_(
    'get', '/' + encodedId + '?fields=sheets.properties(sheetId,title,index)');

  const props   = (meta.sheets || []).map(function (s) { return s.properties; });
  const pending = [];   // requetes batchUpdate en attente (mise en forme)
  let valuesCache = null;

  function gridRange(sheetId, row, col, numRows, numCols) {
    return {
      sheetId:          sheetId,
      startRowIndex:    row - 1,
      endRowIndex:      row - 1 + numRows,
      startColumnIndex: col - 1,
      endColumnIndex:   col - 1 + numCols
    };
  }

  // Toutes les feuilles sont lues en une seule requete.
  function prefetchValues() {
    if (valuesCache) return;
    valuesCache = {};
    if (!props.length) return;

    const ranges = props.map(function (p) {
      return 'ranges=' + encodeURIComponent(quoteSheetTitle_(p.title));
    }).join('&');

    const res = sheetsApiFetch_('get',
      '/' + encodedId + '/values:batchGet' +
      '?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS&' + ranges);

    (res.valueRanges || []).forEach(function (valueRange, i) {
      if (props[i]) {
        valuesCache[props[i].title] = padRowsToRectangle_(valueRange.values || []);
      }
    });
  }

  function writeValues(title, row, col, values) {
    if (!values.length) return;

    for (let offset = 0; offset < values.length; offset += VALUES_CHUNK_ROWS) {
      const chunk    = values.slice(offset, offset + VALUES_CHUNK_ROWS);
      const startRow = row + offset;
      const endRow   = startRow + chunk.length - 1;
      const endCol   = col + (chunk[0] ? chunk[0].length : 1) - 1;

      const a1 = quoteSheetTitle_(title) + '!' +
                 columnToLetter_(col) + startRow + ':' +
                 columnToLetter_(endCol) + endRow;

      // RAW : les valeurs viennent deja de getDisplayValues(), il ne faut pas
      // que Sheets les reinterprete (formules, dates, separateurs decimaux).
      sheetsApiFetch_('put',
        '/' + encodedId + '/values/' + encodeURIComponent(a1) + '?valueInputOption=RAW',
        { values: chunk });
    }
  }

  function makeRange(p, row, col, numRows, numCols) {
    const format = {};
    const fields = [];
    let slot = -1;

    function applyFormat(field) {
      if (fields.indexOf(field) === -1) fields.push(field);
      if (slot === -1) {
        slot = pending.length;
        pending.push(null);
      }
      pending[slot] = {
        repeatCell: {
          range:  gridRange(p.sheetId, row, col, numRows, numCols),
          cell:   { userEnteredFormat: format },
          fields: fields.join(',')
        }
      };
    }

    const range = {
      setValues: function (values) {
        writeValues(p.title, row, col, values);
        return range;
      },
      setFontWeight: function (weight) {
        format.textFormat = format.textFormat || {};
        format.textFormat.bold = (weight === 'bold');
        applyFormat('userEnteredFormat.textFormat.bold');
        return range;
      },
      setFontColor: function (color) {
        format.textFormat = format.textFormat || {};
        format.textFormat.foregroundColor = hexToRgbColor_(color);
        applyFormat('userEnteredFormat.textFormat.foregroundColor');
        return range;
      },
      setBackground: function (color) {
        format.backgroundColor = hexToRgbColor_(color);
        applyFormat('userEnteredFormat.backgroundColor');
        return range;
      },
      setHorizontalAlignment: function (alignment) {
        format.horizontalAlignment = String(alignment).toUpperCase();
        applyFormat('userEnteredFormat.horizontalAlignment');
        return range;
      },
      merge: function () {
        pending.push({
          mergeCells: {
            range:     gridRange(p.sheetId, row, col, numRows, numCols),
            mergeType: 'MERGE_ALL'
          }
        });
        return range;
      }
    };
    return range;
  }

  function makeSheet(p) {
    const sheet = {
      _props:  p,
      getName: function () { return p.title; },
      getDataRange: function () {
        prefetchValues();
        const values = valuesCache[p.title] || [];
        return { getDisplayValues: function () { return values; } };
      },
      getRange: function (row, col, numRows, numCols) {
        return makeRange(p, row, col, numRows, numCols);
      },
      autoResizeColumn: function (col) {
        pending.push({
          autoResizeDimensions: {
            dimensions: {
              sheetId:    p.sheetId,
              dimension:  'COLUMNS',
              startIndex: col - 1,
              endIndex:   col
            }
          }
        });
        return sheet;
      },
      setFrozenRows: function (count) {
        pending.push({
          updateSheetProperties: {
            properties: { sheetId: p.sheetId, gridProperties: { frozenRowCount: count } },
            fields:     'gridProperties.frozenRowCount'
          }
        });
        return sheet;
      }
    };
    return sheet;
  }

  const spreadsheet = {
    getSheets: function () {
      return props.map(makeSheet);
    },

    getSheetByName: function (name) {
      const found = props.filter(function (p) { return p.title === name; })[0];
      return found ? makeSheet(found) : null;
    },

    deleteSheet: function (sheet) {
      spreadsheet.flushPending();
      sheetsApiFetch_('post', '/' + encodedId + ':batchUpdate',
        { requests: [{ deleteSheet: { sheetId: sheet._props.sheetId } }] });

      const i = props.indexOf(sheet._props);
      if (i >= 0) props.splice(i, 1);
      if (valuesCache) delete valuesCache[sheet._props.title];
    },

    insertSheet: function (name) {
      spreadsheet.flushPending();
      const res = sheetsApiFetch_('post', '/' + encodedId + ':batchUpdate',
        { requests: [{ addSheet: { properties: { title: name } } }] });

      const created = res.replies[0].addSheet.properties;
      props.push(created);
      return makeSheet(created);
    },

    // Envoie en une seule requete toute la mise en forme accumulee.
    flushPending: function () {
      if (!pending.length) return;
      const requests = pending.splice(0, pending.length).filter(function (r) { return r; });
      if (!requests.length) return;
      sheetsApiFetch_('post', '/' + encodedId + ':batchUpdate', { requests: requests });
    }
  };

  return spreadsheet;
}
