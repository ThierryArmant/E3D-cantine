// Le nom confirmé dans le menu du jour l'emporte : un produit = un seul nom dans les statistiques.
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const c = vm.createContext({}); vm.runInContext(fs.readFileSync('apps_script/Code.gs', 'utf8'), c);
const menu = "Salade verte + Avocat + Carottes râpées (Sauce mayonnaise) | Boulettes de viande + Poisson (Sauce Tomate) | Riz blanc + Haricots verts + Pain | Compote pomme pêche + Muffin aux pépites de chocolat 🧑‍🍳 + Fromage (Gâteau individuel)";
const m = c.nomsMenuJourABC(menu);
assert.deepEqual([...m.dessert], ['Compote pomme pêche', 'Muffin aux pépites de chocolat', 'Fromage'], 'nom générique écarté, emoji retiré');
const r = (n, comp) => c.rapprocherNomMenuABC(n, comp, m);
assert.equal(r('Gâteau', 'dessert'), 'Muffin aux pépites de chocolat');
assert.equal(r('Muffin', 'dessert'), 'Muffin aux pépites de chocolat');
assert.equal(r('Chocolat', 'dessert'), 'Muffin aux pépites de chocolat', 'les pépites ne font pas un aliment à part');
assert.equal(r('Compote', 'dessert'), 'Compote pomme pêche');
assert.equal(r('Riz', 'accompagnement'), 'Riz blanc');
assert.equal(r('Boulettes', 'plat'), 'Boulettes de viande');
assert.equal(r('Pain', 'pain'), 'Pain');
assert.equal(r('Yaourt', 'dessert'), null, 'hors menu : nom proposé conservé');
assert.equal(c.rapprocherNomMenuABC('Gâteau', 'dessert', c.nomsMenuJourABC('a | b | c | Tarte aux pommes + Cake marbré')), null, 'deux gâteaux au menu : pas de choix au hasard');
console.log('OK : noms du menu du jour prioritaires, générique et ingrédients ramenés au produit, hors menu conservé.');
