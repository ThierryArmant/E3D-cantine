'use strict';
// Photos avant service. Les images en attente restent dans IndexedDB, pas localStorage.
const ABC_PHOTOS={photos:[],pending:[],db:null,busy:false,request:0,reference:'',etape:'capture'};
const ABC_PHOTO_GROUPES={entree:'🥗 Entrées',plat:'🍗 Plats et accompagnements',dessert:'🍰 Desserts et laitages'};
function abcPhotoContexte(){return {ecole:abcEcole(),date:document.getElementById('input-menu-date')?.value||abcJour()};}
function abcPhotoStatut(t){['abc-photos-status','abc-photos-resultat'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=t;});}
function abcPhotoDb(mode,fn){return new Promise((resolve,reject)=>{if(!ABC_PHOTOS.db)return reject(Error('Sauvegarde locale indisponible. La photo ne sera pas acceptée.'));try{const tx=ABC_PHOTOS.db.transaction('photos',mode),r=fn(tx.objectStore('photos'));tx.oncomplete=()=>resolve(r.result);tx.onerror=tx.onabort=()=>reject(Error('Sauvegarde locale impossible. Espace disponible à vérifier.'));}catch(e){reject(e);}});}
async function abcPhotoAPI(action,data){
 const controle=new AbortController();const limite=setTimeout(()=>controle.abort(),90000);
 try{
  const r=await fetch(ADRESSE_SHEET_OFFICIELLE,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({...data,action}),signal:controle.signal});
  const d=await r.json();if(!d.success||d.photosVersion!==1)throw Error(d.error||'Installez et redéployez le dernier GS pour activer les photos.');return d;
 }catch(e){if(e.name==='AbortError')throw Error('Le serveur ne répond pas après 90 secondes. L’enregistrement peut encore aboutir : actualisez les photos du service pour vérifier avant de recommencer. Vos photos et corrections restent conservées.');throw e;}
 finally{clearTimeout(limite);}
}

