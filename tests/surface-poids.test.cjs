// Conversion surface → poids : poids restant = portion × (% vu / 100) ^ 1,5 (pain proportionnel).
const assert = require('assert'), fs = require('fs'), vm = require('vm');
const c = vm.createContext({}); vm.runInContext(fs.readFileSync('apps_script/Code.gs', 'utf8'), c);
const g = (p, pct, comp) => vm.runInContext(`resteGrammesABC(${p}, ${pct}, ${JSON.stringify(comp)})`, c);
assert.strictEqual(g(330, 0, 'plat'), 0);
assert.strictEqual(g(330, 100, 'plat'), 330);      // portion intacte : comptée entière
assert.strictEqual(g(330, 30, 'plat'), 54);        // 30 % de surface ≈ 16 % du poids
assert.strictEqual(g(100, 50, 'dessert'), 35);
assert.strictEqual(g(25, 50, 'pain'), 13);         // pain : proportionnel
assert.strictEqual(g(80, 140, 'entree'), 80);      // borné à 100 %
console.log('surface-poids ok');
