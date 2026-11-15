const assert=require('assert');
const fs=require('fs');const src=fs.readFileSync(__dirname+'/../apps_script/Code.gs','utf8');
const rows={Photos_Service:[['h'],['2026-11-05','plat','idA1234567','drv1',true,''],['2026-11-05','dessert','idB1234567','drv2',true,''],['2026-11-15','plat','idC1234567','drv3',true,'']],
Identifications_Photos:[['h'],['2026-11-05','idA1234567','[]',JSON.stringify({aliments:[{nom:'Bœuf bourguignon'},{nom:'Carottes'}]}),2,true,''],['2026-11-05','idB1234567','[{"nom":"Compote"}]','{}',1,false,'']]};
const sh=n=>rows[n]&&{getDataRange:()=>({getValues:()=>rows[n]}),appendRow:r=>rows[n].push(r)};
const ss={getSheetByName:sh,insertSheet:n=>{rows[n]=[['h']];return sh(n)}};
const ctx={__g:()=>({menus:{getParent:()=>ss}}),DriveApp:{getFileById:()=>({getThumbnail:()=>({getContentType:()=>'image/png',getBytes:()=>[1]})})},Utilities:{base64Encode:()=>'AA',formatDate:(o,z,f)=>f==='yyyy-MM-dd'?o.toISOString().slice(0,10):'261115120000'},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})}};
const f=new Function(...Object.keys(ctx),src+';getSheetsABC=__g;reponseMenuPhotosABC=()=>({ok:1});return {handleChercherPhotosMemoireABC,handleReprendrePhotoMemoireABC,photosJourABC,identificationsPhotosABC};')(...Object.values(ctx));
f.reponseMenuPhotosABC=()=>({});
const r=f.handleChercherPhotosMemoireABC({ecole:'x',q:'boeuf bourg',rubrique:'plat',date:'2026-11-15'});
assert.deepEqual(r.resultats.map(x=>x.date),['2026-11-05']);
assert.equal(f.handleChercherPhotosMemoireABC({ecole:'x',q:'bourguignon',rubrique:'dessert',date:'2026-11-15'}).resultats.length,0);
f.handleReprendrePhotoMemoireABC({ecole:'x',date:'2026-11-15',rubrique:'plat',source_date:'2026-11-05',source_id:'idA1234567'});
const n=rows.Photos_Service.length;assert.equal(rows.Photos_Service[n-1][3],'drv1');assert.equal(rows.Identifications_Photos.slice(-1)[0][5],true);
f.handleReprendrePhotoMemoireABC({ecole:'x',date:'2026-11-15',rubrique:'plat',source_date:'2026-11-05',source_id:'idA1234567'});
assert.equal(rows.Photos_Service.length,n,'pas de doublon');
console.log('memoire photos ok');
assert.deepEqual(f.handleChercherPhotosMemoireABC({ecole:'x',q:'',rubrique:'plat',date:'2026-11-16'}).resultats.map(x=>x.date),['2026-11-05'],'sans mot-clé : dernières photos');
