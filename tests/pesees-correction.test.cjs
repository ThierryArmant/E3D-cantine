// Tests de validation du journal du 6 novembre : ajout, correction, suppression des pesées, mode fruits.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../apps_script/Code.gs', 'utf8');
function feuille(nom, lignes) {
  const f = { nom, lignes, getDataRange: () => ({ getValues: () => f.lignes.map(l => l.slice()) }),
    getRange: (r, c, nr, nc) => ({ getValue: () => (f.lignes[r - 1] || [])[c - 1], setValue: v => { while (f.lignes[r - 1].length < c) f.lignes[r - 1].push(''); f.lignes[r - 1][c - 1] = v; },
      setValues: vals => vals.forEach((row, i) => row.forEach((v, j) => { const L = f.lignes[r - 1 + i]; while (L.length < c + j) L.push(''); L[c - 1 + j] = v; })) }),
    appendRow: l => f.lignes.push(l.slice()), deleteRow: r => f.lignes.splice(r - 1, 1), getParent: () => ss };
  return f;
}
const ss = { feuilles: {}, getSheetByName: n => ss.feuilles[n] || null, insertSheet: n => (ss.feuilles[n] = feuille(n, [])) };
const sacs = feuille('Pesees_Sacs', [['Horodatage', 'Sac_Alimentaire_kg', 'Sac_Fruits_kg', 'Sac_Pain_kg', 'Sac_Emballages_kg', 'Sac_Serviettes_kg']]);
ss.feuilles.Pesees_Sacs = sacs;
const ctx = { console, JSON, Math, Date, Number, String, Object, Array, parseFloat, isNaN, Error,
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, hasLock() { return false; }, releaseLock() {} }) }, SpreadsheetApp: { flush() {} },
  Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) }, Session: { getScriptTimeZone: () => 'Europe/Paris' } };
vm.createContext(ctx);
vm.runInContext(src, ctx);
vm.runInContext('getSheetsABC = function(){ return { sacs: __sacs }; }; actualiserComparaisonPesees = function(){}; dateIso = function(d){ if (d instanceof Date) { const p = n => String(n).padStart(2,"0"); return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate()); } return String(d).slice(0,10); };', Object.assign(ctx, { __sacs: sacs }));
const total = (date, cle) => ctx.lirePeseesDetailABC({ sacs }).filter(p => p.date === date).reduce((t, p) => t + p[cle], 0);
const d = '2026-11-09', E = 'COLLEGE J. GIONO';
// 1. saisie initiale 12 kg
ctx.handleLogBagWeights({ ecole: E, date_pesee: d, sac_alimentaire: '12', sac_fruits: '0', sac_pain: '0', sac_emballages: '0', sac_serviettes: '0', fruits_dans_biodechets: true });
assert.strictEqual(total(d, 'alimentaire'), 12);
// 2. correction 12 → 8, sans nouvelle ligne
let p = ctx.lirePeseesDetailABC({ sacs }).find(x => x.date === d);
const n0 = sacs.lignes.length;
ctx.handleCorrigerPeseeABC({ ecole: E, ligne: p.ligne, revision: p.revision, alimentaire: 8, fruits: 0, pain: 0, emballages: 0, serviettes: 0, fruits_dans_biodechets: true });
assert.strictEqual(sacs.lignes.length, n0); assert.strictEqual(total(d, 'alimentaire'), 8);
// révision périmée refusée (modification concurrente)
assert.throws(() => ctx.handleCorrigerPeseeABC({ ecole: E, ligne: p.ligne, revision: p.revision, alimentaire: 5, fruits: 0, pain: 0, emballages: 0, serviettes: 0 }), /modifiée/);
// 3. ajout volontaire d'un second sac de 3 kg → 11 kg
ctx.handleLogBagWeights({ ecole: E, date_pesee: d, sac_alimentaire: '3', sac_fruits: '0', sac_pain: '0', sac_emballages: '0', sac_serviettes: '0', fruits_dans_biodechets: true });
assert.strictEqual(total(d, 'alimentaire'), 11);
// double envoi identique : pas de doublon
assert.strictEqual(ctx.handleLogBagWeights({ ecole: E, date_pesee: d, sac_alimentaire: '3', sac_fruits: '0', sac_pain: '0', sac_emballages: '0', sac_serviettes: '0' }).doublon, true);
assert.strictEqual(total(d, 'alimentaire'), 11);
// pesée vide refusée
assert.throws(() => ctx.handleLogBagWeights({ ecole: E, date_pesee: d, sac_alimentaire: '0', sac_fruits: '0', sac_pain: '0', sac_emballages: '0', sac_serviettes: '0' }), /Aucun poids/);
// 4. suppression du sac de 3 kg → 8 kg, copie archivée
const sac3 = ctx.lirePeseesDetailABC({ sacs }).find(x => x.date === d && x.alimentaire === 3);
ctx.handleSupprimerPeseeABC({ ecole: E, ligne: sac3.ligne, revision: sac3.revision });
assert.strictEqual(total(d, 'alimentaire'), 8);
assert.strictEqual(ss.feuilles.Pesees_Supprimees.lignes.length, 2);
// 5. fruits inclus dans les biodéchets : drapeau gardé, aucun poids fruits ajouté
p = ctx.lirePeseesDetailABC({ sacs }).find(x => x.date === d);
assert.strictEqual(p.fruitsDansBio, true); assert.strictEqual(total(d, 'fruits'), 0);
// 6. établissement qui pèse les fruits à part : addition simple, sans double comptage
const d2 = '2026-11-10';
ctx.handleLogBagWeights({ ecole: E, date_pesee: d2, sac_alimentaire: '10', sac_fruits: '1.5', sac_pain: '1', sac_emballages: '0', sac_serviettes: '0', fruits_dans_biodechets: false });
assert.strictEqual(total(d2, 'alimentaire') + total(d2, 'fruits'), 11.5);
assert.strictEqual(ctx.lirePeseesDetailABC({ sacs }).find(x => x.date === d2).fruitsDansBio, false);
// 7. correction d'une pesée ancienne : les autres jours ne bougent pas
const avant = JSON.stringify(sacs.lignes.filter(l => l[0] instanceof Date && ctx.dateIso(l[0]) === d2));
p = ctx.lirePeseesDetailABC({ sacs }).find(x => x.date === d);
ctx.handleCorrigerPeseeABC({ ecole: E, ligne: p.ligne, revision: p.revision, alimentaire: 7.5, fruits: 0, pain: 0.4, emballages: 0, serviettes: 0 });
assert.strictEqual(total(d, 'alimentaire'), 7.5);
assert.strictEqual(JSON.stringify(sacs.lignes.filter(l => l[0] instanceof Date && ctx.dateIso(l[0]) === d2)), avant);
assert.strictEqual(ctx.lirePeseesDetailABC({ sacs }).find(x => x.date === d).fruitsDansBio, true); // drapeau conservé si non transmis
console.log('pesees-correction ok');
