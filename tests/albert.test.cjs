// Albert : format d'appel compatible OpenAI, repli sans response_format, lecture des jetons.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(__dirname+'/../apps_script/Code.gs','utf8');
const appels=[];let refuserFormat=true;
const ctx={console,JSON,Math,Date,String,Number,Object,Array,parseFloat,Error,
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>({ALBERT_KEY:'cle-test',FOURNISSEUR_ANALYSE:'albert'})[k]||null})},
 Utilities:{sleep(){}},
 UrlFetchApp:{fetch:(url,o)=>{const b=JSON.parse(o.payload);appels.push({url,b,h:o.headers});
  if(refuserFormat&&b.response_format){return{getResponseCode:()=>400,getContentText:()=>'response_format not supported'};}
  return{getResponseCode:()=>200,getContentText:()=>JSON.stringify({choices:[{message:{content:'```json\n{"plateau_visible":true,"aliments":[]}\n```'}}],usage:{prompt_tokens:1200,completion_tokens:80}})};}}};
vm.createContext(ctx);vm.runInContext(src,ctx);
assert.equal(ctx.modeleAlbertABC(),'mistral-small-3-2-24b-instruct-2506');
const r=ctx.appelerAlbertVisionABC('consigne','QUJD');
assert.equal(appels.length,2);assert.equal(appels[0].url,'https://albert.api.etalab.gouv.fr/v1/chat/completions');
assert.equal(appels[0].h.Authorization,'Bearer cle-test');
assert.equal(appels[1].b.messages[0].content[1].image_url.url,'data:image/jpeg;base64,QUJD');
assert.ok(!appels[1].b.response_format);
assert.equal(JSON.parse(ctx.nettoyerJsonABC(r.texte)).plateau_visible,true);
assert.equal(r.jetons.entree,1200);
console.log('albert ok');
