// ================================================================
// SheetToCsv — Suite de tests manuels
//
// Exécution : ouvrir l'éditeur Apps Script, sélectionner
// runAllTests dans le menu déroulant, cliquer Exécuter.
// Les résultats s'affichent dans la console (Journaux).
// ================================================================

// ── Micro-framework ───────────────────────────────────────────────

var _pass = 0, _fail = 0, _section = '';

function _section_(name) {
  _section = name;
  Logger.log('\n── ' + name + ' ──');
}

function _assert(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    _pass++;
    Logger.log('  ✓ ' + label);
  } else {
    _fail++;
    Logger.log('  ✗ ' + label);
    Logger.log('      attendu  : ' + JSON.stringify(expected));
    Logger.log('      obtenu   : ' + JSON.stringify(actual));
  }
}

function _assertContains(label, str, substr) {
  const ok = typeof str === 'string' && str.includes(substr);
  if (ok) {
    _pass++;
    Logger.log('  ✓ ' + label);
  } else {
    _fail++;
    Logger.log('  ✗ ' + label + ' — chaîne attendue : ' + substr);
    Logger.log('      obtenu : ' + JSON.stringify(str));
  }
}

// ================================================================
// POINT D'ENTRÉE
// ================================================================

function runAllTests() {
  _pass = 0; _fail = 0;
  Logger.log('════════════════════════════════════════');
  Logger.log('SheetToCsv — Tests unitaires');
  Logger.log('════════════════════════════════════════');

  testExtractSheetId();
  testIsSheetEmpty();
  testGenerateCsv();
  testGetFrenchDateTime();
  testReadAllSheets();
  testWriteExportSheet();
  testProcessSheetIntegration();

  Logger.log('\n════════════════════════════════════════');
  Logger.log('Résultat : ' + _pass + ' ✓  ' + _fail + ' ✗');
  Logger.log('════════════════════════════════════════');
}

// ================================================================
// 1 — extractSheetId
// ================================================================

function testExtractSheetId() {
  _section_('extractSheetId');

  const ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms';

  _assert('URL standard /edit',
    extractSheetId('https://docs.google.com/spreadsheets/d/' + ID + '/edit'),
    ID);

  _assert('URL avec gid',
    extractSheetId('https://docs.google.com/spreadsheets/d/' + ID + '/edit#gid=123456'),
    ID);

  _assert('URL avec paramètres ?usp=sharing',
    extractSheetId('https://docs.google.com/spreadsheets/d/' + ID + '/edit?usp=sharing'),
    ID);

  _assert('URL /pub (publiée)',
    extractSheetId('https://docs.google.com/spreadsheets/d/' + ID + '/pub?output=csv'),
    ID);

  _assert('URL avec key= (ancien format)',
    extractSheetId('https://spreadsheets.google.com/feeds/cells/key=' + ID + '/1/public/values'),
    ID);

  // extractSheetId ne valide pas le type de document — il extrait tout /d/<id>.
  // Le filtrage "spreadsheets uniquement" se fait dans processSheet.
  _assert('URL doc Google (non-sheet) → retourne quand même l\'ID',
    extractSheetId('https://docs.google.com/document/d/' + ID),
    ID);

  _assert('Chaîne vide → null',
    extractSheetId(''),
    null);

  _assert('ID avec tirets et underscores',
    extractSheetId('https://docs.google.com/spreadsheets/d/abc-123_XYZ/edit'),
    'abc-123_XYZ');
}

// ================================================================
// 2 — isSheetEmpty
// ================================================================

function testIsSheetEmpty() {
  _section_('isSheetEmpty');

  _assert('null → vide',               isSheetEmpty(null),                       true);
  _assert('[] → vide',                 isSheetEmpty([]),                          true);
  _assert('1 ligne 1 cellule vide',    isSheetEmpty([['']]),                      true);
  _assert('1 ligne multi-cellules vides', isSheetEmpty([['','','']]),             true);
  _assert('Multi-lignes toutes vides', isSheetEmpty([['',''],['',''],['','']]),   true);

  _assert('1 ligne avec données',      isSheetEmpty([['A','B']]),                 false);
  _assert('Header + données',          isSheetEmpty([['A'],['1']]),               false);
  _assert('Mélange vides/données',     isSheetEmpty([[''],['X']]),                false);
  _assert('Cellule avec espace seul',  isSheetEmpty([[' ']]),                     false);
  _assert('Cellule avec 0',            isSheetEmpty([['0']]),                     false);
}

