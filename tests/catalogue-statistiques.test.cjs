const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../abc-catalogue.js'),'utf8');
function fonction(nom){const debut=source.indexOf('function '+nom+'('),fin=source.indexOf('\nfunction ',debut+1);return source.slice(debut,fin<0?source.length:fin);}
const contexte=vm.createContext({document:{getElementById:()=>({value:'A'})},ABC_CATALOGUE:{school:'A',items:[{id:'salade',libelle:'salade de saumon',alias:[],rubrique:'entree'}]}});
for(const nom of ['abcCle','abcEcole','abcFicheFinale','abcNomCatalogue'])vm.runInContext(fonction(nom),contexte);
assert.equal(contexte.abcNomCatalogue('Salade de saumon','plat'),contexte.abcNomCatalogue('Salade de saumon','entree'));
assert.equal(contexte.abcNomCatalogue('Aliment inconnu','plat'),'Aliment inconnu');
vm.runInContext("ABC_CATALOGUE.items=[{id:'a',libelle:'Soupe maison',alias:['Soupe'],rubrique:'entree'},{id:'b',libelle:'Soupe légumes',alias:['Soupe'],rubrique:'plat'}]",contexte);
assert.equal(contexte.abcNomCatalogue('Soupe','dessert'),'Soupe');
assert.equal(contexte.abcNomCatalogue('Soupe','plat'),'Soupe légumes');
vm.runInContext("ABC_CATALOGUE.school='B'",contexte);
assert.equal(contexte.abcNomCatalogue('Soupe','plat'),'Soupe');
console.log('OK : nom unique malgré une mauvaise rubrique IA, ambiguïtés conservées et établissements isolés.');
