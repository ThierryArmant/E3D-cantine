const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'), gs=fs.readFileSync('apps_script/Code.gs','utf8');
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
new vm.Script(gs);new vm.Script(fs.readFileSync('abc-catalogue.js','utf8'));
// Serveur : simulation de deux classeurs indépendants et de la feuille Catalogue.
class Sheet {constructor(rows=[]){this.rows=rows;}appendRow(l){this.rows.push(l);}getDataRange(){return {getValues:()=>this.rows.map(r=>[...r])};}getRange(row,col,n=1,width=1){return {setValues:values=>{values.forEach((v,i)=>{this.rows[row-1+i]||=[];v.forEach((x,j)=>this.rows[row-1+i][col-1+j]=x);});}};}}
const classeurs={A:{},B:{}};
function sheets(name){const store=classeurs[name];const ss={getSheetByName:n=>store[n]||null,insertSheet:n=>store[n]=new Sheet()};return {menus:{getParent:()=>ss}};}
let uuid=0;
const ctx=vm.createContext({LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Utilities:{getUuid:()=> 'test-'+(++uuid)},SpreadsheetApp:{flush(){}}});
vm.runInContext(gs,ctx);ctx.getSheetsABC=name=>sheets(name);
let a=ctx.reponseCatalogueABC(sheets('A'));assert.equal(a.catalogue.length,118);
assert.equal(classeurs.B.Catalogue,undefined);
let add=ctx.handleCatalogueABC({ecole:'A',operation:'save',rubrique:'plat',nature:'option',libelle:'Sauce curri'});
const id=add.id;
assert.ok(ctx.lireCatalogueABC(sheets('A')).some(x=>x.id===id));
assert.ok(!ctx.lireCatalogueABC(sheets('B')).some(x=>x.id===id));
let edit=ctx.handleCatalogueABC({ecole:'A',operation:'save',id,revision:1,rubrique:'plat',nature:'option',libelle:'Sauce curry maison'});
let fiche=edit.catalogue.find(x=>x.id===id);assert.ok(fiche.alias.includes('Sauce curri'));assert.equal(fiche.id,id);
assert.equal(ctx.identifierCatalogueABC('Sauce curri','plat',edit.catalogue).id,id);
assert.throws(()=>ctx.handleCatalogueABC({ecole:'A',operation:'save',id,revision:1,rubrique:'plat',nature:'option',libelle:'Sauce dépassée'}),/autre appareil/);
let cible=edit.catalogue.find(x=>x.libelle==='Sauce curry'&&x.rubrique==='plat');
const merged=ctx.handleCatalogueABC({ecole:'A',operation:'merge',id,revision:2,cibleId:cible.id});
assert.equal(ctx.identifierCatalogueABC('Sauce curri','plat',merged.catalogue).id,cible.id);
assert.throws(()=>ctx.handleCatalogueABC({ecole:'B',operation:'deactivate',id,revision:3}),/introuvable/);
// Dates : aucun repli vers un menu d'un autre jour.
ctx.dateIso=d=>String(d);
assert.equal(ctx.getMenuDuJour({menus:new Sheet([['Date'],['2026-10-16','CONFIGURATION_MENU','Poulet']])},'2026-10-20'),'');
assert.equal(ctx.getMenuDuJour({menus:new Sheet([['Date'],['2026-10-16','CONFIGURATION_MENU','Poulet']])},'2026-10-16'),'Poulet');
// Correction d'analyse réversible, limitée à la date et au self, sans modification des scans.
ctx.handleCorrectionAlimentABC({ecole:'A',date:'2026-10-16',aliment:'poisson curry',exclure:true});
assert.ok(ctx.lireExclusionsAnalysesABC(sheets('A'))['2026-10-16'].includes('poisson curry'));
assert.equal(ctx.lireExclusionsAnalysesABC(sheets('B'))['2026-10-16'],undefined);
assert.equal(ctx.lireExclusionsAnalysesABC(sheets('A'))['2026-10-17'],undefined);
ctx.handleCorrectionAlimentABC({ecole:'A',date:'2026-10-16',aliment:'poisson curry',exclure:false});
assert.equal(ctx.lireExclusionsAnalysesABC(sheets('A'))['2026-10-16'].length,0);
// La correction d'une pesée remplace une ligne et conserve le total lors d'un transfert de bac.
const sacsA=new Sheet([['Date','Alim','Fruits','Pain','Emb','Serv'],['2026-10-16',5,0,1,0,0],['2026-10-17',3,0,0,0,0]]);
const sacsB=new Sheet([['Date'],['2026-10-16',9,0,0,0,0]]);
ctx.getSheetsABC=name=>({...sheets(name),sacs:name==='A'?sacsA:sacsB});ctx.actualiserComparaisonPesees=()=>({});
const ancien=ctx.lirePeseesDetailABC(ctx.getSheetsABC('A'))[0];
ctx.handleCorrigerPeseeABC({ecole:'A',ligne:2,revision:ancien.revision,alimentaire:4,fruits:0,pain:2,emballages:0,serviettes:0});
assert.equal(sacsA.rows.length,3);assert.equal(sacsA.rows[1][1]+sacsA.rows[1][3],6);assert.equal(sacsA.rows[2][1],3);assert.equal(sacsB.rows[1][1],9);
assert.throws(()=>ctx.handleCorrigerPeseeABC({ecole:'A',ligne:2,revision:ancien.revision,alimentaire:4,fruits:0,pain:2,emballages:0,serviettes:0}),/modifiée/);
// Client : noms équivalents, exclusions datées et conservation des masses.
const local=new Map();
const c=vm.createContext({document:{getElementById:()=>({value:'A'})},localStorage:{getItem:k=>local.get(k)||null},globalRawData:{historiqueMenus:{'2026-10-16':'Menu vendredi'}}});
const util=html.slice(html.indexOf('        const COEFFICIENTS_INEVITABLES'),html.indexOf('        function initSystemVoices'));
const carbone=html.match(/        const COEFFICIENTS_CARBONE_ADEME = \{[\s\S]*?\n        \};/)[0];
vm.runInContext(carbone+'\n'+util,c);
c.normalizeDate=x=>String(x||'').slice(0,10);
const scan=n=>`[${n} : 40% restes | entree | confiance haute]`;
assert.equal(c.itemsStatistiques(scan('Carottes rapées'),'2026-10-16')[0].nom,c.itemsStatistiques(scan('Carottes râpées 🧑‍🍳'),'2026-10-16')[0].nom);
assert.equal(c.itemsStatistiques(scan('Poisson cury'),'2026-10-16')[0].nom,c.itemsStatistiques(scan('Poisson curry'),'2026-10-16')[0].nom);
assert.ok(c.itemsStatistiques(scan('Entrée'),'2026-10-16')[0].incertain);
local.set('exclusionsABC_A_2026-10-16',JSON.stringify(['Poisson cury']));
assert.equal(c.itemsStatistiques(scan('Poisson curry'),'2026-10-16').length,0);
assert.equal(c.itemsStatistiques(scan('Poisson curry'),'2026-10-17').length,1);
local.clear();
c.globalRawData.exclusionsAnalyses={'2026-10-16':['poisson curry']};
assert.equal(c.itemsStatistiques('[Poisson - morceaux - sauce curry : 50% restes | plat | confiance haute]','2026-10-16').length,0);
assert.equal(c.itemsStatistiques('[Poisson - morceaux - pané : 50% restes | plat | confiance haute]','2026-10-16').length,1);
const calSrc=html.slice(html.indexOf('        function calculerCalibrage('),html.indexOf('        function applyCalculationsForDateRange('));
c.facteurCarboneEtat=()=>1;c.estFruit=()=>false;c.globalRawData={sacsHistory:{datesRaw:['2026-10-16','2026-10-16'],alimentaire:[3,5],fruits:[0,0],pain:[0,0]},rawGaspillage:[{type:'SCAN_IA_VISION',dateRaw:'2026-10-16',commentaire:scan('Carottes rapées')},{type:'SCAN_IA_VISION',dateRaw:'2026-10-16',commentaire:scan('Carottes râpées')}],parametres:{effectif_defaut:10}};
vm.runInContext(calSrc,c);const cal=c.calculerCalibrage('2026-10-16','2026-10-16');
assert.equal(Object.keys(cal.items).length,1);assert.equal(cal.items['Carottes râpées'].totalKg,8);
assert.equal(cal.jours['2026-10-16'].evitableKg+cal.jours['2026-10-16'].inevitableKg,8);
assert.ok(html.includes('for (const d of Object.keys(peseesParJour))'));
const order=['menu-view-dashboard',"L'Espace des Éco-Délégués",'menu-view-cuisinier','menu-view-borne','menu-view-saisie-dechets','Espace cuisine','menu-view-rapport','menu-view-precision','menu-audit'].map(x=>html.indexOf(x));
assert.ok(order.every((x,i)=>!i||x>order[i-1]));
// Reprise du menu du 16 : les anciennes préparations sont reconstituées en bases et options.
const front=vm.createContext({renderLocalFavorites(){},getCurrentCheckedMenu(){},document:{addEventListener(){}},Intl});
vm.runInContext(fs.readFileSync('abc-catalogue.js','utf8'),front);
const noms=vm.runInContext(`ABC_CATALOGUE.items=ABC_CATALOGUE_INITIAL.map((x,i)=>({...x,id:'initial-'+i,actif:true,alias:[]}));const ids=abcLireMenuEnregistre('Sans entrée | Poisson cury + Poulet rôti | Riz | Glace');ABC_CATALOGUE.items.filter(x=>ids.includes(x.id)).map(x=>x.libelle);`,front);
assert.ok(noms.includes('Poisson')&&noms.includes('Poulet')&&noms.includes('Sauce curry')&&noms.includes('Riz'));
console.log('Vérifications réussies : catalogue isolé, corrections datées réversibles, transfert de bac sans doublon, conservation des autres lignes, rechargement du menu, masses et syntaxe.');
