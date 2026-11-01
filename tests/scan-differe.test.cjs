// Analyse différée des plateaux : photo gardée, ligne en attente hors statistiques, analyse après validation du menu.
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
  d.createFile = blob => { const id = 'fic-' + Object.keys(fichiers).length; fichiers[id] = { blob, dossier: d }; return { getId: () => id, getUrl: () => 'https://drive.google.com/file/d/' + id + '/view' }; };
  dossiers[d.id] = d; return d;
}
const racine = dossier('Photos');

const sheets = {
  gaspillage: new Sheet([['Horodatage', 'Type Entrée', 'Note', 'E', 'P', 'D', 'Pain', 'Poids', 'Perte', 'Avis', 'Detail']]),
  menus: new Sheet([['Horodatage', 'Type', 'Intitulé', 'Détail', 'Effectif']]),
  sacs: new Sheet([['h']]),
  parametres: new Sheet([['Paramètre', 'Valeur', 'Description']])
};

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
c.appelerGeminiParRequete = payload => {
  appelsGemini++;
  if (geminiEnPanne) throw Error('Erreur HTTP 429 : quota');
  const texte = payload.contents[0].parts[0].text;
  const aliments = /Poulet/.test(texte) ? [{ composant: 'plat', aliment: 'Poulet', forme: 'cuisse', preparation: 'rôti', etat_reste: 'entamé', reste_pct: 40, mange_pct: 60, confiance: 'haute' }] : [];
  return { getContentText: () => JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ plateau_visible: true, resume_comportement: 'a mangé une partie', aliments }) }] } }] }) };
};

const IMG = 'data:image/jpeg;base64,' + Buffer.from('photo-plateau').toString('base64');
const midi = new Date(); midi.setUTCHours(11, 35, 0, 0);
const jour = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(midi);
const scan = (id, extra = {}) => c.handleLogScanImage(Object.assign({ etablissement: 'Giono', image_base64: IMG, avis_eleve: '🟢 J\'ai tout fini', scan_id: id, horodatage: midi.toISOString(), choix_plat: 'poulet' }, extra));

// 1. Pas de menu, mode automatique : photo gardée, aucune analyse, ligne hors statistiques.
let r = scan('s1');
assert.equal(r.en_attente, true); assert.equal(appelsGemini, 0);
let ligne = sheets.gaspillage.rows.find(l => l[11] === 's1');
assert.equal(ligne[1], 'SCAN_EN_ATTENTE'); assert.match(ligne[12], /drive\.google\.com/);
assert.equal(JSON.parse(ligne[10]).choix_plat, 'poulet');
const fic = Object.values(fichiers)[0];
assert.equal(fic.dossier.nom, jour); assert.match(fic.blob.nom, /_s1\.jpg$/);
assert.ok(declencheurs.some(t => t.fn === 'filetScansEnAttenteABC' && t.heure === 19), 'passage du soir installé');
assert.equal(scan('s1').doublon, true, 'renvoi de la borne : pas de doublon');
scan('s2');
assert.equal(Object.keys(nbDossiersParNom('Plateaux')).length, 1, 'un seul dossier Plateaux');

// 2. Le menu du jour est enregistré : les plateaux en attente sont programmés, puis analysés en arrière-plan.
const res = c.handleLogMenu({ ecole: 'Giono', date_menu: jour, menu_complet: 'Carottes | Poulet + Riz | Yaourt' });
assert.equal(res.scansEnAttente, 2);
assert.ok(declencheurs.some(t => t.fn === 'analyserScansEnAttenteABC'), 'passage programmé');
c.analyserScansEnAttenteABC();
assert.equal(appelsGemini, 2);
ligne = sheets.gaspillage.rows.find(l => l[11] === 's1');
assert.equal(ligne[1], 'SCAN_IA_VISION'); assert.match(ligne[2], /Poulet/); assert.equal(ligne[4], 40);
assert.equal(ligne[0].toISOString(), midi.toISOString(), 'horodatage du scan conservé'); assert.match(ligne[12], /drive/, 'lien photo conservé');
assert.equal(c.lireFileScansABC().length, 0); assert.ok(!declencheurs.some(t => t.fn === 'analyserScansEnAttenteABC'));

// 3. Menu connu, mode automatique : analyse immédiate, photo gardée quand même.
r = scan('s3');
assert.ok(r.details); assert.equal(appelsGemini, 3);
assert.match(sheets.gaspillage.rows.find(l => l[11] === 's3')[12], /drive/);