// ================================================================
// 3 — generateCsv
// ================================================================

function testGenerateCsv() {
  _section_('generateCsv — cas de base');

  _assert('Ligne simple',
    generateCsv([['A','B','C']]),
    'A;B;C');

  _assert('Multi-lignes',
    generateCsv([['A','B'],['1','2']]),
    'A;B\n1;2');

  _assert('Cellule vide en milieu de ligne',
    generateCsv([['A','','C']]),
    'A;;C');

  _assert('Ligne entièrement vide',
    generateCsv([['A','B'],['',''],['C','D']]),
    'A;B\n;\nC;D');

  _assert('null → chaîne vide',
    generateCsv([[null, undefined, 'ok']]),
    ';;ok');

  _assert('Nombre → converti en chaîne',
    generateCsv([[42, 3.14]]),
    '42;3.14');

  _assert('Booléen → chaîne',
    generateCsv([[true, false]]),
    'true;false');

  _section_('generateCsv — échappement RFC 4180');

  _assert('Guillemet simple',
    generateCsv([['"']]),
    '""""');

  _assert('Guillemets encadrants (say "hello")',
    generateCsv([['say "hello"']]),
    '"say ""hello"""');

  _assert('Séparateur dans cellule',
    generateCsv([['a;b;c']]),
    '"a;b;c"');

  _assert('Séparateur + guillemet',
    generateCsv([['a;"b"']]),
    '"a;""b"""');

  _assert('Retour à la ligne \\n dans cellule',
    generateCsv([['ligne1\nligne2']]),
    '"ligne1\nligne2"');

  _assert('Retour chariot \\r dans cellule',
    generateCsv([['ligne1\rligne2']]),
    '"ligne1\rligne2"');

  _assert('\\r\\n dans cellule',
    generateCsv([['a\r\nb']]),
    '"a\r\nb"');

  _assert('Guillemets seuls',
    generateCsv([['""']]),
    '"""""');

  _section_('generateCsv — Unicode et émojis');

  _assert('Accents français',
    generateCsv([['é', 'à', 'ü', 'ç']]),
    'é;à;ü;ç');

  _assert('Caractères CJK',
    generateCsv([['中文', '日本語', '한국어']]),
    '中文;日本語;한국어');

  _assert('Émoji',
    generateCsv([['🎉', '💡']]),
    '🎉;💡');

  _assert('Emoji contenant ; (impossible mais défensif)',
    generateCsv([['normal', '😀;test']]),
    'normal;"😀;test"');

  _assert('Caractères RTL (arabe)',
    generateCsv([['مرحبا', 'العالم']]),
    'مرحبا;العالم');

  _section_('generateCsv — lignes inégales');

  // rows avec nombre de colonnes différent — generateCsv gère chaque ligne indépendamment
  const rows = [['H1','H2','H3'], ['v1','v2'], ['a','b','c','d']];
  const csv  = generateCsv(rows);
  _assert('Lignes avec colonnes différentes — ligne 1',
    csv.split('\n')[0], 'H1;H2;H3');
  _assert('Lignes avec colonnes différentes — ligne 2 (courte)',
    csv.split('\n')[1], 'v1;v2');
  _assert('Lignes avec colonnes différentes — ligne 3 (longue)',
    csv.split('\n')[2], 'a;b;c;d');

  _section_('generateCsv — données vides');

  _assert('Tableau vide → chaîne vide',
    generateCsv([]),
    '');
}

// ================================================================
// 5 — getFrenchDateTime
// ================================================================

function testGetFrenchDateTime() {
  _section_('getFrenchDateTime');

  const dt = getFrenchDateTime();
  _assert('Retourne une chaîne non vide', typeof dt === 'string' && dt.length > 0, true);

  // Format attendu : "lundi 28 juillet 2026 à 14h37m31s"
  const pattern = /^(dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi) \d{2} (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) \d{4} à \d{2}h\d{2}m\d{2}s$/;
  _assert('Format correct (jour dd mois yyyy à HHhmmss)', pattern.test(dt), true);

  // Vérification que l'heure n'est pas UTC brut si le fuseau est différent
  // (test non-déterministe : on vérifie juste que le fuseau est pris en compte)
  Logger.log('    Horodatage généré : ' + dt);
  Logger.log('    Fuseau du script  : ' + Session.getScriptTimeZone());
}

