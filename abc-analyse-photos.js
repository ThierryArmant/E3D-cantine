/* Analyse photos : réutilise uniquement les données de scan déjà chargées. Aucun appel IA. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>{const x=String(s||'');const f=x.match(/^(\d{2})\/(\d{2})\/(\d{4})/);return f?f[3]+'-'+f[2]+'-'+f[1]:x.slice(0,10)};
const avis=s=>{const x=String(s||'').toLowerCase();if(x.includes('plus faim')||x.includes('🟡'))return 'plus faim';if(x.includes('tout fini')||x.includes('🟢'))return 'tout fini';if(x.includes('temps')||x.includes('🟠'))return 'pas le temps';if(x.includes('aimé')||x.includes('aime')||x.includes('🔴'))return 'pas aimé';return 'non renseigné'};
const emoji=x=>({'pas aimé':'🔴','plus faim':'🟡','pas le temps':'🟠','tout fini':'🟢'}[x]||'⚪');
const idDrive=url=>{const x=String(url||'');return (x.match(/\/file\/d\/([\w-]+)/)||x.match(/[?&]id=([\w-]+)/)||[])[1]||''};
// Restes du REPAS DE RÉFÉRENCE (entrée + plat + garniture + dessert + pain, roue crantée) : 100 × grammes restants / grammes du repas.
// Analyse récente : valeur enregistrée avec ses portions. Analyse ancienne : recalcul affiché comme tel (pas de modification des données).
const SAUCE=/^(sauce|mayonnaise|vinaigrette|ketchup|moutarde|huile|jus|assaisonnement|beurre|cornichons?|citron)\b/i;
const portionsActuelles=()=>{const p=((typeof globalRawData!=='undefined'&&globalRawData)||{}).parametres||{};return {entree:p.portion_entree_g||80,plat:p.portion_plat_g||100,accompagnement:p.portion_garniture_g||150,dessert:p.portion_dessert_g||100,fruit:p.portion_fruit_g||150,pain:p.portion_pain_g||50,pates:p.portion_pates_g||200}};
const reste=s=>{
 let d=null;try{d=typeof s.detail==='string'&&s.detail?JSON.parse(s.detail):s.detail}catch(e){}
 const P=portionsActuelles();
 let items=[];
 if(d&&Array.isArray(d.retenus)&&d.retenus.length)items=d.retenus.map(x=>({nom:x.aliment,comp:x.composant,pct:Number(x.reste_pct)||0}));
 else if(typeof parseScanItems==='function')items=parseScanItems(s.commentaire).map(x=>({nom:x.nom,comp:x.composant,pct:x.restePct}));
 if(!items.length)return null;
 items.forEach(x=>{if(/^pain\b/i.test(String(x.nom||'')))x.comp='pain'});
 // Deux desserts pris = deux portions de dessert dans le repas de référence.
 const portionItem=x=>/^pain\b/i.test(x.nom)?P.pain:((x.comp==='plat'||x.comp==='accompagnement')&&/(^|[^a-zà-ÿ])(p[âa]tes|spaghettis?|coquillettes?|pennes?|macaronis?|tagliatelles?|tortellinis?|raviolis?|fusillis?|farfalles?|nouilles|lasagnes?|gnocchis?|torsades?)([^a-zà-ÿ]|$)/i.test(x.nom||''))?P.pates:(x.comp==='dessert'&&/(^|[^a-zà-ÿ])(pomme|poire|banane|orange|cl[ée]mentine|mandarine|kiwi|raisin|fruit)/i.test(x.nom)&&!/compote|yaourt|muffin|g[âa]teau|tarte/i.test(x.nom)?P.fruit:(P[x.comp]||P.plat));
 // Deux desserts seulement pour un laitage + un autre dessert ; 2 yaourts, 2 fruits ou fruit + gâteau = 1.
 const famille=n=>/yaourt|yogourt|fromage|kiri|brie|camembert|emmental|tomme|comt[ée]|vache qui rit|petit[- ]suisse|ortolan/i.test(n)?'laitage':'autre';
 // Petit gâteau servi avec une compote ou un fruit : même dessert, ses restes comptent pour son vrai poids.
 const petit=n=>/muffin|madeleine|biscuit|cookie|g[âa]teau individuel|petit g[âa]teau|brownie|financier|gaufrette/i.test(n);
 const pg=(((typeof globalRawData!=='undefined'&&globalRawData)||{}).parametres||{}).portion_gateau_accompagnement_g||40;
 const avecAutre=items.some(x=>x.comp==='dessert'&&!petit(String(x.nom||''))&&famille(String(x.nom||''))==='autre');
 if(avecAutre)items.forEach(x=>{if(x.comp==='dessert'&&petit(String(x.nom||'')))x.accomp=true});
 const fam={};items.filter(x=>x.comp==='dessert'&&!x.accomp&&!SAUCE.test(String(x.nom||''))).forEach(x=>{const f=famille(String(x.nom||''));fam[f]=Math.max(fam[f]||0,portionItem(x))});
 const dessertG=Math.max(P.dessert,Object.values(fam).reduce((t,v)=>t+v,0));
 const maxComp=(c,base)=>items.filter(x=>x.comp===c&&!SAUCE.test(String(x.nom||''))).reduce((m,x)=>Math.max(m,portionItem(x)),base);
 const platG=maxComp('plat',P.plat),garnG=maxComp('accompagnement',P.accompagnement);
 const ref=P.entree+platG+garnG+dessertG+P.pain;
 const utiles=items.filter(x=>!SAUCE.test(String(x.nom||'')) && x.pct>5);
 const g=utiles.reduce((t,x)=>t+(x.accomp?pg:portionItem(x))*x.pct/100,0);
 // 4 zones + pain : % restant de chaque zone servie (grammes restants / portion de la zone).
 const refZone={entree:P.entree,plat:platG,accompagnement:garnG,dessert:dessertG,pain:P.pain};
 const zones={};Object.keys(refZone).forEach(z=>{
  const presents=items.filter(x=>x.comp===z&&!SAUCE.test(String(x.nom||'')));if(!presents.length)return;
  const gz=utiles.filter(x=>x.comp===z).reduce((t,x)=>t+(x.accomp?pg:portionItem(x))*x.pct/100,0);
  zones[z]=Math.min(100,Math.round(100*gz/refZone[z]));
 });
 if(d&&typeof d.restes_pct_repas==='number')return {pct:d.restes_pct_repas,g:d.restes_g,ref:d.repas_ref_g,methode:'enregistrée',zones};
 return {pct:Math.min(100,Math.round(100*g/ref)),g:Math.round(g),ref:ref,methode:'recalculée',zones};
};
const pctReste=s=>s.reste?s.reste.pct:null;
let current=[];
function refresh(){
 const data=(typeof globalRawData!=='undefined'&&globalRawData)||{};
 const raw=Array.isArray(data.rawGaspillage)?data.rawGaspillage:[];
 const records=raw.map((s,i)=>({...s,ordre:i+1,jour:date(s.dateRaw||s.date),avis:avis(s.avis_eleve),reste:reste(s),drive:idDrive(s.photo)})).sort((a,b)=>a.jour.localeCompare(b.jour)||String(a.dateRaw||a.date).localeCompare(String(b.dateRaw||b.date))||a.ordre-b.ordre);
 const compteJour={};records.forEach(s=>{compteJour[s.jour]=(compteJour[s.jour]||0)+1;s.ordre=compteJour[s.jour]});
 const day=$('abc-photo-date').value, a=$('abc-photo-avis').value, status=$('abc-photo-statut').value, r=$('abc-photo-restes').value, q=$('abc-photo-search').value.toLocaleLowerCase('fr').trim();
 current=records.filter(s=>(!day||s.jour===day)&&(!a||s.avis===a)&&(!status||s.type===status)&&(!q||[s.commentaire,s.detail,s.avis_eleve,s.photo].join(' ').toLocaleLowerCase('fr').includes(q))&&(!r||(pctReste(s)!==null&&(r==='0'?pctReste(s)===0:r==='1'?pctReste(s)>0&&pctReste(s)<30:r==='30'?pctReste(s)>=30&&pctReste(s)<60:pctReste(s)>=60))));
 const avecPhoto=current.filter(s=>s.drive);
 const stat=$('abc-photo-stats');stat.className='abc-photo-stats';
 stat.innerHTML=[['Scans',current.length],['Photos liées',avecPhoto.length],['Analysés',current.filter(s=>s.type==='SCAN_IA_VISION').length],['Plateaux ≥ 30 % du repas',current.filter(s=>pctReste(s)!==null&&pctReste(s)>=30).length]].map(([n,v])=>'<div class="abc-photo-stat">'+escape(n)+'<br><b>'+v+'</b></div>').join('');
 afficherZones(current);
 $('abc-photo-flow').className='abc-photo-flow';$('abc-photo-flow').innerHTML=['Photos Drive','ID scan + heure','Avis élève','Analyse existante','Filtres & détails'].map((x,i)=>'<span>'+escape(x)+'</span>'+(i<4?' → ':'')).join('');
 const counts=['pas aimé','plus faim','pas le temps','tout fini','non renseigné'].map(x=>[x,current.filter(s=>s.avis===x).length]);
 $('abc-photo-chart').className='abc-photo-chart';$('abc-photo-chart').innerHTML=counts.map(([x,n])=>'<div class="abc-photo-chart-item">'+emoji(x)+' '+escape(x)+' · <b>'+n+'</b><div class="abc-photo-track"><div class="abc-photo-fill" style="width:'+(current.length?100*n/current.length:0)+'%"></div></div></div>').join('');
 $('abc-photo-info').textContent=avecPhoto.length+' photo(s) disponibles pour la mosaïque. Les plateaux sans photo liée restent comptés dans les statistiques. Le pourcentage est la part du repas de référence laissée sur le plateau (grammes restants / entrée + plat + garniture + dessert + pain réglés dans la roue crantée). Sauces seules, traces et miettes sont négligées.';
 const grid=$('abc-photo-grid');grid.className='abc-photo-grid';grid.replaceChildren();
 if(!avecPhoto.length){const message=document.createElement('p');message.textContent='Aucune photo ne correspond aux filtres sélectionnés.';grid.append(message)}
 avecPhoto.slice(0,300).forEach(s=>{
 const button=document.createElement('button');button.type='button';button.className='abc-photo-tile';button.title='Afficher le détail du scan '+(s.id_scan||s.idScan||'');
 const img=document.createElement('img');img.loading='lazy';img.alt='Plateau photographié';img.src='https://drive.google.com/thumbnail?id='+encodeURIComponent(s.drive)+'&sz=w400';
 const pill=document.createElement('span');pill.className='abc-photo-pill';pill.textContent=emoji(s.avis)+' '+s.avis;
 const meta=document.createElement('div');meta.className='abc-photo-meta';meta.textContent=(s.dateRaw||s.date||'')+' · '+(s.id_scan||s.idScan||'');
 button.append(img,pill,meta);button.addEventListener('click',()=>detail(s));grid.append(button);
 });
 if(avecPhoto.length>300){const p=document.createElement('p');p.textContent='Affichage limité aux 300 premières photos : affinez les filtres.';grid.append(p)}
}
const ZONES=[['entree','🥗 Entrée'],['plat','🍖 Plat'],['accompagnement','🍚 Garniture'],['dessert','🍰 Dessert'],['pain','🥖 Pain']];
// Comparatif : moyenne des restes de chaque zone sur les plateaux analysés où la zone a été servie.
// Une zone repérée ce jour-là mais absente d’un plateau compte 0 % (mangée entièrement).
function zonesComparatif(liste){
 const analyses=liste.filter(s=>s.reste&&s.reste.zones);
 const parJour={};analyses.forEach(s=>{const j=parJour[s.jour]=parJour[s.jour]||new Set();Object.keys(s.reste.zones).forEach(z=>j.add(z))});
 return ZONES.map(([z,nom])=>{
  const v=analyses.filter(s=>parJour[s.jour].has(z)).map(s=>s.reste.zones[z]??0);
  return {z,nom,n:v.length,moy:v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length):null,lourds:v.filter(x=>x>=50).length};
 }).filter(x=>x.n);
}
function afficherZones(liste){
 let box=$('abc-photo-zones');
 if(!box){box=document.createElement('div');box.id='abc-photo-zones';box.style.cssText='margin:10px 0;padding:10px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;';const st=$('abc-photo-stats');if(!st)return;st.after(box)}
 const z=zonesComparatif(liste);
 if(!z.length){box.innerHTML='<b>Comparatif par zone</b><p style="margin:4px 0;font-size:13px;">Aucun plateau analysé pour ces filtres.</p>';return}
 const max=Math.max(...z.map(x=>x.moy));
 box.innerHTML='<b>Comparatif par zone</b> <span style="font-size:12px;color:#475569;">(part de chaque zone servie laissée sur le plateau, moyenne des plateaux analysés)</span>'+
  z.map(x=>'<div style="display:flex;align-items:center;gap:8px;margin:5px 0;font-size:14px;"><span style="width:110px;flex:none;">'+x.nom+'</span><div style="flex:1;height:14px;background:#e2e8f0;border-radius:7px;overflow:hidden;"><div style="height:100%;width:'+x.moy+'%;background:'+(x.moy===max&&max>0?'#dc2626':'#2d6a4f')+';"></div></div><b style="width:48px;text-align:right;">'+x.moy+' %</b><span style="font-size:12px;color:#475569;width:150px;flex:none;">'+x.n+' plateaux · '+x.lourds+' à ≥ 50 %</span></div>').join('')+
  (max>0?'<p style="margin:6px 0 0;font-size:13px;">Zone la plus laissée : <b>'+z.find(x=>x.moy===max).nom+'</b>.</p>':'');
}
function detail(s){
 const dialog=$('abc-photo-detail'),root=$('abc-photo-detail-content');
 const url='https://drive.google.com/file/d/'+encodeURIComponent(s.drive)+'/view';
 const safeComment=escape(s.commentaire||'Aucun commentaire enregistré');
 root.innerHTML='<h3>Plateau · '+escape(s.avis)+' '+emoji(s.avis)+'</h3><p>Ordre dans les données chargées : '+s.ordre+' · '+escape(s.dateRaw||s.date||'')+'</p><img alt="Photographie du plateau" src="https://drive.google.com/thumbnail?id='+encodeURIComponent(s.drive)+'&sz=w1200"><p><b>ID scan :</b> '+escape(s.id_scan||s.idScan||'non transmis')+'</p><p><b>Restes du repas de référence :</b> '+(s.reste===null?'non disponibles':s.reste.pct+' % ('+s.reste.g+' g sur '+s.reste.ref+' g'+(s.reste.methode==='recalculée'?', recalculé d’après une analyse ancienne avec les réglages actuels':'')+')'+(s.reste.zones&&Object.keys(s.reste.zones).length?'<br>'+ZONES.filter(([z])=>z in s.reste.zones).map(([z,n])=>n+' : '+s.reste.zones[z]+' %').join(' · '):''))+'</p><p><b>Commentaire :</b> '+safeComment+'</p><p><a href="'+url+'" target="_blank" rel="noopener noreferrer">Ouvrir l’original dans Drive</a></p>';
 if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
}
window.abcPhotosRefresh=refresh;
function initialiserFiltres(){
 ['abc-photo-date','abc-photo-avis','abc-photo-statut','abc-photo-restes','abc-photo-search'].forEach(id=>$(id)?.addEventListener(id==='abc-photo-search'?'input':'change',refresh));
 $('abc-photo-close')?.addEventListener('click',()=>$('abc-photo-detail').close());
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialiserFiltres,{once:true});else initialiserFiltres();
})();