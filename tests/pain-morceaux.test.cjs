const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(__dirname+'/../apps_script/Code.gs','utf8');
const f=new Function(src.match(/function pctPainMorceauxABC[\s\S]*?\n}\n/)[0]+'return pctPainMorceauxABC;')();
const p={pain_tranches:2};
assert.strictEqual(f({tranches:1},p),50);          // une tranche entière sur deux
assert.strictEqual(f({demi:1},p),25);              // une demi-tranche
assert.strictEqual(f({quignons:1},p),10);          // un quignon = 5 g
assert.strictEqual(f({tranches:2,quignons:3},p),100);
assert.strictEqual(f({tranches:0,demi:0,quignons:0},p),0);
assert.strictEqual(f(null,p),null);                // pas de comptage : pourcentage de l'IA
assert.strictEqual(f({tranches:1},{pain_tranches:1}),100);
assert(/morceaux_pain/.test(src)&&/pctPainMorceauxABC\(a\.morceaux_pain/.test(src));
console.log('pain-morceaux ok');