// ================================================================
// 6 — readAllSheets (avec feuilles simulées)
// ================================================================

function _makeSheet(name, values) {
  return {
    getName:       function() { return name; },
    getDataRange:  function() {
      return { getDisplayValues: function() { return values; } };
    }
  };
}

function _makeSpreadsheet(sheets) {
  return { getSheets: function() { return sheets; } };
}

function testReadAllSheets() {
  _section_('readAllSheets — cas de base');

  // Feuille unique avec données
  var ss = _makeSpreadsheet([
    _makeSheet('Ventes', [['Produit','Prix'],['A','10'],['B','20']])
  ]);
  var r = readAllSheets(ss);
  _assert('1 feuille → sheetCount=1', r.sheetCount, 1);
  _assert('1 feuille → 3 lignes (header+2)', r.rows.length, 3);
  _assert('Header augmenté de Feuille d\'origine', r.rows[0][0], 'Feuille d\'origine');
  _assert('Header col 1', r.rows[0][1], 'Produit');
  _assert('Donnée ligne 1 col 0 = nom feuille', r.rows[1][0], 'Ventes');
  _assert('Donnée ligne 1 col 1 = A', r.rows[1][1], 'A');

  _section_('readAllSheets — feuilles multiples');

  var ss2 = _makeSpreadsheet([
    _makeSheet('F1', [['A','B'],['1','2'],['3','4']]),
    _makeSheet('F2', [['X','Y'],['5','6']])
  ]);
  var r2 = readAllSheets(ss2);
  _assert('2 feuilles → sheetCount=2', r2.sheetCount, 2);
  // header + 2 lignes F1 + 1 ligne F2
  _assert('2 feuilles → 4 lignes total', r2.rows.length, 4);
  _assert('Lignes F2 ont pour nom de feuille F2', r2.rows[3][0], 'F2');
  _assert('En-tête F2 absent (pas de doublon)', r2.rows[3][1], '5');

  _section_('readAllSheets — Export_CSV ignoré');

  var ss3 = _makeSpreadsheet([
    _makeSheet('Data',       [['A'],['1']]),
    _makeSheet('Export_CSV', [['X'],['9']]),
    _makeSheet('Autre',      [['B'],['2']])
  ]);
  var r3 = readAllSheets(ss3);
  _assert('Export_CSV ignoré — sheetCount=2', r3.sheetCount, 2);
  _assert('Export_CSV ignoré — aucune ligne "9"',
    r3.rows.every(row => row[1] !== '9'), true);

  _section_('readAllSheets — feuilles vides');

  var ss4 = _makeSpreadsheet([
    _makeSheet('Vide1', [['',''],['','']]),
    _makeSheet('Data',  [['A'],['1']]),
    _makeSheet('Vide2', [])
  ]);
  var r4 = readAllSheets(ss4);
  _assert('Feuilles vides ignorées — sheetCount=1', r4.sheetCount, 1);
  _assert('Feuilles vides ignorées — 2 lignes (header+1)', r4.rows.length, 2);

  _section_('readAllSheets — toutes les feuilles vides → erreur');

  var ss5 = _makeSpreadsheet([
    _makeSheet('Vide', [['','']])
  ]);
  try {
    readAllSheets(ss5);
    _assert('Doit lever une erreur', false, true);
  } catch (e) {
    _assertContains('Erreur "Aucune feuille"', e.message, 'feuille');
  }

  _section_('readAllSheets — lignes vides dans première feuille conservées');

  // La première feuille conserve les lignes vides (comportement attendu : lignes séparatrices)
  var ss6 = _makeSpreadsheet([
    _makeSheet('F1', [['A','B'],['1','2'],['',''],['3','4']])
  ]);
  var r6 = readAllSheets(ss6);
  // header + 3 lignes données (vide incluse)
  _assert('Lignes vides feuille 1 conservées', r6.rows.length, 4);

  _section_('readAllSheets — lignes vides dans feuilles suivantes filtrées');

  var ss7 = _makeSpreadsheet([
    _makeSheet('F1', [['A'],['1']]),
    _makeSheet('F2', [['B'],[''],[''],['2']])
  ]);
  var r7 = readAllSheets(ss7);
  // header(1) + F1 donnée(1) + F2 données sans lignes vides(1) = 3
  _assert('Lignes vides feuilles suivantes filtrées', r7.rows.length, 3);

  _section_('readAllSheets — limite MAX_SHEETS (30)');

  var manySheets = [];
  for (var i = 0; i < 35; i++) {
    manySheets.push(_makeSheet('F' + i, [['H'],['v']]));
  }
  var r8 = readAllSheets(_makeSpreadsheet(manySheets));
  _assert('MAX_SHEETS : 30 feuilles maximum traitées', r8.sheetCount, 30);

  _section_('readAllSheets — feuille avec seulement un en-tête');

  var ss9 = _makeSpreadsheet([
    _makeSheet('Headers', [['A','B','C']])
  ]);
  var r9 = readAllSheets(ss9);
  _assert('Header seul → 1 ligne (l\'en-tête)', r9.rows.length, 1);
  _assert('Header seul → sheetCount=1', r9.sheetCount, 1);

  _section_('readAllSheets — colonnes inégales entre feuilles');

  var ss10 = _makeSpreadsheet([
    _makeSheet('F1', [['A','B'],    ['1','2']]),
    _makeSheet('F2', [['X','Y','Z'],['3','4','5']])
  ]);
  var r10 = readAllSheets(ss10);
  // header: ['Feuille d'origine','A','B'] → 3 cols
  // F2 data: ['F2','3','4','5'] → 4 cols
  _assert('Colonnes inégales : header 3 éléments', r10.rows[0].length, 3);
  _assert('Colonnes inégales : ligne F2 4 éléments', r10.rows[2].length, 4);
}

