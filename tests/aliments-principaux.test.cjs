// Aliments principaux seulement (19/11/2026) : accompagnements entre parenthèses et ingrédients listés à part
// sortent du calcul ; serviettes et emballages ne sont jamais des aliments. Plateaux réels de Giono, 16/11/2026.
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const c = vm.createContext({ Logger: { log() {} }, PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) } });
vm.runInContext(fs.readFileSync('apps_script/Code.gs', 'utf8'), c);
const params = { portion_entree_g: 80, portion_plat_g: 100, portion_garniture_g: 150, portion_dessert_g: 100, portion_fruit_g: 150, portion_pain_g: 50, portion_sauce_g: 20, prix_kg_eur: 4.5, pain_tranches: 2, poids_serviette_g: 3 };
const MENU_1611 = 'Salade verte + Salade de pommes de terre + Salade de riz | cote de porc grillée + Viande en sauce + Poisson blanc (Sauce à la moutarde, Sauce Tomate, Olives noires, Sauce aux herbes et tomate) | Boulgour + Poêlée de légumes tex mex + Pain | Pommes + Oranges + gâteau a la banane';
let menu = MENU_1611;
c.getParametres = () => params; c.getMenuDuJour = () => menu;
c.lireCatalogueABC = () => []; c.referencePhotoJourABC = () => ''; c.dateIso = () => '2026-11-16';
const analyse = (aliments, objets) => {
  c.appelerGeminiParRequete = () => ({ getContentText: () => JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ plateau_visible: true, resume_comportement: 'x', aliments: aliments, objets: objets || [] }) }] } }] }) });
  const l = c.analyserPlateauABC({}, 'AA', new Date('2026-11-16T11:00:00Z'), 'x', '').ligne;
  return { poids: l[7], j: JSON.parse(l[10]) };
};
const al = (aliment, composant, reste) => ({ aliment, composant, reste_pct: reste, mange_pct: 100 - reste, confiance: 'haute' });

// Plateau réel 12:31:36 : les olives de la sauce du poisson comptaient pour un plat entier (80 g sur 240 g).
let r = analyse([al('Poisson blanc', 'plat', 40), al('Olives noires', 'plat', 80), al('Boulgour', 'accompagnement', 30), al('Pain', 'pain', 50), al('gâteau a la banane', 'dessert', 50)]);
assert.equal(r.poids, 40 + 45 + 25 + 50, 'olives retirées : 160 g au lieu de 240 g');
assert.deepEqual(r.j.retenus.map(i => i.aliment), ['Poisson blanc', 'Boulgour', 'Pain', 'gâteau a la banane']);
assert.equal(r.j.secondaires[0].aliment, 'Olives noires');
assert.equal(r.j.methode, 'repas-reference-3-principaux');

// Olives classées en garniture par l'analyse : même règle.
r = analyse([al('Poisson blanc', 'plat', 0), al('Olives noires', 'accompagnement', 100)]);
assert.equal(r.poids, 0);

// Sauce à la moutarde seule (option du menu) : toujours hors calcul.
r = analyse([al('cote de porc grillée', 'plat', 60), al('Sauce à la moutarde', 'plat', 50)]);
assert.equal(r.poids, 60);

// Ingrédient d'un plat principal listé à part (« Poivrons » à côté de la poêlée) : écarté.
r = analyse([al('Poêlée de légumes tex mex', 'accompagnement', 50), al('Poivrons', 'accompagnement', 70)]);
assert.equal(r.poids, 75);

// Salade composée découpée en morceaux : « Thon » est reconnu comme la salade du menu, les oignons en font partie.
menu = 'Salade pomme de terre thon mayo | Poulet | Riz + Pain | Kiwi';
r = analyse([al('Thon', 'entree', 40), al('Oignons rouges', 'entree', 60)]);
assert.equal(r.poids, 32); assert.equal(r.j.retenus[0].aliment, 'Salade pomme de terre thon mayo');
// Aucun nom du menu reconnu : les morceaux forment UN seul plat, au plus fort reste (80 g × 60 %).
r = analyse([al('Oignons rouges', 'entree', 40), al('Poivrons', 'entree', 60)]);
assert.equal(r.poids, 48); assert.equal(r.j.retenus.length, 1);
menu = MENU_1611;

// Fruit ou yaourt hors menu : un vrai dessert, gardé.
r = analyse([al('gâteau a la banane', 'dessert', 0), al('Yaourt nature', 'dessert', 100)]);
assert.equal(r.j.retenus.length, 2);

// Serviette ou film listés comme aliments : jamais dans les poubelles de nourriture, ils vont dans leurs bacs.
r = analyse([al('Serviette en papier', 'entree', 100), al('Film plastique', 'dessert', 100), al('Boulgour', 'accompagnement', 0)]);
assert.equal(r.poids, 0); assert.equal(r.j.bacs.biodechets, 0); assert.equal(r.j.bacs.serviettes, 3); assert.equal(r.j.bacs.emballages, 2);

// « Bolognaise » n'est pas un bol : reste un aliment.
assert.equal(c.nonAlimentABC('Pâtes bolognaise'), null);
assert.equal(c.nonAlimentABC('Haricots verts'), null);

// Menu inconnu : rien n'est retiré.
menu = '';
r = analyse([al('Poisson blanc', 'plat', 40), al('Olives noires', 'plat', 80)]);
assert.equal(r.poids, 120);

// Portions mesurées en cuisine (Giono, 19/11) : assiette de pâtes 281 g (225 + sauce 50 + râpé 6), pain 10 g.
menu = 'Salade verte | Sauce carbonara + Omelette + râpé sur les pates (Fromage râpé) | Pâtes + Pain | Pommes';
c.lirePortionsJourABC = () => ({ '2026-11-16': { 'Pâtes': 281, 'Pain': 10 } });
r = analyse([al('Farfalles', 'accompagnement', 40), al('Fromage râpé', 'plat', 100), al('râpé sur les pates', 'plat', 100), al('Sauce carbonara', 'plat', 50), al('Pain', 'pain', 50)]);
assert.equal(r.poids, Math.round(281 * 0.4) + 5, 'pâtes 112 g + pain 5 g, râpé et sauce hors calcul');
assert.equal(r.j.retenus.find(i => i.composant === 'pain').portion_ref_g, 10);
delete c.lirePortionsJourABC;

console.log('OK : aliments principaux seulement, accompagnements et ingrédients hors calcul, serviettes et emballages à part.');
