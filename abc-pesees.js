// Pesées déjà enregistrées pour la date choisie : consulter, modifier (sans nouvelle ligne) ou supprimer.
// Le formulaire « Saisie des déchets » sert aussi à la modification ; l'ajout d'un sac supplémentaire reste possible.
(function () {
  'use strict';
  const CHAMPS = [['alimentaire', 'sac-alimentaire', '🥬 Biodéchets'], ['fruits', 'sac-fruits', '🍏 Fruits'], ['pain', 'sac-pain', '🥖 Pain'], ['emballages', 'sac-emballages', '📦 Emballages'], ['serviettes', 'sac-serviettes', '🧻 Serviettes']];
  let edition = null; // { ligne, revision, date }
  let signature = '';

  const $ = id => document.getElementById(id);
  const ecole = () => ($('select-etablissement') || {}).value || '';
  const datePesee = () => ($('input-pesee-date') || {}).value || new Date().toISOString().slice(0, 10);
  const kg = n => (Number(n) || 0).toFixed(2).replace('.', ',');
  const dateFR = d => d.split('-').reverse().join('/');
  function peseesDuJour() {
    const d = (typeof globalRawData !== 'undefined' && globalRawData && globalRawData.ecole === ecole()) ? (globalRawData.peseesDetail || []) : [];
    return d.filter(p => p.date === datePesee());
  }

  async function envoyer(payload) {
    const r = await fetch(ADRESSE_SHEET_OFFICIELLE, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) });
    const data = await r.json();
    if (!data.success || data.peseesVersion !== 1) throw new Error(data.error || 'Installez et redéployez le dernier Code.gs pour modifier ou supprimer une pesée.');
    if (typeof globalRawData !== 'undefined' && globalRawData && globalRawData.ecole === payload.ecole) globalRawData.peseesDetail = data.peseesDetail || [];
    return data;
  }

  function zone() {
    let z = $('abc-pesees-jour');
    if (z) return z;
    const btn = $('btn-pesees'); if (!btn) return null;
    z = document.createElement('div'); z.id = 'abc-pesees-jour';
    z.style.cssText = 'margin:0 0 12px; padding:10px 12px; border:1px solid #cbd5e1; border-radius:8px; background:#f8fafc; font-size:13px;';
    btn.parentNode.insertBefore(z, $('label-fruits-bio') || btn);
    return z;
  }

  function afficher() {
    const z = zone(); if (!z) return;
    const liste = peseesDuJour();
    const btn = $('btn-pesees');
    if (btn) btn.innerHTML = edition ? '💾 Enregistrer la modification (remplace la pesée)' : (liste.length ? '➕ Ajouter un sac supplémentaire pour ce jour' : '💾 Enregistrer les pesées & Afficher le bilan');
    if (!liste.length && !edition) { z.style.display = 'none'; return; }
    z.style.display = '';
    const total = {}; CHAMPS.forEach(([c]) => { total[c] = liste.reduce((t, p) => t + (Number(p[c]) || 0), 0); });
    let h = `<strong>📋 Pesées déjà enregistrées le ${dateFR(datePesee())}</strong> <span style="color:#475569;">(${liste.length} ligne${liste.length > 1 ? 's' : ''} · elles s'additionnent)</span>`;
    h += '<table style="width:100%; border-collapse:collapse; margin-top:6px; font-size:12.5px;"><tr style="text-align:left; color:#475569;"><th>Sac</th>' + CHAMPS.map(([, , n]) => `<th style="text-align:right;">${n}</th>`).join('') + '<th></th></tr>';
    liste.forEach((p, i) => {
      const enCours = edition && edition.ligne === p.ligne;
      h += `<tr style="border-top:1px solid #e2e8f0;${enCours ? ' background:#fef3c7;' : ''}"><td>n° ${i + 1}${p.fruitsDansBio ? ' <span title="Fruits jetés avec les biodéchets">🍏➜🥬</span>' : ''}</td>` +
        CHAMPS.map(([c]) => `<td style="text-align:right;">${kg(p[c])}</td>`).join('') +
        `<td style="text-align:right; white-space:nowrap;"><button type="button" class="btn-period" data-modifier="${p.ligne}" style="font-size:11.5px; padding:3px 8px;">✏️ Modifier cette pesée</button> <button type="button" class="btn-period" data-supprimer="${p.ligne}" style="font-size:11.5px; padding:3px 8px; color:#b91c1c;">🗑️ Supprimer</button></td></tr>`;
    });
    if (liste.length > 1) h += '<tr style="border-top:2px solid #94a3b8; font-weight:800;"><td>Total</td>' + CHAMPS.map(([c]) => `<td style="text-align:right;">${kg(total[c])}</td>`).join('') + '<td></td></tr>';
    h += '</table>';
    if (edition) h += `<div style="margin-top:8px; color:#92400e; font-weight:700;">✏️ Modification en cours : corrigez les poids ci-dessus puis cliquez sur « Enregistrer la modification ». <button type="button" class="btn-period" id="abc-pesee-annuler" style="font-size:11.5px; padding:3px 8px;">Annuler</button></div>`;
    else h += '<div style="margin-top:6px; color:#475569;">Une erreur de saisie ? Cliquez sur « Modifier cette pesée » : elle sera remplacée, pas additionnée.</div>';
    h += '<div id="abc-pesee-etat" role="status" style="margin-top:4px; color:#475569;"></div>';
    z.innerHTML = h;
    z.querySelectorAll('[data-modifier]').forEach(b => b.addEventListener('click', () => commencer(Number(b.dataset.modifier))));
    z.querySelectorAll('[data-supprimer]').forEach(b => b.addEventListener('click', () => supprimer(Number(b.dataset.supprimer))));
    const a = $('abc-pesee-annuler'); if (a) a.addEventListener('click', annuler);
  }

  function commencer(ligne) {
    const p = peseesDuJour().find(x => x.ligne === ligne); if (!p) return;
    edition = { ligne: p.ligne, revision: p.revision, date: p.date, ecole: ecole() };
    const c = $('fruits-dans-bio'); if (c) { c.checked = !!p.fruitsDansBio; if (typeof majFruitsDansBio === 'function') majFruitsDansBio(); }
    CHAMPS.forEach(([cle, id]) => { const el = $(id); if (el) el.value = (Number(p[cle]) || 0).toFixed(2); });
    afficher();
    const el = $('sac-alimentaire'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function annuler() {
    edition = null;
    CHAMPS.forEach(([, id]) => { const el = $(id); if (el && !el.disabled) el.value = '0.00'; });
    afficher();
  }
  function etat(t) { const e = $('abc-pesee-etat'); if (e) e.textContent = t; }

  async function enregistrerModification() {
    const btn = $('btn-pesees'); if (btn && btn.disabled) return;
    if (!edition || edition.ecole !== ecole()) { annuler(); return; }
    const fruitsBio = !!($('fruits-dans-bio') || {}).checked;
    const payload = { action: 'correctBagWeights', ecole: ecole(), ligne: edition.ligne, revision: edition.revision, fruits_dans_biodechets: fruitsBio };
    for (const [cle, id] of CHAMPS) {
      const n = parseFloat(($(id) || {}).value); if (!Number.isFinite(n) || n < 0) { etat('Poids invalide : ' + cle + '.'); return; }
      payload[cle] = cle === 'fruits' && fruitsBio ? 0 : Math.round(n * 100) / 100;
    }
    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.innerHTML = '⏳ Modification en cours…'; }
    try {
      await envoyer(payload);
      edition = null;
      CHAMPS.forEach(([, id]) => { const el = $(id); if (el && !el.disabled) el.value = '0.00'; });
      afficher(); etat('✅ Pesée modifiée (remplacée, sans nouvelle ligne). Actualisation des indicateurs…');
      if (typeof loadLiveData === 'function') loadLiveData();
    } catch (e) { etat('⚠️ ' + e.message); }
    finally { if (btn) { btn.disabled = false; btn.style.opacity = ''; } afficher(); }
  }

  async function supprimer(ligne) {
    const p = peseesDuJour().find(x => x.ligne === ligne); if (!p) return;
    if (!confirm(`Supprimer la pesée du ${dateFR(p.date)} (biodéchets ${kg(p.alimentaire)} kg, pain ${kg(p.pain)} kg) ?\n\nElle sera retirée des calculs mais gardée dans l'onglet « Pesees_Supprimees » du Google Sheet.`)) return;
    etat('⏳ Suppression…');
    try {
      await envoyer({ action: 'deleteBagWeights', ecole: ecole(), ligne: p.ligne, revision: p.revision });
      if (edition && edition.ligne === ligne) edition = null;
      afficher(); etat('✅ Pesée supprimée (copie gardée dans Pesees_Supprimees). Actualisation des indicateurs…');
      if (typeof loadLiveData === 'function') loadLiveData();
    } catch (e) { etat('⚠️ ' + e.message); }
  }

  // Le bouton existant : modification si une pesée est en cours d'édition, sinon ajout (avec confirmation s'il existe déjà une pesée ce jour-là).
  function installer() {
    if (typeof window.saveBagWeights !== 'function' || window.saveBagWeights.abcPesees) return;
    const original = window.saveBagWeights;
    const nouvelle = function () {
      if (edition) return enregistrerModification();
      const liste = peseesDuJour();
      if (liste.length && !confirm(`Une pesée est déjà enregistrée pour le ${dateFR(datePesee())}.\n\nOK : AJOUTER ce sac en plus (les poids s'additionnent).\nAnnuler : ne rien envoyer — pour corriger une erreur, utilisez « ✏️ Modifier cette pesée ».`)) return;
      return original.apply(this, arguments);
    };
    nouvelle.abcPesees = true;
    window.saveBagWeights = nouvelle;
  }

  // Mode fruits : par défaut, celui de la dernière pesée de l'établissement (Giono : fruits avec les biodéchets).
  let ecoleFruits = '';
  function fruitsParDefaut() {
    if (edition || typeof globalRawData === 'undefined' || !globalRawData || globalRawData.ecole !== ecole() || ecoleFruits === ecole()) return;
    const toutes = globalRawData.peseesDetail || []; if (!toutes.length) return;
    const derniere = toutes.slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.ligne - b.ligne).pop();
    const c = $('fruits-dans-bio'); if (!c) return;
    ecoleFruits = ecole();
    c.checked = !!derniere.fruitsDansBio;
    if (typeof majFruitsDansBio === 'function') majFruitsDansBio();
  }

  function surveiller() {
    installer();
    const vue = $('view-saisie-dechets'); if (!vue || !vue.classList.contains('active')) return;
    fruitsParDefaut();
    const sig = ecole() + '|' + datePesee() + '|' + JSON.stringify(peseesDuJour().map(p => p.revision + p.fruitsDansBio)) + '|' + (edition ? edition.ligne : '');
    if (sig !== signature) {
      if (edition && (edition.ecole !== ecole() || edition.date !== datePesee())) edition = null;
      signature = sig; afficher();
    }
  }
  document.addEventListener('DOMContentLoaded', () => { installer(); setInterval(surveiller, 1500); });
  window.abcPeseesJour = { afficher, commencer, supprimer, annuler, peseesDuJour };
})();