// ================================================================
// 7 — writeExportSheet (avec spreadsheet simulé)
// ================================================================

function testWriteExportSheet() {
  _section_('writeExportSheet — simulation');

  var writtenData   = null;
  var writtenRange  = null;
  var deletedSheets = [];

  function _makeRange(nRows, nCols) {
    return {
      setValues:            function(d) { writtenData = d; writtenRange = [nRows, nCols]; },
      setFontWeight:        function()  { return this; },
      setBackground:        function()  { return this; },
      setFontColor:         function()  { return this; },
      setHorizontalAlignment: function(){ return this; },
      merge:                function()  { return this; }
    };
  }

  var fakeSheet = {
    getRange:         function(r,c,nr,nc) { return _makeRange(nr,nc); },
    autoResizeColumn: function() {},
    setFrozenRows:    function() {}
  };

  var fakeSS = {
    getSheetByName:  function(n) { return null; }, // pas d'export existant
    insertSheet:     function(n) { return fakeSheet; },
    deleteSheet:     function(s) { deletedSheets.push(s); }
  };

  var rows = [
    ['Feuille d\'origine', 'Produit', 'Prix'],
    ['Ventes', 'Widget', '9.99'],
    ['Ventes', 'Gadget', '4.99']
  ];

  writeExportSheet(fakeSS, rows);

  _assert('Données écrites (non null)', writtenData !== null, true);
  // allData = dateRow + rows → 4 lignes
  _assert('allData inclut la ligne de date → 4 lignes', writtenData.length, 4);
  _assert('Ligne 1 (date) col 0 contient "Export"',
    writtenData[0][0].includes('Export'), true);
  _assert('Ligne 2 = en-tête (Feuille d\'origine)',
    writtenData[1][0], 'Feuille d\'origine');
  _assert('Ligne 3 = donnée 1',
    writtenData[2][1], 'Widget');
  _assert('Ligne 4 = donnée 2',
    writtenData[3][1], 'Gadget');
  _assert('Nombre de colonnes = 3', writtenRange[1], 3);

  _section_('writeExportSheet — suppression feuille existante');

  var deletedSheetMock = { name: 'Export_CSV' };
  var fakeSS2 = {
    getSheetByName: function(n) { return n === EXPORT_SHEET_NAME ? deletedSheetMock : null; },
    insertSheet:    function(n) { return fakeSheet; },
    deleteSheet:    function(s) { deletedSheets.push(s); }
  };

  writtenData = null;
  writeExportSheet(fakeSS2, rows);
  _assert('Ancienne feuille supprimée', deletedSheets.includes(deletedSheetMock), true);
  _assert('Nouvelle feuille créée', writtenData !== null, true);

  _section_('writeExportSheet — padding lignes courtes');

  var rowsInegaux = [
    ['H1','H2','H3'],
    ['v1','v2'],         // 2 cols seulement
    ['a','b','c','d']   // 4 cols
  ];

  writtenData = null;
  writeExportSheet(fakeSS, rowsInegaux);
  // numCols = max(3,2,4) = 4, + col Feuille d'origine ajoutée en amont par readAllSheets
  // Ici on passe les rows tels quels → numCols = 4
  // allData: [dateRow, rows[0], rows[1], rows[2]]
  // allData[2] = ['v1','v2'] paddée à 4 → ['v1','v2','','']
  _assert('Ligne courte paddée à numCols=4',
    writtenData[2].length, 4);
  _assert('Padding = chaîne vide',
    writtenData[2][3], '');
}

