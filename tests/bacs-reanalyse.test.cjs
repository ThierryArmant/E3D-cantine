// Tri par poubelle et réanalyse d'une journée à partir des photos gardées.
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');

class Sheet {
  constructor(rows = []) { this.rows = rows; }
  appendRow(r) { this.rows.push([...r]); }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(0, ...this.rows.map(r => r.length)); }
  getDataRange() { return { getValues: () => this.rows.map(r => [...r]) }; }
  getRange(a, col, n = 1, w = 1) {
    if (typeof a === 'string') { const m = a.match(/^([A-Z])1(?::([A-Z])1)?$/); col = m[1].charCodeAt(0) - 64; w = m[2] ? m[2].charCodeAt(0) - col - 63 : 1; a = 1; }
    const row = a, self = this;
    const cell = (r, c) => { while (self.rows.length < r) self.rows.push([]); return self.rows[r - 1][c - 1]; };
    return {
      getValues: () => Array.from({ length: n }, (_, i) => Array.from({ length: w }, (_, j) => { const v = cell(row + i, col + j); return v === undefined ? '' : v; })),
      getValue: () => { const v = cell(row, col); return v === undefined ? '' : v; },
      setValues: v => v.forEach((l, i) => l.forEach((x, j) => { cell(row + i, col + j); self.rows[row - 1 + i][col - 1 + j] = x; })),
      setValue: x => { cell(row, col); self.rows[row - 1][col - 1] = x; }
    };
  }
}

const props = {}, cache = {}, fichiers = {}, dossiers = {}, declencheurs = [];
let nbDossiers = 0, appelsGemini = 0, geminiEnPanne = false, verrouTenu = false, declencheursAutorises = true;
function dossier(nom) {
  const d = { id: 'dos-' + (++nbDossiers), nom, enfants: {} };
  d.getId = () => d.id; d.getName = () => nom;
  d.getFoldersByName = n => { const e = d.enfants[n]; let lu = false; return { hasNext: () => !!e && !lu, next: () => { lu = true; return e; } }; };
  d.createFolder = n => (d.enfants[n] = dossier(n));
  d.createFile = blob => { const id = 'fichier-test-' + Object.keys(fichiers).length; fichiers[id] = { blob, dossier: d }; return { getId: () => id, getUrl: () => 'https://drive.google.com/file/d/' + id + '/view' }; };
  dossiers[d.id] = d; return d;
}
const racine = dossier('Photos');

const sheets = {
  gaspillage: new Sheet([['Horodatage', 'Type Entrée', 'Note', 'E', 'P', 'D', 'Pain', 'Poids', 'Perte', 'Avis', 'Detail']]),
  menus: new Sheet([['Horodatage', 'Type', 'Intitulé', 'Détail', 'Effectif']]),
  sacs: new Sheet([['h']]),
  parametres: new Sheet([['Paramètre', 'Valeur', 'Description']])
};
const sheetsSupplementaires = {};
sheets.menus.getParent = () => ({ getSheetByName: n => sheetsSupplementaires[n] || null, insertSheet: n => (sheetsSupplementaires[n] = new Sheet()) });

const c = vm.createContext({
  Logger: { log() {} },
  LockService: {
    getScriptLock: () => ({ hasLock: () => verrouTenu, tryLock() { verrouTenu = true; return true; }, waitLock() { verrouTenu = true; }, releaseLock() { verrouTenu = false; } }),
    getUserLock: () => ({ tryLock: () => true, releaseLock() {} })
  },
  SpreadsheetApp: { flush() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] ?? null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
  DriveApp: { getFolderById: id => { if (id === 'RACINE') return racine; if (dossiers[id]) return dossiers[id]; throw Error('dossier inconnu'); }, getFileById: id => ({ getBlob: () => fichiers[id].blob }) },
  ScriptApp: {
    getProjectTriggers: () => { if (!declencheursAutorises) throw Error('Autorisation requise'); return declencheurs.slice(); },
    deleteTrigger: t => { declencheurs.splice(declencheurs.indexOf(t), 1); },
    newTrigger: fn => { const t = { fn, getHandlerFunction: () => fn }; const b = { timeBased: () => b, after: ms => { t.after = ms; return b; }, everyDays: () => b, atHour: h => { t.heure = h; return b; }, inTimezone: () => b, create: () => { declencheurs.push(t); return t; } }; return b; }
  },
  Utilities: {
    getUuid: () => 'uuid-' + Math.random().toString(36).slice(2),
    base64Decode: s => Buffer.from(s, 'base64'), base64Encode: b => Buffer.from(b).toString('base64'),
    base64EncodeWebSafe: s => Buffer.from(String(s)).toString('base64url'),
    newBlob: (octets, type, nom) => ({ octets, type, nom, getBytes: () => octets }),
    formatDate: (d, tz, f) => { const x = new Date(d), j = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(x); return f === 'yyyy-MM-dd' ? j : new Intl.DateTimeFormat('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(x).replace(/:/g, '-'); }
  }
});
vm.runInContext(fs.readFileSync('apps_script/Code.gs', 'utf8'), c);
c.getSheetsABC = n => { if (n !== 'Giono') throw Error('École inconnue'); return sheets; };
c.getAnnuaire = () => ({ GIONO: { nom: 'Giono', id: 'x' } });
c.lireCatalogueABC = () => [];
c.referencePhotoJourABC = () => '';
props.PHOTOS_SERVICE_FOLDER_ID = 'RACINE';
c.appelerGeminiParRequete = payloadIgnore => {
  appelsGemini++;
  if (geminiEnPanne) throw Error('Erreur HTTP 429 : quota');
  const texte = payload.contents[0].parts[0].text;
  const aliments = /Poulet/.test(texte) ? [{ composant: 'plat', aliment: 'Poulet', forme: 'cuisse', preparation: 'rôti', etat_reste: 'entamé', reste_pct: 40, mange_pct: 60, confiance: 'haute' }] : [];
  return { getContentText: () => JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ plateau_visible: true, resume_comportement: 'a mangé une partie', aliments }) }] } }] }) };
};


