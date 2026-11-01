// Bilan carbone du réseau : classement des plats, calcul mesuré, copie identique dans le script, envoi vers « Import A.B.C. ».
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const b = require('../abc-bilan.js');

// 1. Le calcul partagé est identique dans la page et dans le script Google.
const bloc = t => { const a = t.indexOf('// --- CALCUL PARTAGÉ'), z = t.indexOf('// --- FIN DU CALCUL PARTAGÉ ---'); assert.ok(a >= 0 && z > a); return t.slice(a, z); };
assert.equal(bloc(fs.readFileSync('apps_script/Code.gs', 'utf8')), bloc(fs.readFileSync('abc-bilan.js', 'utf8')), 'recopier le bloc partagé de abc-bilan.js dans Code.gs');

// 2. Classement : porc et plats mixtes en repas moyen, choix explicites.
const attendu = { 'Poulet rôti': 'blanche', 'Escalope de dinde': 'blanche', 'Cordon bleu': 'blanche', 'Poisson pané': 'poisson', 'Filet de colin': 'poisson',
  'Steak haché': 'rouge', 'Bœuf Bourguignon': 'rouge', 'Gardiane de Taureau': 'rouge', 'Omelette': 'vege', 'Nuggets végétaux': 'vege', 'Croustillant fromager bio': 'vege',
  'Lasagnes': 'moyen', 'Couscous': 'moyen', 'Rôti de porc': 'moyen', 'Saucisse': 'moyen', 'Chili (Con Carné/Végé)': 'moyen', 'Paella': 'moyen', 'Plat mystère': null };
Object.keys(attendu).forEach(k => assert.equal(b.bilanCategorie(k), attendu[k], k));
assert.deepEqual(b.bilanPlats('Carottes | Poulet + Poisson 🧑‍🍳 (Sauce curry) | Riz | Yaourt'), ['Poulet', 'Poisson']);
assert.deepEqual(b.bilanPlats('Salade | Sans plat | Riz | Fruit'), []);

// 3. Calcul : seulement le mesuré, choix répartis selon les plateaux, déchets pesés.
const data = {
  historiqueMenus: { '2026-11-02': 'Carottes | Poulet + Poisson | Riz | Yaourt', '2026-11-03': 'Salade | Lasagnes | Sans accomp. | Fruit', '2026-11-05': 'Salade | Plat mystère | Riz | Fruit', '2026-11-06': 'x | Poulet + Poisson | y | z', '2026-06-20': 'x | Steak haché | y | z' },
  historiqueEffectifs: { '2026-11-02': 400, '2026-11-03': 420, '2026-11-06': 300 }, parametres: { effectif_defaut: 450 },
  rawGaspillage: [
    { type: 'SCAN_IA_VISION', dateRaw: '2026-11-02', commentaire: 'a | DÉTAIL INGRÉDIENTS : [Poulet - cuisse - rôti : 40% restes | plat | confiance haute] [Riz - grains - nature : 10% restes | accompagnement | confiance haute]' },
    { type: 'SCAN_IA_VISION', dateRaw: '2026-11-02', commentaire: '[Poulet - x - y : 0% restes | plat | confiance haute]' },
    { type: 'SCAN_IA_VISION', dateRaw: '2026-11-02', commentaire: '[Poisson - pané - frit : 0% restes | plat | confiance moyenne]' },
    { type: 'SCAN_EN_ATTENTE', dateRaw: '2026-11-02', commentaire: 'Photo du plateau gardée' }],
  sacsHistory: { datesRaw: ['2026-11-02', '2026-06-20'], alimentaire: [12.5, 50], fruits: [2, 5], pain: [1.5, 5] }
};
const r = b.bilanCalculer(data, '2026-09-01', '2026-11-30');
assert.deepEqual(r.repas, { moyen: 420 + 450, vege: 0, rouge: 0, poisson: Math.round(400 / 3 + 150), blanche: Math.round(800 / 3 + 150) });
assert.equal(r.dechetsKg, 16); assert.equal(r.stats.jours, 4); assert.equal(r.stats.choix, 2); assert.equal(r.stats.choixSansScan, 1); assert.equal(r.stats.nonReconnus, 1);
assert.equal(r.co2Kg, Math.round(870 * 2.25 + r.repas.poisson * 2 + r.repas.blanche * 1.58 + 16 * 0.0481));