function abcEtapePhotos(etape){
 ABC_PHOTOS.etape=etape;
 abcAfficherPhotos();
 if(etape==='revue')document.getElementById('abc-photos-grille')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function abcCarteCollecte(p,locale){
 const carte=abcEl('article',undefined,'abc-photo-collecte');
 carte.style.cssText='display:inline-flex;vertical-align:top;flex-direction:column;width:140px;padding:6px;margin:4px;border:1px solid #cbd5e1;border-radius:8px;background:white;';
 const img=abcEl('img'),id=locale?p.photo_id:p.id;
 img.alt='Photo · '+ABC_PHOTO_GROUPES[p.rubrique];img.style.cssText='width:100%;height:85px;object-fit:contain;';
 const src=locale?p.image:ABC_PHOTOS.previews.get(abcClePhoto(p));
 if(src)img.src=src;else img.hidden=true;
 if(!locale)img.dataset.photoApercu=id;
 const statut=abcEl('small',locale?'⏳ Envoi en attente':ABC_PHOTOS.identifications[id]?'✓ Proposition prête':'⏳ Analyse en attente');
 if(!locale)statut.dataset.photoAnalyse=id;
 statut.setAttribute('role','status');
 const retirer=abcEl('button','🗑 Supprimer','btn btn-outline');retirer.type='button';
 retirer.addEventListener('click',async()=>{
  retirer.disabled=true;
  try{
   // La file commune sérialise aussi les suppressions avec les analyses.
   if(locale){p.retirer=true;await abcPhotoDb('readwrite',store=>store.put(p));}
   else{const ctx=abcPhotoContexte(),op={...ctx,rubrique:p.rubrique,photo_id:id,retirer:true};await abcPhotoDb('readwrite',store=>store.put(op));ABC_PHOTOS.pending.push(op);}
   abcAfficherPhotos();await abcEnvoyerPhotos();
  }catch(e){abcPhotoStatut(e.message);retirer.disabled=false;}
 });
 carte.append(img,statut,retirer);return carte;
}
function abcActualiserEtapePhotos(){
 const ctx=abcPhotoContexte(),locaux=ABC_PHOTOS.pending.filter(p=>p.ecole===ctx.ecole&&p.date===ctx.date&&!p.retirer);
 const total=new Set([...ABC_PHOTOS.photos.map(p=>p.id),...locaux.map(p=>p.photo_id)]).size;
 const pretes=ABC_PHOTOS.photos.filter(p=>ABC_PHOTOS.identifications[p.id]).length;
 const revue=ABC_PHOTOS.etape==='revue',titre=document.getElementById('abc-photos-etape');
 if(titre)titre.textContent=revue?'2 · Vérifiez les propositions, puis validez le menu':'1 · Faites toutes vos photos · l’IA travaille en arrière-plan';
 const statut=document.getElementById('abc-photos-avancement');
 if(statut)statut.textContent=total?total+' photo(s) · '+pretes+' proposition(s) prête(s). '+(pretes<total?'Continuez vos photos ; les résultats arrivent progressivement.':'Vous pouvez vérifier les propositions de l’IA.'):'Photographiez les entrées, les plats et les desserts, dans l’ordre souhaité.';
 const bouton=document.getElementById('abc-photos-fin-capture');if(bouton){bouton.hidden=revue;bouton.disabled=!total;bouton.textContent=ABC_PHOTOS.photos.some(p=>p.rubrique==='dessert')||locaux.some(p=>p.rubrique==='dessert')?'Desserts photographiés ? Vérifier les propositions de l’IA':'J’ai terminé les photos · Vérifier l’IA';}
 const retour=document.getElementById('abc-photos-retour-capture');if(retour)retour.hidden=!revue;
 for(const id of ['abc-photos-validation-zone']){const e=document.getElementById(id);if(e)e.hidden=!revue;}
}

function abcAfficherPhotos(){
 abcActualiserEtapePhotos();
 const ctx=abcPhotoContexte(),locaux=ABC_PHOTOS.pending.filter(p=>p.ecole===ctx.ecole&&p.date===ctx.date);const compteur=document.getElementById('abc-photos-compteur');if(compteur)compteur.textContent=locaux.length+' photo(s) en attente sur cet appareil · '+ABC_PHOTOS.photos.length+' photo(s) reçue(s)';Object.keys(ABC_PHOTO_GROUPES).forEach(g=>{const zone=document.getElementById('abc-photos-'+g);if(!zone)return;const recus=ABC_PHOTOS.photos.filter(p=>p.rubrique===g);const ids=new Set(recus.map(p=>p.id));const attente=locaux.filter(p=>p.rubrique===g&&!p.retirer&&!ids.has(p.photo_id));const bilan=document.getElementById('abc-photos-bilan-'+g);if(bilan)bilan.textContent=recus.length+' enregistrée(s) · '+attente.length+' en attente';zone.replaceChildren();if(ABC_PHOTOS.etape!=='revue'){recus.filter(p=>!locaux.some(l=>l.photo_id===p.id&&l.retirer)).forEach(p=>zone.append(abcCarteCollecte(p,false)));attente.forEach(p=>zone.append(abcCarteCollecte(p,true)));return;}recus.filter(p=>!locaux.some(l=>l.photo_id===p.id&&l.retirer)).forEach((p,i)=>zone.append(abcDessinerPhotoMenu(p,i)));attente.forEach(p=>{const carte=abcEl('article',undefined,'abc-photo-carte'),img=abcEl('img');img.src=p.image;img.alt='Photo sauvegardée en attente';img.style.cssText='max-width:100%;max-height:150px;';carte.append(img,abcEl('p','⏳ Sauvegardée sur cet appareil · en attente d’envoi'));const titre=abcEl('label','Nommer cette assiette ou ce lot');const nom=abcEl('textarea');nom.value=p.notes||'';nom.placeholder='Écrivez ici les noms des aliments photographiés';nom.setAttribute('aria-label','Nommer la photo en attente');nom.style.cssText='display:block;width:100%;min-height:90px;padding:10px;font-size:16px;background:white;color:#111827;border:2px solid #2d6a4f;';nom.addEventListener('input',()=>{p.notes=nom.value;const key=p.ecole+'|'+p.date+'|'+p.photo_id;const d=ABC_PHOTOS.drafts.get(key);if(d){d.notes=p.notes;d.dirty=true;}});nom.addEventListener('change',async()=>{try{if(ABC_PHOTOS.pending.some(x=>x.photo_id===p.photo_id))await abcPhotoDb('readwrite',store=>store.put(p));}catch(e){abcPhotoStatut(e.message);}});titre.append(nom);carte.append(titre);const actions=abcEl('div');actions.className='abc-photo-actions';const renommer=abcEl('button','✏️ Renommer','btn btn-outline');renommer.type='button';renommer.addEventListener('click',()=>nom.focus());const supprimer=abcEl('button','🗑️ Supprimer','btn btn-outline');supprimer.type='button';supprimer.style.cssText='min-height:48px;background:#fff1f2;color:#b91c1c;border:2px solid #b91c1c;font-weight:700;';supprimer.addEventListener('click',async()=>{p.retirer=true;try{await abcPhotoDb('readwrite',store=>store.put(p));abcAfficherPhotos();await abcEnvoyerPhotos();}catch(e){abcPhotoStatut(e.message);}});const confirmer=abcEl('button','✓ Confirmer','btn');confirmer.type='button';confirmer.addEventListener('click',async()=>{if(!nom.value.trim()){nom.focus();abcPhotoStatut('Écrivez les noms des aliments de cette photo.');return;}p.notes=nom.value;p.confirmation=true;try{await abcPhotoDb('readwrite',store=>store.put(p));abcPhotoStatut('Confirmation conservée sur cet appareil ; enregistrement dès que l’envoi aboutit.');await abcEnvoyerPhotos();}catch(e){abcPhotoStatut(e.message);}});actions.append(renommer,supprimer,confirmer);const apercu=abcEl('div',undefined,'abc-photo-apercu-actions');carte.insertBefore(apercu,img);const fiche=abcEl('div',undefined,'abc-photo-fiche');fiche.append(titre,actions);apercu.append(img,fiche);zone.append(carte);});});const progression=document.getElementById('abc-photos-progression');if(progression){const total=ABC_PHOTOS.photos.length,confirmes=ABC_PHOTOS.photos.filter(p=>ABC_PHOTOS.identifications[p.id]?.confirmee&&!abcBrouillonPhoto(p).dirty).length;progression.textContent=total?confirmes+' / '+total+' photos confirmées. '+(locaux.length?'Terminez les envois en attente.':confirmes===total?'Dernière étape : cliquez sur « Valider le menu complet ».':'Vérifiez les aliments et confirmez chaque photo avant de valider le menu complet.'):'Ajoutez vos photos, vérifiez les aliments, puis confirmez chaque photo.';}const ref=document.getElementById('abc-photos-reference');if(ref)ref.textContent=ABC_PHOTOS.reference?'✓ Références confirmées actives pour ce service.':'Les noms corrigés et confirmés seront utilisés après validation du menu.';abcPreviewsPhotos();
}
async function abcChargerPhotos(){const ctx=abcPhotoContexte(),req=++ABC_PHOTOS.request;ABC_PHOTOS.photos=[];ABC_PHOTOS.identifications={};ABC_PHOTOS.reference='';ABC_PHOTOS.menu='';ABC_PHOTOS.etape='capture';abcAfficherPhotos();if(!ctx.ecole||ctx.ecole==='Chargement...')return;abcPhotoStatut('Chargement du menu en photos du '+ctx.date+'…');try{const r=await fetch(ADRESSE_SHEET_OFFICIELLE+'?action=getServicePhotos&ecole='+encodeURIComponent(ctx.ecole)+'&date='+ctx.date),d=await r.json();if(req!==ABC_PHOTOS.request||JSON.stringify(ctx)!==JSON.stringify(abcPhotoContexte()))return;if(!d.success||d.menuPhotosVersion!==2)throw Error(d.error||'Installez le nouveau GS pour voir les photos et corriger les aliments reconnus.');abcRecevoirMenuPhotos(d,ctx);const pain=document.getElementById('abc-photo-pain');if(pain&&pain.dataset.service!==ctx.ecole+'|'+ctx.date){pain.checked=/\bpain\b/i.test(ABC_PHOTOS.menu);pain.dataset.service=ctx.ecole+'|'+ctx.date;}abcPhotoStatut('Service du '+ctx.date+' · '+ctx.ecole);abcAfficherPhotos();}catch(e){if(req===ABC_PHOTOS.request)abcPhotoStatut(e.message);}}
async function abcCompresserPhoto(file){if(!file.type.startsWith('image/'))throw Error('Choisissez une image.');const image=await createImageBitmap(file);try{const rapport=Math.min(1,1280/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*rapport);canvas.height=Math.round(image.height*rapport);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',0.75);if(data.length>1500000)throw Error('Image trop volumineuse. Reprenez une photo moins détaillée.');return data;}finally{image.close();}}
async function abcAjouterPhotos(g,files){const ctx=abcPhotoContexte();if(!ctx.ecole||ctx.ecole==='Chargement...'||!ctx.date){abcPhotoStatut('Attendez le chargement de votre établissement.');return;}try{await ABC_PHOTOS.ready;for(const file of files){const nombre=new Set([...ABC_PHOTOS.photos.filter(p=>p.rubrique===g).map(p=>p.id),...ABC_PHOTOS.pending.filter(p=>p.ecole===ctx.ecole&&p.date===ctx.date&&p.rubrique===g&&!p.retirer).map(p=>p.photo_id)]).size;if(nombre>=6)throw Error('Six photos maximum par rubrique.');const photo={...ctx,rubrique:g,photo_id:crypto.randomUUID(),image:await abcCompresserPhoto(file)};await abcPhotoDb('readwrite',s=>s.put(photo));ABC_PHOTOS.pending.push(photo);abcAfficherPhotos();}abcPhotoStatut('Photos sauvegardées sur cet appareil. Envoi vers Drive…');}catch(e){abcPhotoStatut(e.message);}void abcEnvoyerPhotos();}
function abcNomsPhotoSaisis(notes,rubrique){return String(notes||'').split(/[,;\n]+/).map(n=>n.trim()).filter(Boolean).map(nom=>({nom,rubrique,nature:'base',description:'',maison:false,choisi:true}));}
async function abcSynchroniserPhotosQuota(ctx){
 const r=await fetch(ADRESSE_SHEET_OFFICIELLE+'?action=getServicePhotos&ecole='+encodeURIComponent(ctx.ecole)+'&date='+ctx.date);
 const d=await r.json();
 if(!d.success||d.menuPhotosVersion!==2)throw Error(d.error||'Impossible de relire les photos enregistrées.');
 if(JSON.stringify(ctx)!==JSON.stringify(abcPhotoContexte()))return;
 abcRecevoirMenuPhotos(d,ctx);abcAfficherPhotos();
}
async function abcEnvoyerPhotos(){
 if(ABC_PHOTOS.busy||ABC_PHOTOS.analyse)return;
 ABC_PHOTOS.busy=true;
 try{
  const traites=new Set();let photo;while((photo=[...ABC_PHOTOS.pending].sort((a,b)=>Number(!!b.retirer)-Number(!!a.retirer)).find(p=>!traites.has(p.photo_id)))){traites.add(photo.photo_id);
   try{
    let d;
    if(photo.retirer){
     try{d=await abcAPIPhotoMenu('removeServicePhoto',{ecole:photo.ecole,date:photo.date,photo_id:photo.photo_id});}catch(e){if(!String(e.message).includes('Photo absente de ce service'))throw e;d={photos:ABC_PHOTOS.photos};}
    }else{
     d=await abcPhotoAPI('saveServicePhoto',photo);
     if(photo.retirer)d=await abcAPIPhotoMenu('removeServicePhoto',{ecole:photo.ecole,date:photo.date,photo_id:photo.photo_id});
     else if(photo.confirmation)d=await abcAPIPhotoMenu('savePhotoIdentification',{ecole:photo.ecole,date:photo.date,photo_id:photo.photo_id,revision:0,aliments:abcNomsPhotoSaisis(photo.notes,photo.rubrique),notes:photo.notes||''});
    }
    await abcPhotoDb('readwrite',store=>store.delete(photo.photo_id));
    ABC_PHOTOS.pending=ABC_PHOTOS.pending.filter(p=>p.photo_id!==photo.photo_id);
    const ctx=abcPhotoContexte();
    if(photo.ecole===ctx.ecole&&photo.date===ctx.date){
     ABC_PHOTOS.photos=d.photos;
     if(d.identifications)ABC_PHOTOS.identifications=d.identifications;
     ABC_PHOTOS.reference='';
     if(!photo.retirer){
      ABC_PHOTOS.previews.set(ctx.ecole+'|'+ctx.date+'|'+photo.photo_id,photo.image);
      const p=ABC_PHOTOS.photos.find(x=>x.id===photo.photo_id);
      if(p&&photo.notes&&!photo.confirmation){const brouillon=abcBrouillonPhoto(p);brouillon.notes=photo.notes;brouillon.dirty=true;}
      if(photo.confirmation)ABC_PHOTOS.drafts.delete(ctx.ecole+'|'+ctx.date+'|'+photo.photo_id);
     }
     abcPhotoStatut(photo.retirer?'✓ Photo supprimée du service.':photo.confirmation?'✓ Photo et noms confirmés.':'✓ Photo enregistrée dans Drive.');
     abcAfficherPhotos();
    }
   }catch(e){if(/Six photos maximum/.test(e.message)){try{await abcSynchroniserPhotosQuota({ecole:photo.ecole,date:photo.date});}catch(syncError){abcPhotoStatut('Photos conservées. Rechargement impossible : '+syncError.message);continue;}abcPhotoStatut('Le serveur refuse cet envoi. Les photos enregistrées viennent d’être rechargées : vérifiez le compteur de chaque rubrique et supprimez les essais devenus inutiles. Votre nouvelle photo reste en attente.');continue;}abcPhotoStatut('Photos et corrections conservées sur cet appareil. Envoi à réessayer : '+e.message);break;}
  }
 }finally{ABC_PHOTOS.busy=false;}
 if(ABC_PHOTOS.photos.some(p=>!ABC_PHOTOS.identifications[p.id])&&!ABC_PHOTOS.analyse)await abcReconnaitreMenuPhotos();
}
async function abcValiderPhotos(){return abcValiderMenuPhotos();}

function abcAidePhoto(titre,texte){
 const bouton=abcEl('button','ⓘ','abc-photo-aide');bouton.type='button';bouton.setAttribute('aria-label','Aide : '+titre);bouton.setAttribute('aria-expanded','false');
 bouton.addEventListener('click',()=>{
  const ancienne=document.getElementById('abc-photo-aide-flottante');if(ancienne)ancienne.abcFermer(false);
  const panneau=abcEl('section');panneau.id='abc-photo-aide-flottante';panneau.setAttribute('role','dialog');panneau.setAttribute('aria-label',titre);
  const fermer=abcEl('button','✕ Fermer');fermer.type='button';
  panneau.append(abcEl('strong',titre));
  if(Array.isArray(texte)){texte.forEach(etape=>{const section=abcEl('div');section.style.cssText='margin:14px 0;padding-bottom:10px;border-bottom:1px solid #e2e8f0;';section.append(abcEl('strong',etape.titre));etape.lignes.forEach(ligne=>{const p=abcEl('p',ligne);p.style.cssText='margin:5px 0;line-height:1.45;';section.append(p);});panneau.append(section);});}else panneau.append(abcEl('p',texte));
  panneau.append(fermer);document.body.append(panneau);
  const rect=bouton.getBoundingClientRect(),largeur=Math.min(350,window.innerWidth-24);panneau.style.width=largeur+'px';panneau.style.left=Math.max(12,Math.min(rect.left,window.innerWidth-largeur-12))+'px';panneau.style.top=Math.max(12,Math.min(rect.bottom+6,window.innerHeight-panneau.offsetHeight-12))+'px';
  bouton.setAttribute('aria-expanded','true');bouton.setAttribute('aria-controls',panneau.id);
  const echap=e=>{if(e.key==='Escape'){e.stopPropagation();panneau.abcFermer(true);}};
  const dehors=e=>{if(!panneau.contains(e.target)&&e.target!==bouton)panneau.abcFermer(false);};
  panneau.abcFermer=focus=>{document.removeEventListener('keydown',echap);document.removeEventListener('pointerdown',dehors);panneau.remove();bouton.setAttribute('aria-expanded','false');bouton.removeAttribute('aria-controls');if(focus)bouton.focus();};
  fermer.addEventListener('click',()=>panneau.abcFermer(true));document.addEventListener('keydown',echap);document.addEventListener('pointerdown',dehors);fermer.focus();
 });return bouton;
}

function abcInstallerPhotos(){const table=document.querySelector('.menu-table');if(!table)return;const bloc=abcEl('section');bloc.id='abc-photos-service';bloc.style.cssText='padding:14px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;margin:14px 0;';bloc.append(abcEl('h3','📸 Menu en photos'));
 const actualiser=abcEl('button','↻ Actualiser les photos du service','btn btn-outline');actualiser.type='button';actualiser.addEventListener('click',async()=>{try{await abcSynchroniserPhotosQuota(abcPhotoContexte());abcPhotoStatut('Photos enregistrées rechargées. Les photos en attente sont conservées.');}catch(e){abcPhotoStatut(e.message);}});const outils=abcEl('details');outils.append(abcEl('summary','Aide en cas de blocage · actualiser ou réessayer'),actualiser);const statut=abcEl('p');statut.id='abc-photos-status';statut.setAttribute('role','status');bloc.append(statut);const compteur=abcEl('p','Vérification des photos conservées…');compteur.id='abc-photos-compteur';compteur.style.cssText='padding:12px;background:#fff7ed;color:#7c2d12;border-radius:8px;font-weight:700;';bloc.append(compteur);const titreEtape=abcEl('h4');titreEtape.id='abc-photos-etape';const avancement=abcEl('p');avancement.id='abc-photos-avancement';avancement.setAttribute('role','status');const finCapture=abcEl('button','J’ai terminé les photos · Vérifier l’IA','btn');finCapture.id='abc-photos-fin-capture';finCapture.type='button';finCapture.addEventListener('click',()=>abcEtapePhotos('revue'));const retourCapture=abcEl('button','📷 Continuer mes photos','btn btn-outline');retourCapture.id='abc-photos-retour-capture';retourCapture.type='button';retourCapture.hidden=true;retourCapture.addEventListener('click',()=>abcEtapePhotos('capture'));bloc.append(titreEtape,avancement,finCapture,retourCapture);const grille=abcEl('div');grille.id='abc-photos-grille';grille.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;';const aide=abcAidePhoto('Comment procéder ?',[{"titre":"1 · Ajouter une photo","lignes":["Dans Entrées, Plats ou Desserts, cliquez sur « Ajouter une photo ».","Choisissez « Prendre une photo », puis « Capturer ». Ou importez une photo déjà prise."]},{"titre":"2 · Continuer le circuit","lignes":["La caméra se ferme après la capture. Ajoutez la photo suivante dans la rubrique souhaitée.","N’attendez pas l’IA : elle analyse en arrière-plan. Vous pouvez prendre plusieurs photos par rubrique."]},{"titre":"3 · Vérifier les propositions","lignes":["Toutes les photos sont prises ? Cliquez sur le bouton « Vérifier l’IA » ou « Vérifier les propositions de l’IA ».","Pour chaque photo, lisez « L’IA reconnaît ». Les résultats encore en cours arrivent progressivement."]},{"titre":"4 · Valider ou corriger","lignes":["Les aliments sont corrects ? Cliquez sur « Valider ».","Sinon, cliquez sur « Modifier ». Corrigez les noms, ajoutez un aliment ou décochez une erreur. Puis validez les corrections."]},{"titre":"5 · Finaliser le menu","lignes":["Après avoir vérifié toutes les photos, cochez « Pain servi » si nécessaire.","Cliquez sur « Valider le menu complet ». Attendez le message de confirmation."]},{"titre":"En cas de coupure","lignes":["Les photos en attente restent sur cet appareil. Ne les importez pas une deuxième fois.","Ouvrez « Aide en cas de blocage », puis cliquez sur « Réessayer l’envoi »."]}]);aide.textContent='? Comment procéder ?';aide.classList.remove('abc-photo-aide');aide.classList.add('btn','btn-outline');bloc.append(aide,grille);
 Object.entries(ABC_PHOTO_GROUPES).forEach(([g,nom])=>{const carte=abcEl('div');carte.append(abcEl('h4',nom));const bilan=abcEl('p');bilan.id='abc-photos-bilan-'+g;bilan.setAttribute('role','status');carte.append(bilan);const zone=abcEl('div');zone.id='abc-photos-'+g;carte.append(zone);const input=abcEl('input');input.type='file';input.accept='image/*';input.multiple=false;input.hidden=true;input.addEventListener('change',()=>{const files=Array.from(input.files||[]);input.value='';abcAjouterPhotos(g,files);});const camera=abcEl('button','📷 Prendre une photo','btn');camera.type='button';camera.style.width='auto';camera.addEventListener('click',()=>abcOuvrirCameraService(g));const bouton=abcEl('button','📁 Choisir une photo déjà prise','btn btn-outline');bouton.type='button';bouton.style.width='auto';bouton.addEventListener('click',()=>input.click());const choix=abcEl('div');choix.hidden=true;choix.append(camera,bouton);const ajouter=abcEl('button','＋ Ajouter une photo','btn');ajouter.type='button';ajouter.setAttribute('aria-expanded','false');ajouter.addEventListener('click',()=>{choix.hidden=!choix.hidden;ajouter.setAttribute('aria-expanded',String(!choix.hidden));});camera.addEventListener('click',()=>{choix.hidden=true;ajouter.setAttribute('aria-expanded','false');});bouton.addEventListener('click',()=>{choix.hidden=true;ajouter.setAttribute('aria-expanded','false');});carte.append(input,ajouter,choix);grille.append(carte);});
 const reconnaitre=abcEl('button','1 · Reconnaître les aliments','btn');reconnaitre.id='abc-photos-reconnaitre';reconnaitre.type='button';reconnaitre.addEventListener('click',abcReconnaitreMenuPhotos);outils.append(reconnaitre);const validationZone=abcEl('div');validationZone.id='abc-photos-validation-zone';validationZone.hidden=true;bloc.append(validationZone);const painLabel=abcEl('label','Pain servi ');painLabel.className='abc-photo-case';const pain=abcEl('input');pain.type='checkbox';pain.id='abc-photo-pain';painLabel.prepend(pain);const essaiLabel=abcEl('label','Ceci est un essai · ne pas remplacer le menu réel');essaiLabel.className='abc-photo-case';const essai=abcEl('input');essai.type='checkbox';essai.id='abc-photo-essai';essaiLabel.prepend(essai);validationZone.append(painLabel);if(new URLSearchParams(window.location.search).get('abc-test')==='1')validationZone.append(essaiLabel);const apercu=abcEl('p');apercu.id='abc-photo-menu-final';validationZone.append(apercu);const progression=abcEl('p');progression.id='abc-photos-progression';progression.setAttribute('role','status');progression.style.cssText='margin:6px 0;font-weight:700;';validationZone.append(progression);const validation=abcEl('button','Valider le menu complet','btn');validation.id='abc-photos-valider';validation.type='button';validation.style.width='auto';validation.addEventListener('click',abcValiderPhotos);const retry=abcEl('button','↻ Réessayer l’envoi','btn btn-outline');retry.type='button';retry.style.width='auto';retry.addEventListener('click',async()=>{if(ABC_PHOTOS.busy){abcPhotoStatut('Un envoi est en cours. Vos photos restent en attente jusqu’à confirmation.');return;}await ABC_PHOTOS.ready;const sauvegardes=await abcPhotoDb('readonly',s=>s.getAll());ABC_PHOTOS.pending=sauvegardes;abcAfficherPhotos();if(!sauvegardes.length){await abcChargerPhotos();abcPhotoStatut(ABC_PHOTOS.photos.length?'Les photos sont déjà reçues dans Drive. Vous pouvez les valider.':'Aucune photo trouvée dans la file locale ni reçue pour ce service. Prenez une nouvelle photo d’essai et vérifiez sa miniature.');return;}abcPhotoStatut('Reprise de '+sauvegardes.length+' photo(s) sauvegardée(s) sur cet appareil…');await abcEnvoyerPhotos();});const reference=abcEl('p');reference.id='abc-photos-reference';const resultat=abcEl('p');resultat.id='abc-photos-resultat';resultat.setAttribute('role','status');resultat.setAttribute('aria-live','polite');resultat.style.cssText='padding:12px;background:#eaf4ee;border-radius:8px;font-weight:650;line-height:1.5;';validationZone.append(validation,abcAidePhoto('Valider le menu du jour','Confirmer une photo enregistre ses identifications. Valider le menu réunit ensuite les aliments de toutes les photos confirmées et enregistre le menu pour l’établissement et la date sélectionnés. Vérifiez aussi la case Pain servi.'),retry,abcAidePhoto('Photo en attente d’envoi','En attente signifie que la photo est conservée sur cet appareil et que son envoi reste à terminer. Réessayer l’envoi reprend les photos conservées : ne les importez pas de nouveau. Attendez le retour du serveur ou l’erreur indiquée.'),resultat,reference);outils.append(retry);bloc.append(outils);const manuel=abcEl('details');manuel.id='abc-menu-manuel';manuel.append(abcEl('summary','☑ Saisir ou compléter sans photos · catalogue et cases à cocher'));table.before(bloc,manuel);manuel.append(table);const boutonManuel=document.querySelector('#view-cuisinier button[onclick=\"saveMenu()\"]');if(boutonManuel){boutonManuel.textContent='Enregistrer le menu saisi avec les cases';manuel.append(boutonManuel);}
 document.getElementById('input-menu-date').addEventListener('change',abcChargerPhotos);document.getElementById('select-etablissement').addEventListener('change',abcChargerPhotos);document.getElementById('menu-view-cuisinier').addEventListener('click',abcChargerPhotos);window.addEventListener('online',abcEnvoyerPhotos);
 ABC_PHOTOS.ready=new Promise((res,rej)=>{try{const r=indexedDB.open('abc-photos-service',1);r.onupgradeneeded=()=>r.result.createObjectStore('photos',{keyPath:'photo_id'});r.onsuccess=()=>{ABC_PHOTOS.db=r.result;res();};r.onerror=()=>rej(Error('Sauvegarde locale des photos indisponible.'));}catch(e){rej(e);}});
 ABC_PHOTOS.ready.then(async()=>{ABC_PHOTOS.pending=await abcPhotoDb('readonly',s=>s.getAll());abcAfficherPhotos();await abcEnvoyerPhotos();}).catch(e=>abcPhotoStatut(e.message));abcChargerPhotos();
}
document.addEventListener('DOMContentLoaded',()=>{abcInstallerPhotos();abcInstallerQrPhotos();});

async function abcOuvrirCameraService(g){
 if(!navigator.mediaDevices?.getUserMedia){abcPhotoStatut('Caméra indisponible dans ce navigateur. Utilisez Importer des photos.');return;}
 const contexte=abcPhotoContexte();if(!contexte.ecole||contexte.ecole==='Chargement...'){abcPhotoStatut('Choisissez votre établissement avant de photographier.');return;}
 const fond=abcEl('div');fond.style.cssText='position:fixed;inset:0;z-index:100010;background:rgba(15,23,42,.96);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;color:white;gap:10px;';fond.setAttribute('role','dialog');fond.setAttribute('aria-modal','true');fond.setAttribute('aria-label','Photographier le service');
 const titre=abcEl('strong',contexte.ecole+' · '+contexte.date+' · '+ABC_PHOTO_GROUPES[g]);const video=abcEl('video');video.autoplay=true;video.muted=true;video.setAttribute('playsinline','');video.style.cssText='width:100%;max-width:850px;max-height:65vh;object-fit:contain;';
 const message=abcEl('p','Autorisez la caméra pour photographier les aliments.');message.setAttribute('role','status');
 const controles=abcEl('div'),capture=abcEl('button','📷 Capturer','btn'),fermer=abcEl('button','Annuler','btn btn-outline');capture.type=fermer.type='button';capture.disabled=true;capture.style.width=fermer.style.width='auto';fermer.style.color='white';controles.append(capture,fermer);fond.append(titre,video,message,controles);document.body.append(fond);
 let stream=null,ferme=false;const close=()=>{ferme=true;if(stream)stream.getTracks().forEach(t=>t.stop());fond.remove();document.removeEventListener('keydown',escape);};const escape=e=>{if(e.key==='Escape')close();};document.addEventListener('keydown',escape);fermer.addEventListener('click',close);
 try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:960}},audio:false});if(ferme){stream.getTracks().forEach(t=>t.stop());return;}video.srcObject=stream;await video.play();capture.disabled=false;message.textContent='Cadrez les aliments puis capturez : la photo sera envoyée et analysée automatiquement.';}
 catch(e){message.textContent='Caméra inaccessible : '+e.message+'. Fermez cette fenêtre puis utilisez Importer des photos.';}
 capture.addEventListener('click',async()=>{if(!video.videoWidth)return;if(JSON.stringify(contexte)!==JSON.stringify(abcPhotoContexte())){close();return;}capture.disabled=true;try{const canvas=document.createElement('canvas'),ratio=Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));canvas.width=Math.round(video.videoWidth*ratio);canvas.height=Math.round(video.videoHeight*ratio);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);const blob=await new Promise(res=>canvas.toBlob(res,'image/jpeg',.75));if(!blob)throw Error('Image non capturée.');close();abcPhotoStatut('Photo capturée · envoi puis reconnaissance automatique…');await abcAjouterPhotos(g,[new File([blob],'service.jpg',{type:'image/jpeg'})]);}catch(e){message.textContent=e.message;}finally{capture.disabled=false;}});
}
function abcUrlPhotosService(ecole,date){const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('photos','service');u.searchParams.set('ecole',ecole);u.searchParams.set('date',date);return u.href;}
function abcActualiserQrPhotos(){const cible=document.getElementById('abc-photos-qr');if(!cible)return;const ctx=abcPhotoContexte();cible.replaceChildren();if(!ctx.ecole||ctx.ecole==='Chargement...')return;const url=abcUrlPhotosService(ctx.ecole,ctx.date);cible.append(abcEl('p',ctx.ecole+' · '+ctx.date));if(typeof qrcode==='function'){const qr=qrcode(0,'M');qr.addData(url);qr.make();const n=qr.getModuleCount(),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 '+(n+8)+' '+(n+8));svg.setAttribute('width','190');svg.setAttribute('height','190');svg.setAttribute('role','img');svg.setAttribute('aria-label','QR code pour photographier ce service');svg.style.cssText='display:block;background:white;margin:10px 0;';const bg=document.createElementNS(svg.namespaceURI,'rect');bg.setAttribute('width',n+8);bg.setAttribute('height',n+8);bg.setAttribute('fill','white');svg.append(bg);let path='';for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.isDark(r,c))path+='M'+(c+4)+','+(r+4)+'h1v1h-1z';const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',path);p.setAttribute('fill','black');svg.append(p);cible.append(svg);}}
function abcInstallerQrPhotos(){const bloc=document.getElementById('abc-photos-service');if(!bloc)return;const details=abcEl('details');details.append(abcEl('summary','📱 Continuer sur un téléphone · afficher le QR code'));const cible=abcEl('div');cible.id='abc-photos-qr';details.append(cible);bloc.prepend(details);const select=document.getElementById('select-etablissement'),date=document.getElementById('input-menu-date');const params=new URLSearchParams(location.search);let entree=params.get('photos')==='service';if(entree){const jour=params.get('date');if(/^\d{4}-\d{2}-\d{2}$/.test(jour||''))date.value=jour;abcActiverParcoursPhoto();}
 function actualiser(){if(entree){const ecole=params.get('ecole'),jour=params.get('date');if(Array.from(select.options).some(o=>o.value===ecole)){entree=false;select.value=ecole;select.dispatchEvent(new Event('change',{bubbles:true}));if(/^\d{4}-\d{2}-\d{2}$/.test(jour||'')){date.value=jour;date.dispatchEvent(new Event('change',{bubbles:true}));}abcActiverParcoursPhoto();abcChargerPhotos();}else if(select.options.length>1){abcPhotoStatut('L’établissement de ce lien n’est pas disponible. Choisissez votre établissement.');}}abcActualiserQrPhotos();}
 select.addEventListener('change',actualiser);date.addEventListener('change',actualiser);new MutationObserver(actualiser).observe(select,{childList:true});actualiser();
}