// ================================================================
// 8 — Tests d'intégration processSheet (avec spreadsheet réel)
// ================================================================

function testProcessSheetIntegration() {
  _section_('processSheet — validation URL côté client');

  var r1 = processSheet(null);
  _assert('null → success:false', r1.success, false);
  _assertContains('null → message URL invalide', r1.error, 'URL');

  var r2 = processSheet('');
  _assert('chaîne vide → success:false', r2.success, false);

  var r3 = processSheet('https://www.google.com');
  _assert('URL non-Sheet → success:false', r3.success, false);
  _assertContains('URL non-Sheet → message URL', r3.error, 'URL');

  var r4 = processSheet('https://docs.google.com/spreadsheets/d/');
  _assert('URL sans ID → success:false', r4.success, false);
  _assertContains('URL sans ID → message', r4.error, 'identifiant');

  _section_('processSheet — intégration sur classeur réel');
  Logger.log('  ℹ Intégration réelle : exécuter testIntegrationReelle() manuellement.');
}

// ================================================================
// Test d'intégration réel (exécuter séparément depuis l'IDE)
// Crée un classeur temporaire, le convertit, vérifie le résultat.
// ================================================================

function testIntegrationReelle() {
  Logger.log('════ Test intégration réelle ════');

  var ss = SpreadsheetApp.create('SheetToCsv_Test_' + Date.now());
  var sheet1 = ss.getActiveSheet();
  sheet1.setName('Produits');

  // Cas limites dans les données
  sheet1.getRange('A1:E1').setValues([['Nom','Prix','Description','Vide','Spécial']]);
  sheet1.getRange('A2:E2').setValues([['Widget', 9.99, 'Un "truc" sympa', '', 'ligne1\nligne2']]);
  sheet1.getRange('A3:E3').setValues([['Gadget;Pro', 4.99, 'Contient ; séparateur', '', 'normal']]);
  sheet1.getRange('A4:E4').setValues([['中文', 3.14, 'Unicode', '', 'émoji 🎉']]);
  sheet1.getRange('A5:E5').setValues([['', '', '', '', '']]);  // ligne vide
  sheet1.getRange('A6:E6').setValues([['Dernier', 1, '', '', '']]);

  // Feuille 2
  var sheet2 = ss.insertSheet('Clients');
  sheet2.getRange('A1:B1').setValues([['Client','Pays']]);
  sheet2.getRange('A2:B2').setValues([['Dupont, Jean', 'France']]);
  sheet2.getRange('A3:B3').setValues([['', '']]);              // ligne vide (doit être filtrée)
  sheet2.getRange('A4:B4').setValues([['Smith', 'US']]);

  var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId();
  var result = processSheet(url);

  Logger.log('success : ' + result.success);
  if (!result.success) {
    Logger.log('ERREUR : ' + result.error);
    SpreadsheetApp.flush();
    DriveApp.getFileById(ss.getId()).setTrashed(true);
    return;
  }

  Logger.log('sheetCount : ' + result.sheetCount);  // doit être 2
  Logger.log('rowCount   : ' + result.rowCount);     // doit être 5 (2 produits réels + vide + dernier + 2 clients - leurs lignes vides)

  var lines = result.csvContent.split('\n');
  Logger.log('Lignes CSV : ' + lines.length);

  // Vérifications
  var ok = true;

  // En-tête augmenté
  if (!lines[0].startsWith('Feuille d\'origine;')) {
    Logger.log('✗ Header manque "Feuille d\'origine"'); ok = false;
  } else {
    Logger.log('✓ Header correct');
  }

  // Cellule avec guillemet doit être quotée
  var hasQuotedCell = lines.some(function(l) { return l.includes('""truc""') || l.includes('"Un ""truc""'); });
  Logger.log((hasQuotedCell ? '✓' : '✗') + ' Guillemets escapés');
  if (!hasQuotedCell) ok = false;

  // Cellule avec ; doit être quotée
  var hasSemiColon = lines.some(function(l) { return l.includes('"Gadget;Pro"'); });
  Logger.log((hasSemiColon ? '✓' : '✗') + ' Séparateur ; quoté');
  if (!hasSemiColon) ok = false;

  // Unicode présent
  var hasUnicode = lines.some(function(l) { return l.includes('中文'); });
  Logger.log((hasUnicode ? '✓' : '✗') + ' Unicode préservé');
  if (!hasUnicode) ok = false;

  // Ligne vide feuille 1 présente (comportement attendu : conservée)
  var emptyRowFeuille1 = lines.filter(function(l) { return l.startsWith('Produits;;;'); }).length;
  Logger.log((emptyRowFeuille1 > 0 ? '✓' : '✗') + ' Ligne vide feuille 1 conservée');

  // Ligne vide feuille 2 absente (filtrée)
  var hasEmptyClient = lines.some(function(l) { return l === 'Clients;'; });
  Logger.log((!hasEmptyClient ? '✓' : '✗') + ' Ligne vide feuille 2 filtrée');
  if (hasEmptyClient) ok = false;

  // Feuille Export_CSV créée
  var exportSheet = ss.getSheetByName('Export_CSV');
  Logger.log((exportSheet ? '✓' : '✗') + ' Feuille Export_CSV créée');
  if (!exportSheet) ok = false;

  // Ligne de titre (horodatage) présente
  if (exportSheet) {
    var titreCell = exportSheet.getRange(1, 1).getValue();
    Logger.log((titreCell.includes('Export') ? '✓' : '✗') + ' Ligne de titre : ' + titreCell);
  }

  Logger.log('\n' + (ok ? '✅ Intégration réussie' : '❌ Des cas ont échoué'));

  // Nettoyage
  DriveApp.getFileById(ss.getId()).setTrashed(true);
  Logger.log('Classeur de test supprimé.');
}