// 4. Mode « differe » forcé, menu connu : gardé puis analysé aussitôt en arrière-plan.
c.handleSaveParametres({ ecole: 'Giono', parametres: { mode_analyse_scan: 'differe' } });
assert.equal(c.modeAnalyseScanABC(sheets), 'differe');
r = scan('s4'); assert.equal(r.en_attente, true); assert.equal(appelsGemini, 3);
c.analyserScansEnAttenteABC(); assert.equal(sheets.gaspillage.rows.find(l => l[11] === 's4')[1], 'SCAN_IA_VISION');

// 5. Quota Gemini dépassé pendant le passage : rien n'est perdu, nouvel essai programmé dans 10 min.
r = scan('s5'); geminiEnPanne = true;
c.analyserScansEnAttenteABC();
assert.equal(sheets.gaspillage.rows.find(l => l[11] === 's5')[1], 'SCAN_EN_ATTENTE');
assert.equal(JSON.parse(sheets.gaspillage.rows.find(l => l[11] === 's5')[10]).essais, 0, 'une panne passagère ne compte pas comme un échec');
assert.equal(declencheurs.find(t => t.fn === 'analyserScansEnAttenteABC').after, 600000);
geminiEnPanne = false; c.analyserScansEnAttenteABC();
assert.equal(sheets.gaspillage.rows.find(l => l[11] === 's5')[1], 'SCAN_IA_VISION');

// 6. Mode « instantane » : analyse tout de suite, même sans menu (autre jour).
c.handleSaveParametres({ ecole: 'Giono', parametres: { mode_analyse_scan: 'instantane' } });
const avant = appelsGemini; r = scan('s6', { horodatage: new Date(midi.getTime() - 86400000).toISOString() });
assert.ok(r.details); assert.equal(appelsGemini, avant + 1);
assert.throws(() => c.handleSaveParametres({ ecole: 'Giono', parametres: { mode_analyse_scan: 'nimporte' } }), /inconnu/);

// 7. Déclencheurs non autorisés : la borne analyse tout de suite (comportement d'avant), photo gardée.
c.handleSaveParametres({ ecole: 'Giono', parametres: { mode_analyse_scan: 'automatique' } });
delete cache.abc_filet_ok; declencheursAutorises = false;
const hier = new Date(midi.getTime() - 2 * 86400000).toISOString();
r = scan('s7', { horodatage: hier }); assert.ok(r.details, 'repli : analyse immédiate');
declencheursAutorises = true;

// 8. Passage du soir : un plateau resté en attente (menu jamais validé) est analysé sans menu.
r = scan('s8', { horodatage: hier }); assert.equal(r.en_attente, true);
c.filetScansEnAttenteABC();
assert.equal(sheets.gaspillage.rows.find(l => l[11] === 's8')[1], 'SCAN_IA_VISION');

// 9. Photo introuvable : 3 essais au plus, puis la ligne reste visible en attente avec l'erreur.
r = scan('s9', { horodatage: hier });
const info = JSON.parse(sheets.gaspillage.rows.find(l => l[11] === 's9')[10]); delete fichiers[info.drive_id];
for (let k = 0; k < 4; k++) { c.handleRelancerScansEnAttenteABC({ ecole: 'Giono' }); c.analyserScansEnAttenteABC(); }
const fin = JSON.parse(sheets.gaspillage.rows.find(l => l[11] === 's9')[10]);
assert.equal(fin.essais, 3); assert.ok(fin.derniere_erreur);
assert.equal(c.lireFileScansABC().length, 0, 'la file ne tourne pas en boucle');

// 10. Plateau nettoyé (« empty ») et caméra absente : inchangés.
assert.equal(scan('s10', { image_base64: 'empty' }).success, true);
assert.equal(scan('s11', { image_base64: 'data:image/jpeg;base64,image_active_simulee' }).ignore, true);

function nbDossiersParNom(nom) { const o = {}; Object.values(dossiers).filter(d => d.nom === nom).forEach(d => { o[d.id] = 1; }); return o; }
console.log('OK : photo gardée et lien en colonne M, attente hors statistiques, analyse après validation du menu, modes automatique/différé/instantané, repli sans autorisation, quota sans perte, passage du soir, essais limités, sans doublon.');
