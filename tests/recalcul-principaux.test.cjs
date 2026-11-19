// Recalcul gratuit d'un jour passé (règle « aliments principaux ») : ancien résultat archivé, olives retirées.
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const c = vm.createContext({ Logger: { log() {} }, SpreadsheetApp: { flush() {} }, PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) } });
vm.runInContext(fs.readFileSync('apps_script/Code.gs', 'utf8'), c);
const params = { portion_entree_g: 80, portion_plat_g: 100, portion_garniture_g: 150, portion_dessert_g: 100, portion_fruit_g: 150, portion_pain_g: 50, prix_kg_eur: 4.5, poids_serviette_g: 3 };
const ret = (aliment, composant, pct, portion) => ({ aliment, aliment_brut: aliment, composant, reste_pct: pct, portion_ref_g: portion, reste_g_ref: Math.round(portion * pct / 100), forme: 'x', preparation: 'x', confiance: 'haute' });
const json = { retenus: [ret('Poisson blanc', 'plat', 40, 100), ret('Olives noires', 'plat', 80, 100), ret('Boulgour', 'accompagnement', 30, 150)], bacs: { biodechets: 165 }, objets: { serviette: 1 } };
const grille = [
  ['Horodatage', 'Type'],
  ['2026-11-16T11:31:36Z', 'SCAN_IA_VISION', 'A mangé une partie | DÉTAIL INGRÉDIENTS : [ancien]', 0, 40, 0, 0, 165, 0.74, '🔴', JSON.stringify(json), 'id1'],
  ['2026-11-13T11:00:00Z', 'SCAN_IA_VISION', 'autre jour', 0, 0, 0, 0, 10, 0, '', '{}', 'id2']
];
const plage = (r, col, nr, nc) => ({
  getValues: () => grille.slice(r - 1, r - 1 + nr).map(l => Array.from({ length: nc }, (_, k) => l[col - 1 + k] === undefined ? '' : l[col - 1 + k])),
  setValues: v => v.forEach((l, i) => l.forEach((x, k) => { grille[r - 1 + i][col - 1 + k] = x; }))
});
const histo = [];
const hist = { getLastRow: () => histo.length + 1, getRange: () => ({ setValues: v => v.forEach(l => histo.push(l)) }) };
const sheets = { gaspillage: { getLastRow: () => grille.length, getRange: plage }, menus: { getParent: () => ({ getSheetByName: () => hist }) } };
c.getSheetsABC = () => sheets; c.getParametres = () => params; c.avecVerrouABC = (t, f) => f(); c.actualiserComparaisonPesees = () => {};
c.dateIso = d => String(d).slice(0, 10) === '2026-11-16' || String(d).startsWith('2026-11-16') ? '2026-11-16' : (String(d).startsWith('2026-11-13') ? '2026-11-13' : String(d).slice(0, 10));
c.getMenuDuJour = () => 'Salade verte | cote de porc grillée + Poisson blanc (Sauce Tomate, Olives noires) | Boulgour + Pain | Pommes';
const r = c.recalculerPrincipauxJourABC('GIONO', '2026-11-16');
assert.equal(r.plateaux, 1); assert.equal(r.avant_g, 165); assert.equal(r.apres_g, 85);
assert.equal(grille[1][7], 85, 'poids du plateau : 40 + 45 g'); assert.equal(grille[1][4], 35);
const j = JSON.parse(grille[1][10]);
assert.equal(j.secondaires[0].aliment, 'Olives noires'); assert.equal(j.bacs.biodechets, 85); assert.equal(j.bacs.serviettes, 3);
assert.ok(/DÉTAIL INGRÉDIENTS : \[Poisson blanc/.test(grille[1][2]));
assert.equal(histo.length, 1, 'ancien résultat archivé'); assert.equal(JSON.parse(histo[0][11]).retenus.length, 3);
assert.equal(grille[2][7], 10, 'autre jour inchangé');
console.log('OK : recalcul gratuit d\'un jour, ancien résultat archivé, accompagnements retirés.');
