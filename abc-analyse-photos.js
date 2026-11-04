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
const SAUCE=/^(sauce|mayonnaise|vinaigrette|ketchup|moutarde|huile|jus|assaisonnement)\b/i;
const portionsActuelles=()=>{const p=((typeof globalRawData!=='undefined'&&globalRawData)||{}).parametres||{};return {entree:p.portion_entree_g||80,plat:p.portion_plat_g||100,accompagnement:p.portion_garniture_g||150,dessert:p.portion_dessert_g||100,fruit:p.portion_fruit_g||150,pain:p.portion_pain_g||50}};
const reste=s=>{
 let d=null;try{d=typeof s.detail==='string'&&s.detail?JSON.parse(s.detail):s.detail}catch(e){}
 if(d&&typeof d.restes_pct_repas==='number')return {pct:d.restes_pct_repas,g:d.restes_g,ref:d.repas_ref_g,methode:'enregistrée'};
 const P=portionsActuelles();
 let items=[];
 if(d&&Array.isArray(d.retenus)&&d.retenus.length)items=d.retenus.map(x=>({nom:x.aliment,comp:x.composant,pct:Number(x.reste_pct)||0}));
 else if(typeof parseScanItems==='function')items=parseScanItems(s.commentaire).map(x=>({nom:x.nom,comp:x.composant,pct:x.restePct}));
 if(!items.length)return null;
 // Deux desserts pris = deux portions de dessert dans le repas de référence.
 const portionItem=x=>/^pain\b/i.test(x.nom)?P.pain:(x.comp==='dessert'&&/(^|[^a-zà-ÿ])(pomme|poire|banane|orange|cl[ée]mentine|mandarine|kiwi|raisin|fruit)/i.test(x.nom)&&!/compote|yaourt|muffin|g[âa]teau|tarte/i.test(x.nom)?P.fruit:(P[x.comp]||P.plat));
 // Deux desserts seulement pour un laitage + un autre dessert ; 2 yaourts, 2 fruits ou fruit + gâteau = 1.
 const famille=n=>/yaourt|yogourt|fromage|kiri|brie|camembert|emmental|tomme|comt[ée]|vache qui rit|petit[- ]suisse|ortolan/i.test(n)?'laitage':'autre';
 const fam={};items.filter(x=>x.comp==='dessert'&&!SAUCE.test(String(x.nom||''))).forEach(x=>{const f=famille(String(x.nom||''));fam[f]=Math.max(fam[f]||0,portionItem(x))});
 const dessertG=Math.max(P.dessert,Object.values(fam).reduce((t,v)=>t+v,0));
 const ref=P.entree+P.plat+P.accompagnement+dessertG+P.pain;
 const g=items.filter(x=>!SAUCE.test(String(x.nom||'')) && x.pct>5).reduce((t,x)=>t+portionItem(x)*x.pct/100,0);
 return {pct:Math.min(100,Math.round(100*g/ref)),g:Math.round(g),ref:ref,methode:'recalculée'};
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
function detail(s){
 const dialog=$('abc-photo-detail'),root=$('abc-photo-detail-content');
 const url='https://drive.google.com/file/d/'+encodeURIComponent(s.drive)+'/view';
 const safeComment=escape(s.commentaire||'Aucun commentaire enregistré');
 root.innerHTML='<h3>Plateau · '+escape(s.avis)+' '+emoji(s.avis)+'</h3><p>Ordre dans les données chargées : '+s.ordre+' · '+escape(s.dateRaw||s.date||'')+'</p><img alt="Photographie du plateau" src="https://drive.google.com/thumbnail?id='+encodeURIComponent(s.drive)+'&sz=w1200"><p><b>ID scan :</b> '+escape(s.id_scan||s.idScan||'non transmis')+'</p><p><b>Restes du repas de référence :</b> '+(s.reste===null?'non disponibles':s.reste.pct+' % ('+s.reste.g+' g sur '+s.reste.ref+' g'+(s.reste.methode==='recalculée'?', recalculé d’après une analyse ancienne avec les réglages actuels':'')+')')+'</p><p><b>Commentaire :</b> '+safeComment+'</p><p><a href="'+url+'" target="_blank" rel="noopener noreferrer">Ouvrir l’original dans Drive</a></p>';
 if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
}
window.abcPhotosRefresh=refresh;
function initialiserFiltres(){
 ['abc-photo-date','abc-photo-avis','abc-photo-statut','abc-photo-restes','abc-photo-search'].forEach(id=>$(id)?.addEventListener(id==='abc-photo-search'?'input':'change',refresh));
 $('abc-photo-close')?.addEventListener('click',()=>$('abc-photo-detail').close());
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialiserFiltres,{once:true});else initialiserFiltres();
})();