// Réponse simulée : riz à moitié, compote intacte dans son pot, muffin entamé sous film, pain, pomme entamée,
// plus des objets (pot vide, opercule, serviette, trognon).
c.appelerGeminiParRequete = payload => {
  appelsGemini++;
  const texte = payload.contents[0].parts[0].text;
  assert.match(texte, /dans_emballage/); assert.match(texte, /"objets"/);
  const r = { plateau_visible: true, resume_comportement: 'test', aliments: [
    { composant: 'accompagnement', aliment: 'Riz', forme: 'grains', preparation: 'nature', etat_reste: 'entamé', reste_pct: 50, mange_pct: 50, dans_emballage: false, confiance: 'haute' },
    { composant: 'dessert', aliment: 'Compote', forme: 'pot', preparation: 'pomme', etat_reste: 'intact', reste_pct: 100, mange_pct: 0, dans_emballage: true, confiance: 'haute' },
    { composant: 'pain', aliment: 'Pain', forme: 'tranche', preparation: 'nature', etat_reste: 'entamé', reste_pct: 40, mange_pct: 60, dans_emballage: false, confiance: 'haute' },
    { composant: 'dessert', aliment: 'Pomme', forme: 'entière', preparation: 'crue', etat_reste: 'entamé', reste_pct: 20, mange_pct: 80, dans_emballage: false, confiance: 'haute' }],
    objets: [{ type: 'pot', nombre: 2 }, { type: 'opercule', nombre: 1 }, { type: 'serviette', nombre: 2 }, { type: 'epluchure', nombre: 1 }, { type: 'inconnu', nombre: 3 }, { type: 'film', nombre: 99 }] };
  return { getContentText: () => JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(r) }] } }] }) };
};
const P = { portion_entree_g: 80, portion_plat_g: 100, portion_garniture_g: 150, portion_dessert_g: 100, portion_fruit_g: 150, portion_pain_g: 50, prix_kg_eur: 4.5 };

// 1. Tri d'un plateau : chaque reste dans sa poubelle, objets convertis en grammes (poids par défaut).
const t = c.trierDechetsPlateauABC([
  { composant: 'accompagnement', aliment: 'Riz', reste_g_ref: 75, dans_emballage: false },
  { composant: 'dessert', aliment: 'Compote', reste_g_ref: 100, dans_emballage: true },
  { composant: 'pain', aliment: 'Pain', reste_g_ref: 20, dans_emballage: false },
  { composant: 'dessert', aliment: 'Pomme', reste_g_ref: 30, dans_emballage: false },
  { composant: 'accompagnement', aliment: 'Pommes de terre', reste_g_ref: 10, dans_emballage: false }],
  [{ type: 'pot', nombre: 2 }, { type: 'serviette', nombre: 2 }, { type: 'epluchure', nombre: 1 }, { type: 'os', nombre: 1 }, { type: 'film', nombre: 99 }], {});
assert.deepEqual(JSON.parse(JSON.stringify(t.bacs)), { biodechets: 75 + 10 + 15, fruits: 30 + 25, pain: 20, emballages: 100 + 12 + 10 * 2, serviettes: 6 });
assert.equal(t.objets.film, 10, 'nombre plafonné à 10 par plateau');
assert.equal(c.estFruitFraisABC('Compote pomme pêche'), false); assert.equal(c.estFruitFraisABC('Clémentine'), true); assert.equal(c.estFruitFraisABC('Pommes de terre'), false);