function abcActiverParcoursPhoto(){
 const bloc=document.getElementById('abc-photos-service');if(!bloc)return;
 let vue=document.getElementById('view-photos-service');
 if(!vue){vue=abcEl('div',undefined,'view-section');vue.id='view-photos-service';const header=abcEl('header',undefined,'abc-photo-header');const titre=abcEl('div');titre.append(abcEl('h1','📸 Photos du service'));const ctx=abcPhotoContexte();const contexte=abcEl('p',ctx.ecole+' · '+ctx.date);contexte.id='abc-photo-contexte';titre.append(contexte);const quitter=abcEl('button','Ouvrir l’application');quitter.type='button';quitter.addEventListener('click',()=>{document.body.classList.remove('abc-mode-photos');document.getElementById('abc-photos-emplacement').after(bloc);switchView('view-cuisinier');});header.append(titre,quitter);vue.append(header);document.querySelector('.content-area').append(vue);const emplacement=abcEl('div');emplacement.id='abc-photos-emplacement';bloc.before(emplacement);}
 const contexte=document.getElementById('abc-photo-contexte'),ctx=abcPhotoContexte();contexte.textContent=(ctx.ecole&&ctx.ecole!=='Chargement...'?ctx.ecole:'Chargement de l’établissement…')+' · '+ctx.date;vue.append(bloc);document.body.classList.add('abc-mode-photos');switchView('view-photos-service');window.scrollTo(0,0);
}
function abcInstallerNavigationMobile(){const barre=document.querySelector('.top-bar');if(!barre)return;const bouton=abcEl('button','☰ Menu', 'abc-navigation-mobile');bouton.type='button';bouton.setAttribute('aria-expanded','false');bouton.addEventListener('click',()=>{const ouvert=document.body.classList.toggle('abc-navigation-ouverte');bouton.setAttribute('aria-expanded',String(ouvert));});barre.prepend(bouton);const fermer=abcEl('button','✕ Fermer le menu','abc-navigation-mobile');fermer.type='button';fermer.style.margin='10px';const close=()=>{document.body.classList.remove('abc-navigation-ouverte');bouton.setAttribute('aria-expanded','false');};fermer.addEventListener('click',close);document.querySelector('.sidebar').prepend(fermer);document.querySelectorAll('.sidebar .menu-item').forEach(e=>e.addEventListener('click',()=>{close();window.scrollTo(0,0);}));}
document.addEventListener('DOMContentLoaded',abcInstallerNavigationMobile);