// ================================================================
// Tests spécifiques aux cas limites CSV
// ================================================================

function testCasLimitesCSV() {
  _section_('Cas limites CSV avancés');

  // Cellule avec UNIQUEMENT des guillemets
  // 3 guillemets → doublés = 6 → + 2 guillemets encadrants = 8
  _assert('Cellule = """ (3 guillemets) → 8 guillemets',
    generateCsv([['"""']]),
    '""""""""');

  // Longue chaîne avec plusieurs guillemets
  _assert('Plusieurs guillemets éscapés',
    generateCsv([['"a","b"']]),
    '"""a"",""b"""');

  // Séparateur en début et fin
  _assert('Séparateur en début',
    generateCsv([[';abc']]),
    '";abc"');
  _assert('Séparateur en fin',
    generateCsv([['abc;']]),
    '"abc;"');
  _assert('Séparateur seul',
    generateCsv([[';']]),
    '";"');

  // Cellule avec uniquement \n
  _assert('Cellule = \\n seul',
    generateCsv([['\n']]),
    '"\n"');

  // Cellule combinant tout
  _assert('Guillemet + séparateur + newline',
    generateCsv([['";\n']]),
    '"\"";;\n"'.replace('\"\"', '""'));

  // Vérification directe
  var combo = generateCsv([['";\n']]);
  _assert('Combo "; \\n → quoté',
    combo.startsWith('"') && combo.endsWith('"'), true);
}
