// Repas de référence : sauce seule ignorée, traces négligées, % rapporté aux 480 g, méthode et portions enregistrées.
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const c = vm.createContext({ Logger: { log() {} }, PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) } });
vm.runInContext(fs.readFileSync('apps_script/Code.gs', 'utf8'), c);
const params = { portion_entree_g: 80, portion_plat_g: 100, portion_garniture_g: 150, portion_dessert_g: 100, portion_fruit_g: 150, portion_pain_g: 50, portion_sauce_g: 20, prix_kg_eur: 4.5, pain_tranches: 2 };
c.getParametres = () => params; c.getMenuDuJour = () => 'Salade | Boulettes (Sauce Tomate) | Riz + Pain | Muffin aux pépites de chocolat';
c.lireCatalogueABC = () => []; c.referencePhotoJourABC = () => ''; c.dateIso = () => '2026-11-02';
const analyse = aliments => {
  c.appelerGeminiParRequete = () => ({ getContentText: () => JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ plateau_visible: true, resume_comportement: 'x', aliments: aliments, objets: [] }) }] } }] }) });
  return JSON.parse(c.analyserPlateauABC({}, 'AA', new Date('2026-11-02T11:00:00Z'), 'x', '').ligne[10]);
};
const al = (aliment, composant, reste) => ({ aliment, composant, reste_pct: reste, mange_pct: 100 - reste, confiance: 'haute' });
// Plateau n° 5 : sauce étalée seule + miettes → 0 %.
let r = analyse([al('Sauce Tomate', 'plat', 60), al('Riz blanc', 'accompagnement', 3)]);
assert.equal(r.restes_pct_repas, 0); assert.deepEqual(r.residus, ['Sauce Tomate']); assert.equal(r.repas_ref_g, 480);
assert.equal(r.methode, 'repas-reference-1'); assert.equal(r.portions_ref.pain, 50);
// Plateau n° 108 : une tranche sur deux (50 %) + muffin aux 3/4 → 25 + 75 = 100 g sur 480 g = 21 %.
r = analyse([al('Pain', 'accompagnement', 50), al('Muffin aux pépites de chocolat', 'dessert', 75)]);
assert.equal(r.restes_g, 100); assert.equal(r.restes_pct_repas, 21);
// Riz entier laissé : 150 g sur 480 g = 31 %, quels que soient les autres aliments à 0 %.
r = analyse([al('Riz blanc', 'accompagnement', 100), al('Salade verte', 'entree', 0), al('Boulettes de viande', 'plat', 0)]);
assert.equal(r.restes_pct_repas, 31);
console.log('OK : sauce seule et traces négligées, % du repas de référence (480 g), méthode et portions enregistrées.');
// Deux desserts pris (muffin + compote entiers) : repas de référence 580 g, 200 g restants = 34 %.
r = analyse([al('Muffin aux pépites de chocolat', 'dessert', 100), al('Compote pomme pêche', 'dessert', 100), al('Riz blanc', 'accompagnement', 0)]);
assert.equal(r.repas_ref_g, 480, 'muffin + compote : même famille dessert'); 
r = analyse([al('Yaourt aromatisé', 'dessert', 100), al('Banane', 'dessert', 0)]);
assert.equal(r.repas_ref_g, 80 + 100 + 150 + 100 + 150 + 50, 'yaourt + fruit = 2 desserts');
r = analyse([al('Yaourt aromatisé', 'dessert', 100), al('Muffin aux pépites de chocolat', 'dessert', 0)]);
assert.equal(r.repas_ref_g, 580, 'yaourt + gâteau = 2 desserts');
r = analyse([al('Yaourt aromatisé', 'dessert', 100), al('Yaourt nature', 'dessert', 0)]);
assert.equal(r.repas_ref_g, 480, '2 yaourts = 1 dessert');
r = analyse([al('Banane', 'dessert', 0), al('Pomme', 'dessert', 0)]);
assert.equal(r.repas_ref_g, 80 + 100 + 150 + 150 + 50, '2 fruits = 1 dessert (portion fruit)');
r = analyse([al('Banane', 'dessert', 0), al('Muffin aux pépites de chocolat', 'dessert', 100)]);
assert.equal(r.repas_ref_g, 80 + 100 + 150 + 150 + 50, 'fruit + gâteau = 1 dessert');
console.log('OK : deux desserts seulement pour un laitage + un autre dessert.');