// Édition des identifications sous chaque photo, sans modifier le menu avant validation.
ABC_PHOTOS.identifications={};ABC_PHOTOS.drafts=new Map();ABC_PHOTOS.previews=new Map();ABC_PHOTOS.previewRequests=new Set();ABC_PHOTOS.menu='';ABC_PHOTOS.analyse=false;ABC_PHOTOS.messages=new Map();
function abcClePhoto(p){const c=abcPhotoContexte();return c.ecole+'|'+c.date+'|'+p.id;}
function abcBrouillonPhoto(p){const key=abcClePhoto(p),a=ABC_PHOTOS.identifications[p.id],ancien=ABC_PHOTOS.drafts.get(key);if(ancien&&(ancien.dirty||ancien.revision===(a?.revision||0)))return ancien;const source=a?.correction?.aliments||a?.brut||[];const d={revision:a?.revision||0,aliments:source.map(x=>({...x,choisi:true})),notes:a?.correction?.notes||'',dirty:false};ABC_PHOTOS.drafts.set(key,d);return d;}
function abcRecevoirMenuPhotos(d,ctx){if(JSON.stringify(ctx)!==JSON.stringify(abcPhotoContexte()))return false;ABC_PHOTOS.photos=d.photos||[];const identifications=d.identifications||{};for(const p of ABC_PHOTOS.photos){const ancien=ABC_PHOTOS.identifications[p.id];if(ancien&&(ancien.revision||0)>(identifications[p.id]?.revision||0))identifications[p.id]=ancien;}ABC_PHOTOS.identifications=identifications;ABC_PHOTOS.reference=d.reference||'';ABC_PHOTOS.menu=d.menu||'';return true;}
async function abcAPIPhotoMenu(action,data){const d=await abcPhotoAPI(action,data);if(d.menuPhotosVersion!==2)throw Error('Installez le dernier GS pour activer les propositions et corrections sous les photos.');return d;}
async function abcPreviewsPhotos(){const ctx=abcPhotoContexte(),photos=ABC_PHOTOS.photos.filter(p=>!ABC_PHOTOS.previews.has(abcClePhoto(p))&&!ABC_PHOTOS.previewRequests.has(abcClePhoto(p)));for(let i=0;i<photos.length;i+=3){const lot=photos.slice(i,i+3);lot.forEach(p=>ABC_PHOTOS.previewRequests.add(abcClePhoto(p)));try{const d=await abcAPIPhotoMenu('getServicePhotoPreviews',{...ctx,ids:lot.map(p=>p.id)});if(JSON.stringify(ctx)!==JSON.stringify(abcPhotoContexte()))return;lot.forEach(p=>{if(d.images?.[p.id]){ABC_PHOTOS.previews.set(abcClePhoto(p),d.images[p.id]);const img=document.querySelector('[data-photo-apercu="'+p.id+'"]');if(img){img.src=d.images[p.id];img.hidden=false;}const note=document.querySelector('[data-photo-attente="'+p.id+'"]');if(note)note.hidden=true;}});}catch(e){if(JSON.stringify(ctx)===JSON.stringify(abcPhotoContexte()))lot.forEach(p=>{const note=document.querySelector('[data-photo-attente="'+p.id+'"]');if(note)note.textContent='Aperçu indisponible. '+e.message;});}finally{lot.forEach(p=>ABC_PHOTOS.previewRequests.delete(ctx.ecole+'|'+ctx.date+'|'+p.id));}}}
function abcDessinerPhotoMenu(p,index){
 const carte=abcEl('article',undefined,'abc-photo-carte'),a=ABC_PHOTOS.identifications[p.id],d=abcBrouillonPhoto(p);carte.append(abcEl('h5','Photo '+(index+1)));
 const img=abcEl('img');img.alt='Photo '+(index+1)+' · '+ABC_PHOTO_GROUPES[p.rubrique];img.dataset.photoApercu=p.id;img.hidden=true;const src=ABC_PHOTOS.previews.get(abcClePhoto(p));if(src){img.src=src;img.hidden=false;}carte.append(img);const note=abcEl('p','Chargement de la photo…');note.dataset.photoAttente=p.id;note.hidden=!!src;carte.append(note);
 const proposition=abcEl('p',a?'L’IA reconnaît : '+(a.brut.map(x=>x.nom).join(', ')||'aucun aliment identifié'):'Reconnaissance automatique en cours. Le résultat apparaîtra ici.','abc-photo-proposition');carte.append(proposition);

 const retour=abcEl('p',ABC_PHOTOS.messages.get(abcClePhoto(p))||(a?.confirmee?'✅ Photo confirmée':a?'✅ Analyse terminée · vérifiez les aliments proposés':'En attente de reconnaissance'));retour.dataset.photoAnalyse=p.id;retour.setAttribute('role','status');retour.setAttribute('aria-live','polite');retour.style.cssText='padding:10px;background:#eff6ff;border-radius:6px;font-weight:700;';retour.hidden=!!a;carte.insertBefore(retour,note.nextSibling);
 const edition=abcEl('div');edition.hidden=!d.dirty;const guide=abcEl('p');guide.style.cssText='margin:4px 0;font-size:14px;font-weight:600;';guide.setAttribute('role','status');carte.append(guide);const titreAliments=abcEl('strong','2 · Vérifiez les aliments ci-dessous : corrigez un nom ou décochez une erreur.');titreAliments.style.cssText='display:block;font-size:14px;margin:4px 0;';carte.append(titreAliments);const liste=abcEl('div');carte.append(liste);function rafraichirGuidage(){const ok=a?.confirmee&&!d.dirty;guide.textContent=ok?'✓ Validée · passez à la photo suivante.':a?'Ces aliments sont-ils corrects ? Validez ou modifiez.':'Attendez la proposition de l’IA, ou choisissez Modifier pour saisir les aliments.';if(typeof confirmer!=='undefined')confirmer.textContent=ok?'✓ Validée':d.dirty?'✓ Valider les corrections':'✓ Valider';}
 function lignes(){liste.replaceChildren();d.aliments.forEach((x,i)=>{const ligne=abcEl('div',undefined,'abc-photo-aliment');const check=abcEl('input');check.type='checkbox';check.checked=x.choisi!==false;check.setAttribute('aria-label','Inclure '+x.nom);check.addEventListener('change',()=>{x.choisi=check.checked;d.dirty=true;rafraichirGuidage();});const nom=abcEl('input');nom.value=x.nom;nom.setAttribute('aria-label','Nom de l’aliment '+(i+1)+' de la photo '+(index+1));nom.addEventListener('input',()=>{x.nom=nom.value;delete x.catalogueId;type.value='';libreActuel.textContent='✏️ '+(x.nom||'Saisie libre');d.dirty=true;rafraichirGuidage();});const type=abcEl('select');type.setAttribute('aria-label','Choisir un aliment du catalogue pour '+x.nom);
 const libreActuel=abcEl('option','✏️ '+(x.nom||'Saisie libre'));libreActuel.value='';type.append(libreActuel);
 const types=p.rubrique==='plat'?['plat','accomp']:[p.rubrique];
 let selection='';
 const normaliser=texte=>String(texte||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 types.forEach(t=>['base','option'].forEach(n=>{
  const groupe=abcEl('optgroup');groupe.label=ABC_RUBRIQUES[t]+(n==='option'?' · compléments':'');
  ABC_CATALOGUE.items.filter(item=>item.actif&&!item.fusionVers&&item.rubrique===t&&item.nature===n).sort((a,b)=>a.libelle.localeCompare(b.libelle,'fr')).forEach(item=>{
   const opt=abcEl('option',item.libelle);opt.value=item.id;groupe.append(opt);
   if(item.id===x.catalogueId||(!selection&&normaliser(item.libelle)===normaliser(x.nom)))selection=item.id;
  });if(groupe.children.length)type.append(groupe);
 }));
 type.value=selection;
 type.addEventListener('change',()=>{
  const choisi=ABC_CATALOGUE.items.find(item=>item.id===type.value);
  if(choisi){x.nom=choisi.libelle;x.rubrique=choisi.rubrique;x.nature=choisi.nature;x.catalogueId=choisi.id;nom.value=x.nom;check.setAttribute('aria-label','Inclure '+x.nom);}
  else{delete x.catalogueId;nom.focus();}
  d.dirty=true;rafraichirGuidage();
 });
 ligne.append(check,nom,type);const maisonLabel=abcEl('label','🧑‍🍳 Fait maison '),maison=abcEl('input');maison.type='checkbox';maison.checked=x.maison===true;maison.addEventListener('change',()=>{x.maison=maison.checked;d.dirty=true;rafraichirGuidage();});maisonLabel.prepend(maison);ligne.append(maisonLabel);liste.append(ligne);});}
 lignes();
 const ajout=abcEl('select');ajout.setAttribute('aria-label','Ajouter un élément du catalogue à cette photo');ajout.append(abcEl('option','＋ Choisir dans le catalogue…'));ajout.firstChild.value='';ABC_CATALOGUE.items.filter(x=>x.actif&&!x.fusionVers&&(p.rubrique==='plat'?['plat','accomp'].includes(x.rubrique):x.rubrique===p.rubrique)).forEach(x=>{const o=abcEl('option',x.libelle+(x.nature==='option'?' · option':''));o.value=x.id;ajout.append(o);});ajout.addEventListener('change',()=>{const x=ABC_CATALOGUE.items.find(x=>x.id===ajout.value);if(x){d.aliments.push({nom:x.libelle,rubrique:x.rubrique,nature:x.nature,catalogueId:x.id,description:'',maison:false,choisi:true});d.dirty=true;rafraichirGuidage();lignes();}ajout.value='';});carte.append(ajout);
 const libre=abcEl('button','＋ Écrire le nom d’un aliment','btn btn-outline');libre.type='button';libre.addEventListener('click',()=>{d.aliments.push({nom:'',rubrique:p.rubrique,nature:'base',description:'',maison:false,choisi:true});d.dirty=true;rafraichirGuidage();lignes();});carte.append(libre);
 const details=abcEl('div');details.append(abcEl('label','Nom de l’assiette ou du lot photographié'));const notes=abcEl('textarea');notes.value=d.notes;notes.placeholder='Ex. rayon desserts : melon en coupelles, yaourts nature et tartes aux pommes';notes.setAttribute('aria-label','Nom et description de l’assiette ou du lot photographié');notes.addEventListener('input',()=>{d.notes=notes.value;d.dirty=true;rafraichirGuidage();});notes.style.cssText='display:block;width:100%;min-height:90px;padding:10px;font-size:16px;background:white;color:#111827;border:2px solid #2d6a4f;';details.firstChild.append(abcAidePhoto('Nom de l’assiette ou du lot','Ce champ est facultatif : il sert à décrire l’assiette ou le rayon photographié. Les aliments retenus pour le menu sont les lignes cochées sous cette fiche. Pour corriger un aliment reconnu par l’IA, modifiez son nom dans sa ligne, puis confirmez la photo.'));details.append(notes);carte.insertBefore(details,note.nextSibling);
 const statut=abcEl('p');statut.setAttribute('role','status');
 const confirmer=abcEl('button','✓ Confirmer','btn');confirmer.type='button';confirmer.addEventListener('click',async()=>{if(!a&&!d.dirty){statut.textContent='La reconnaissance est en cours. Attendez le résultat ou cliquez sur Modifier.';return;}const ctx=abcPhotoContexte(),aliments=d.aliments.length?d.aliments.filter(x=>x.choisi!==false):abcNomsPhotoSaisis(d.notes,p.rubrique);if(aliments.some(x=>!x.nom.trim())){statut.textContent='Complétez les noms ou décochez les lignes vides.';return;}confirmer.disabled=true;confirmer.textContent='⏳ Enregistrement…';statut.textContent='⏳ Enregistrement de cette photo et de ses aliments sur le serveur…';const debut=Date.now();const attente=setInterval(()=>{statut.textContent='⏳ Enregistrement en cours · '+Math.floor((Date.now()-debut)/1000)+' s. Attendez la confirmation du serveur.';},1000);try{const res=await abcAPIPhotoMenu('savePhotoIdentification',{...ctx,photo_id:p.id,revision:d.revision,aliments,notes:d.notes});if(abcRecevoirMenuPhotos(res,ctx)){ABC_PHOTOS.drafts.delete(abcClePhoto(p));abcAfficherPhotos();abcPhotoStatut('✓ Photo confirmée. Vos noms corrigés seront transmis à l’IA.');}}catch(e){statut.textContent=e.message;}finally{clearInterval(attente);confirmer.disabled=false;rafraichirGuidage();}});
 const retirer=abcEl('button','🗑️ Supprimer','btn btn-outline');retirer.type='button';retirer.style.cssText='min-height:44px;color:#b91c1c;border-color:#b91c1c;margin:6px 0;';retirer.addEventListener('click',async()=>{const ctx=abcPhotoContexte();retirer.disabled=true;retirer.textContent='⏳ Suppression…';abcPhotoStatut('Suppression de cette photo…');try{const op={...ctx,rubrique:p.rubrique,photo_id:p.id,retirer:true};await abcPhotoDb('readwrite',store=>store.put(op));ABC_PHOTOS.pending.push(op);ABC_PHOTOS.drafts.delete(abcClePhoto(p));abcAfficherPhotos();abcPhotoStatut('Suppression enregistrée · elle sera effectuée après l’opération en cours.');await abcEnvoyerPhotos();}catch(e){statut.textContent='Suppression impossible : '+e.message;abcPhotoStatut(statut.textContent);}finally{retirer.disabled=false;retirer.textContent='🗑️ Supprimer';}});const renommer=abcEl('button','✏️ Modifier','btn btn-outline');renommer.type='button';renommer.setAttribute('aria-expanded',String(!edition.hidden));renommer.addEventListener('click',()=>{edition.hidden=!edition.hidden;renommer.setAttribute('aria-expanded',String(!edition.hidden));if(!edition.hidden)liste.querySelector('input:not([type=checkbox])')?.focus();});const actions=abcEl('div');actions.className='abc-photo-actions';actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;';actions.append(renommer,retirer,confirmer);const apercu=abcEl('div',undefined,'abc-photo-apercu-actions');carte.insertBefore(apercu,img);const fiche=abcEl('div',undefined,'abc-photo-fiche');fiche.append(actions,abcAidePhoto('Commandes de cette photo','Modifier ouvre les aliments, le catalogue et la description facultative du lot. Supprimer retire cette photo du service sélectionné. Confirmer enregistre les aliments cochés et vos corrections pour cette photo. Après une nouvelle modification, confirmez de nouveau. La validation du menu entier se fait à la fin.'));const visuel=abcEl('div',undefined,'abc-photo-visuel');proposition.append(abcAidePhoto('Propositions de l’IA','Ce texte reprend les aliments reconnus sur cette photo. La confiance haute, moyenne ou faible est une estimation de l’IA. Vérifiez les lignes alimentaires : corrigez les noms, décochez les erreurs ou ajoutez un aliment manquant, puis confirmez.'));visuel.append(img,proposition);apercu.append(visuel,fiche);edition.append(titreAliments,liste,ajout,libre,details);carte.append(edition,statut);rafraichirGuidage();if(a?.confirmee&&!d.dirty){const resume=abcEl('details',undefined,'abc-photo-validee');const titre=abcEl('summary','✓ '+(d.aliments.filter(x=>x.choisi!==false).map(x=>x.nom).join(', ')||'Photo validée')+' · Modifier / supprimer');resume.append(titre,carte);return resume;}return carte;
}
function abcRetourAnalysePhotos(photos,message){
 for(const p of photos){ABC_PHOTOS.messages.set(abcClePhoto(p),message);const e=document.querySelector('[data-photo-analyse="'+p.id+'"]');if(e)e.textContent=message;}
}
async function abcReconnaitreMenuPhotos(photoId){
 photoId=typeof photoId==='string'?photoId:'';
 const ctx=abcPhotoContexte(),actuel=()=>JSON.stringify(ctx)===JSON.stringify(abcPhotoContexte());
 const cibles=ABC_PHOTOS.photos.filter(p=>(!photoId||p.id===photoId)&&!ABC_PHOTOS.identifications[p.id]);
 if(ABC_PHOTOS.analyse||ABC_PHOTOS.busy){abcPhotoStatut('⏳ Envoi ou analyse déjà en cours.');abcRetourAnalysePhotos(cibles,'⏳ Envoi ou analyse déjà en cours…');return;}
 if(!ABC_PHOTOS.photos.length){abcPhotoStatut('Attendez l’enregistrement des photos avant de lancer la reconnaissance.');return;}
 if(!cibles.length){const message='✅ Les photos ont déjà été identifiées ou confirmées. Vérifiez les noms sous chacune, puis confirmez les photos restantes.';abcPhotoStatut(message);abcRetourAnalysePhotos(ABC_PHOTOS.photos.filter(p=>!photoId||p.id===photoId),message);return;}
 const enAttenteAvant=new Set(ABC_PHOTOS.pending.map(p=>p.photo_id));
 ABC_PHOTOS.analyse=true;
 const bouton=document.getElementById('abc-photos-reconnaitre');
 if(bouton){bouton.disabled=true;bouton.textContent='⏳ Reconnaissance en cours…';}
 abcRetourAnalysePhotos(cibles,'⏳ L’IA examine cette photo…');
 abcPhotoStatut('⏳ Reconnaissance en cours. Le résultat apparaîtra directement sous chaque photo.');
 try{
  let restantes=cibles.length;
  do{
   const avant=restantes;
   const res=await abcAPIPhotoMenu('analysePhotoMenu',photoId?{...ctx,photo_id:photoId}:ctx);
   if(!abcRecevoirMenuPhotos(res,ctx))return;
   restantes=cibles.filter(p=>!ABC_PHOTOS.identifications[p.id]).length;
   abcRetourAnalysePhotos(cibles.filter(p=>ABC_PHOTOS.identifications[p.id]),'✅ Analyse terminée · vérifiez les noms proposés, puis confirmez.');
   abcAfficherPhotos();
   if(restantes>=avant)throw Error('Aucun résultat reçu pour les photos restantes. Vous pouvez réessayer.');
  }while(restantes);
  abcPhotoStatut('✅ Reconnaissance terminée. Les propositions de l’IA sont affichées sous chaque photo. Vos saisies sont conservées.');
 }catch(e){
  if(actuel()){const message='⚠️ Analyse non terminée : '+e.message;abcRetourAnalysePhotos(cibles.filter(p=>!ABC_PHOTOS.identifications[p.id]),message);abcPhotoStatut(message+' Photos et noms conservés.');}
 }finally{
  ABC_PHOTOS.analyse=false;
  if(bouton){bouton.disabled=false;bouton.textContent='Reconnaître les photos restantes';}
  abcActualiserEtapePhotos();
  if(ABC_PHOTOS.pending.some(p=>!enAttenteAvant.has(p.photo_id)))void abcEnvoyerPhotos();
 }
}
function abcSignaturePhotoClient(){return ABC_PHOTOS.photos.map(p=>p.id+'@'+(ABC_PHOTOS.identifications[p.id]?.revision||0)).sort().join('|');}
async function abcValiderMenuPhotos(){
 const bouton=document.getElementById('abc-photos-valider');if(bouton?.disabled)return;
 if(ABC_PHOTOS.busy||ABC_PHOTOS.analyse){abcPhotoStatut('⏳ Attendez la fin de l’envoi ou de l’analyse en cours.');return;}
 const ctx=abcPhotoContexte();
 if(ABC_PHOTOS.pending.some(p=>p.ecole===ctx.ecole&&p.date===ctx.date)){abcPhotoStatut('Des photos attendent leur envoi. Réessayez l’envoi avant de valider.');return;}
 if(!ABC_PHOTOS.photos.length){abcPhotoStatut('Aucune photo reçue pour ce service.');return;}
 if(ABC_PHOTOS.photos.some(p=>!ABC_PHOTOS.identifications[p.id]?.confirmee||abcBrouillonPhoto(p).dirty)){
  abcPhotoStatut('Vérifiez puis confirmez chaque photo avant de valider le menu complet.');
  if(bouton){bouton.textContent='Confirmez d’abord chaque photo';setTimeout(()=>{if(!bouton.disabled)bouton.textContent='Valider le menu complet';},4000);}return;
 }
 const debut=Date.now();if(bouton){bouton.disabled=true;bouton.textContent='⏳ Enregistrement du menu…';}
 const progression=document.getElementById('abc-photos-progression');
 const informer=()=>{const message='⏳ Enregistrement du menu sur le serveur · '+Math.floor((Date.now()-debut)/1000)+' s. Attendez la confirmation.';abcPhotoStatut(message);if(progression)progression.textContent=message;};
 informer();const attente=setInterval(informer,1000);const essai=document.getElementById('abc-photo-essai')?.checked===true;
 try{
  const res=await abcAPIPhotoMenu('validatePhotoMenu',{...ctx,signature:abcSignaturePhotoClient(),menuPrecedent:ABC_PHOTOS.menu,pain:document.getElementById('abc-photo-pain').checked,essai,effectif:Number(document.getElementById('convives-total')?.value)||0});
  if(JSON.stringify(ctx)!==JSON.stringify(abcPhotoContexte()))return;
  clearInterval(attente);
  if(!essai){ABC_PHOTOS.menu=res.menu;ABC_PHOTOS.reference=res.reference;ABC_CATALOGUE.menus[ctx.date]=res.menu;}
  const apercu=document.getElementById('abc-photo-menu-final');if(apercu)apercu.textContent=(essai?'ESSAI · menu réel inchangé : ':'✅ MENU ENREGISTRÉ : ')+res.menu;
  const message=essai?'✓ Essai terminé. Le menu réel reste inchangé.':'✅ Menu enregistré pour '+ctx.ecole+' · '+ctx.date+'. Les références confirmées sont prêtes pour les scans.';
  abcPhotoStatut(message);if(progression)progression.textContent=message;if(bouton)bouton.textContent='✓ Menu enregistré';
  if(!essai)setTimeout(()=>{if(JSON.stringify(ctx)!==JSON.stringify(abcPhotoContexte()))return;Promise.resolve().then(()=>abcReprendreMenu(true)).catch(()=>{});Promise.resolve().then(()=>loadLiveData()).catch(()=>{});},0);
 }catch(e){if(JSON.stringify(ctx)===JSON.stringify(abcPhotoContexte())){const message='⚠️ '+e.message;abcPhotoStatut(message);if(progression)progression.textContent=message;if(bouton)bouton.textContent='Vérifier puis réessayer la validation';}}
 finally{clearInterval(attente);if(bouton)bouton.disabled=false;}
}