// 2. Scan analysé tout de suite : la répartition est enregistrée dans le détail (colonne K) et relue par le tableau de bord.
const midi = new Date(Math.floor((Date.now() - 3600000) / 1000) * 1000); // toujours dans le passé (une heure future est refusée)
const jour = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(midi);
c.handleLogMenu({ ecole: 'Giono', date_menu: jour, menu_complet: 'Salade | Poulet | Riz | Compote' });
const IMG = 'data:image/jpeg;base64,' + Buffer.from('plateau').toString('base64');
let r = c.handleLogScanImage({ etablissement: 'Giono', image_base64: IMG, avis_eleve: 'ok', scan_id: 'b1', horodatage: midi.toISOString(), choix_plat: '' });
assert.ok(r.details.bacs);
let ligne = sheets.gaspillage.rows.find(l => l[11] === 'b1');
const bacs = c.bacsDuDetailABC(ligne[10]);
assert.deepEqual(JSON.parse(JSON.stringify(bacs)), { biodechets: 75, fruits: 30 + 25, pain: 20, emballages: 100 + 12 + 1 + 20, serviettes: 6 });
assert.equal(c.bacsDuDetailABC('{"retenus":[]}'), null, 'ancien scan : pas de répartition');

// 3. Réanalyse d'une journée : ancien résultat archivé, scans remis en attente, puis réanalysés.
ligne[2] = 'ANCIEN RÉSULTAT'; ligne[10] = '{"retenus":[],"ecartes":0}';
sheets.gaspillage.rows.push([midi, 'SCAN_ECHEC', 'aucun plateau', 0, 0, 0, 0, 0, 0, 'ok', '', 'b2', ligne[12]]);
sheets.gaspillage.rows.push([midi, 'SCAN_IA_VISION', 'sans photo', 0, 0, 0, 0, 0, 0, 'ok', '', 'b3', '']);
const avant = appelsGemini;
assert.equal(c.handleReanalyserJourABC({ ecole: 'Giono', date: jour }).plateaux, 2, 'seuls les scans avec photo');
assert.equal(sheets.gaspillage.rows.find(l => l[11] === 'b1')[1], 'SCAN_EN_ATTENTE');
assert.equal(sheets.gaspillage.rows.find(l => l[11] === 'b3')[1], 'SCAN_IA_VISION', 'scan sans photo intact');
assert.equal(sheets.gaspillage.rows.find(l => l[11] === 'b1')[9], 'ok', 'avis conservé');
const archives = sheetsSupplementaires.Historique_Analyses.rows;
assert.equal(archives.length, 3); assert.equal(archives[1][4], 'ANCIEN RÉSULTAT');
c.analyserScansEnAttenteABC();
assert.equal(appelsGemini, avant + 2);
['b1', 'b2'].forEach(id => { const l = sheets.gaspillage.rows.find(x => x[11] === id); assert.equal(l[1], 'SCAN_IA_VISION'); assert.ok(c.bacsDuDetailABC(l[10])); assert.match(l[12], /drive/); });
assert.throws(() => c.reanalyserJourABC('Giono', '2099-01-01'), /future/);
assert.throws(() => c.reanalyserJourABC('Giono', '02/11/2026'), /invalide/);

// 3b. Essai sur un échantillon réparti, et retour de l'ancien résultat si la réanalyse échoue définitivement.
const veille = new Date(midi.getTime() - 86400000), jourVeille = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(veille);
const photoOk = sheets.gaspillage.rows.find(l => l[11] === 'b1')[12];
for (let k = 0; k < 10; k++) sheets.gaspillage.rows.push([veille, 'SCAN_IA_VISION', 'ANCIEN ' + k, 10, 20, 30, 40, 50, 0.2, 'avis' + k, '{"retenus":[]}', 'v' + k, k === 0 ? 'https://drive.google.com/file/d/photo-introuvable-xx/view' : photoOk]);
assert.equal(c.handleReanalyserJourABC({ ecole: 'Giono', date: jourVeille, limite: 3 }).plateaux, 3, 'échantillon de 3');
const pris = sheets.gaspillage.rows.filter(l => /^v\d$/.test(l[11]) && l[1] === 'SCAN_EN_ATTENTE').map(l => l[11]);
assert.deepEqual(pris, ['v0', 'v3', 'v6'], 'échantillon réparti sur le service');
for (let k = 0; k < 4; k++) { c.handleRelancerScansEnAttenteABC({ ecole: 'Giono' }); c.analyserScansEnAttenteABC(); }
const v0 = sheets.gaspillage.rows.find(l => l[11] === 'v0');
assert.equal(v0[1], 'SCAN_IA_VISION'); assert.equal(v0[2], 'ANCIEN 0', 'photo introuvable : ancien résultat remis en place'); assert.equal(v0[7], 50);
assert.ok(c.bacsDuDetailABC(sheets.gaspillage.rows.find(l => l[11] === 'v3')[10]), 'réanalysé avec la nouvelle méthode');
assert.equal(sheets.gaspillage.rows.find(l => l[11] === 'v1')[2], 'ANCIEN 1', 'hors échantillon : intact');


c.handleSaveParametres({ ecole: 'Giono', parametres: { poids_pot_g: 8 } });
assert.throws(() => c.handleSaveParametres({ ecole: 'Giono', parametres: { poids_pot_g: 900 } }), /hors limites/);

console.log('OK : tri par poubelle (biodéchets, fruits, pain, emballages avec contenu, serviettes), objets en grammes, répartition relue par le tableau de bord, réanalyse d\'une journée avec archive de l\'ancien résultat.');