// 4. Envoi vers le fichier du réseau : une ligne par établissement, nom du bilan deviné puis conservé.
class Sheet {
  constructor(nom, rows = []) { this.nom = nom; this.rows = rows; }
  appendRow(r) { this.rows.push([...r]); }
  getLastRow() { return this.rows.length; }
  getDataRange() { return { getValues: () => this.rows.map(r => [...r]) }; }
  getRange(row, col, n = 1, w = 1) { const self = this; return {
    getValues: () => Array.from({ length: n }, (_, i) => Array.from({ length: w }, (_, j) => (self.rows[row - 1 + i] || [])[col - 1 + j] ?? '')),
    setValues: v => { v.forEach((l, i) => { while (self.rows.length < row + i) self.rows.push([]); l.forEach((x, j) => { self.rows[row - 1 + i][col - 1 + j] = x; }); }); return { setFontWeight() {} }; } }; }
  setFrozenRows() {}
}
const bilan = { 'bilan carbone': new Sheet('bilan carbone', [[''], ['Etablissements'], ['COLLEGE  J. GIONO'], ['COLLEGE  ARAUSIO'], ['école curie']]) };
const classeur = { getSheetByName: n => bilan[n] || null, insertSheet: n => (bilan[n] = new Sheet(n)) };
const c = vm.createContext({ Logger: { log() {} }, SpreadsheetApp: { openById: () => classeur, flush() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
  LockService: { getScriptLock: () => ({ hasLock: () => false, tryLock: () => true, releaseLock() {} }) },
  Utilities: { formatDate: d => new Date(d).toISOString().slice(0, 10) } });
vm.runInContext(fs.readFileSync('apps_script/Code.gs', 'utf8'), c);
c.getAnnuaire = () => ({ GIONO: { nom: 'Giono' }, 'ECOLE TEST': { nom: 'École test' } });
c.getSheetsABC = n => ({ nom: n });
c.donneesBaseABC = s => s.nom === 'Giono' ? data : { historiqueMenus: {}, sacsHistory: {} };
c.periodeBilanABC = () => ({ debut: '2026-09-01', fin: '2026-11-30' });
let res = c.envoyerBilanCarboneABC();
const imp = bilan['Import A.B.C.'];
assert.equal(imp.rows[0][1], 'Nom dans le bilan');
assert.equal(imp.rows.length, 2, 'établissement sans jour mesuré non écrit');
assert.deepEqual(imp.rows[1].slice(0, 11), ['Giono', 'COLLEGE  J. GIONO', "'2026-09-01", "'2026-11-30", 4, 870, 0, 0, r.repas.blanche, r.repas.poisson, 16]);
imp.rows[1][1] = 'COLLEGE  J. GIONO (corrigé)';
res = c.envoyerBilanCarboneABC('Giono');
assert.equal(imp.rows.length, 2); assert.equal(imp.rows[1][1], 'COLLEGE  J. GIONO (corrigé)', 'nom saisi à la main jamais écrasé');
assert.equal(res[0].nomBilan, 'COLLEGE  J. GIONO (corrigé)');
assert.equal(c.handleEnvoyerBilanCarboneABC({ ecole: 'Giono' }).bilan.jours, 4);
assert.equal(c.nomBilanProbableABC(classeur, 'Curie'), 'école curie');
assert.equal(c.nomBilanProbableABC(classeur, 'COLLEGE J. GIONO'), 'COLLEGE  J. GIONO', 'même nom, espaces ignorés');
assert.equal(c.nomBilanProbableABC(classeur, 'Collège Jean Giono'), 'COLLEGE  J. GIONO');
assert.equal(c.nomBilanProbableABC(classeur, 'COLLEGE MARIE MAURON'), '', 'établissement absent du bilan');
assert.equal(c.nomBilanProbableABC(classeur, 'Inconnu'), '');

console.log('OK : calcul identique page/script, classement des plats, mesuré seulement, choix répartis selon les plateaux, déchets pesés, envoi sans doublon et nom du bilan conservé.');
